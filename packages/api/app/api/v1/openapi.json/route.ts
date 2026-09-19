import { NextResponse } from 'next/server';
import { CORS_HEADERS } from '@/lib/apiAuth';
import { PROVINCES } from '@/lib/provinces';
import { DEFAULT_RANGE_DAYS, DEFAULT_TIMEZONE, MAX_RANGE_DAYS, RETENTION_DAYS } from '@/lib/speedtestApi';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

const statsProperties = {
  total_tests: { type: 'integer', description: 'Tests recorded in the bucket, timed-out ones included.' },
  tests: { type: 'integer', description: 'Tests actually used to compute the statistics below.' },
  timed_out_tests: { type: 'integer', description: 'How many of total_tests timed out.' },
  download_mbps: { $ref: '#/components/schemas/FullStat' },
  upload_mbps: { $ref: '#/components/schemas/FullStat' },
  latency_ms: { $ref: '#/components/schemas/ShortStat' },
  jitter_ms: {
    type: 'object',
    properties: { avg: { type: 'number', nullable: true } },
  },
};

const rangeParams = [
  {
    name: 'from', in: 'query', required: false,
    description: `Start of the range, inclusive. Either a calendar date (\`YYYY-MM-DD\`, read as the start of that day in \`tz\`) or a full ISO 8601 timestamp. Defaults to ${DEFAULT_RANGE_DAYS} days before \`to\`.`,
    schema: { type: 'string', example: '2026-09-01' },
  },
  {
    name: 'to', in: 'query', required: false,
    description: 'End of the range. A calendar date is **inclusive** (it covers that whole day in `tz`); an ISO 8601 timestamp is an exclusive upper bound. Defaults to now.',
    schema: { type: 'string', example: '2026-09-15' },
  },
  {
    name: 'days', in: 'query', required: false,
    description: `Shortcut for "the last N days until now". Cannot be combined with \`from\`/\`to\`. 1–${MAX_RANGE_DAYS}.`,
    schema: { type: 'integer', minimum: 1, maximum: MAX_RANGE_DAYS },
  },
  {
    name: 'province', in: 'query', required: false,
    description: 'Comma-separated province codes. Omit for all 16.',
    schema: { type: 'string', example: 'HAB,SCU' },
  },
  {
    name: 'tz', in: 'query', required: false,
    description: 'IANA timezone used to resolve calendar dates and day buckets.',
    schema: { type: 'string', default: DEFAULT_TIMEZONE },
  },
  {
    name: 'include_timed_out', in: 'query', required: false,
    description: 'Include tests that timed out (their download speed is recorded as ~0, which drags averages down). Off by default; the counts are reported either way.',
    schema: { type: 'boolean', default: false },
  },
  {
    name: 'format', in: 'query', required: false,
    description: 'Response format.',
    schema: { type: 'string', enum: ['json', 'csv'], default: 'json' },
  },
];

const errorResponses = {
  400: { description: 'Invalid parameters.', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
  401: { description: 'Missing or invalid API key.', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
  429: { description: 'Rate limit exceeded.', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
  500: { description: 'Server error.', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
};

export async function GET() {
  const spec = {
    openapi: '3.0.3',
    info: {
      title: 'Cuba Internet Monitor — Speed test API',
      version: '1.0.0',
      description: [
        'Crowdsourced internet speed measurements from Cuba, aggregated by province.',
        '',
        'Every measurement comes from a browser speed test run by a visitor of https://internet.cubapk.com',
        'from a Cuban network. Tests are anonymous: no IP address is stored, only a salted hash used for rate limiting.',
        '',
        `Raw measurements are retained for ${RETENTION_DAYS} days, so a range older than that returns empty buckets.`,
        '',
        'A project by CubaPK and elToque.',
      ].join('\n'),
      contact: { name: 'Cuba Internet Monitor', url: 'https://internet.cubapk.com/docs/api' },
      license: { name: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' },
    },
    servers: [{ url: 'https://internet.cubapk.com', description: 'Production' }],
    security: [{ ApiKeyHeader: [] }],
    tags: [{ name: 'Speed tests' }, { name: 'Reference' }],
    paths: {
      '/api/v1/speedtests/provinces': {
        get: {
          tags: ['Speed tests'],
          summary: 'Speed statistics per province',
          description: `One row per province for the requested range (default: the last ${DEFAULT_RANGE_DAYS} days). Provinces with no tests are returned with zero counts and null statistics.`,
          parameters: rangeParams,
          responses: {
            200: {
              description: 'Aggregates per province.',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      meta: { $ref: '#/components/schemas/Meta' },
                      summary: { $ref: '#/components/schemas/Stats' },
                      data: { type: 'array', items: { $ref: '#/components/schemas/ProvinceRow' } },
                    },
                  },
                },
                'text/csv': { schema: { type: 'string' } },
              },
            },
            ...errorResponses,
          },
        },
      },
      '/api/v1/speedtests/daily': {
        get: {
          tags: ['Speed tests'],
          summary: 'Daily speed statistics',
          description: 'One row per day (per province by default). Days without tests are omitted.',
          parameters: [
            ...rangeParams,
            {
              name: 'group_by', in: 'query', required: false,
              description: "`province` returns a row per day and province; `country` returns one nationwide row per day.",
              schema: { type: 'string', enum: ['province', 'country'], default: 'province' },
            },
          ],
          responses: {
            200: {
              description: 'Daily aggregates.',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      meta: { $ref: '#/components/schemas/Meta' },
                      data: { type: 'array', items: { $ref: '#/components/schemas/DailyRow' } },
                    },
                  },
                },
                'text/csv': { schema: { type: 'string' } },
              },
            },
            ...errorResponses,
          },
        },
      },
      '/api/v1/meta': {
        get: {
          tags: ['Reference'],
          summary: 'Province catalogue and dataset coverage',
          description: 'Province codes and names, how much data is currently available, and the defaults applied. Also the cheapest call for checking that a key works.',
          parameters: [],
          responses: {
            200: {
              description: 'Dataset metadata.',
              content: { 'application/json': { schema: { type: 'object' } } },
            },
            ...errorResponses,
          },
        },
      },
    },
    components: {
      securitySchemes: {
        ApiKeyHeader: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description: 'Your API key. `Authorization: Bearer <key>` and `?api_key=<key>` are accepted too.',
        },
      },
      schemas: {
        FullStat: {
          type: 'object',
          description: 'Null when the bucket has no usable tests.',
          properties: {
            avg: { type: 'number', nullable: true },
            median: { type: 'number', nullable: true, description: '50th percentile (approximate).' },
            p90: { type: 'number', nullable: true, description: '90th percentile (approximate).' },
            min: { type: 'number', nullable: true },
            max: { type: 'number', nullable: true },
          },
        },
        ShortStat: {
          type: 'object',
          properties: {
            avg: { type: 'number', nullable: true },
            median: { type: 'number', nullable: true },
            p90: { type: 'number', nullable: true },
          },
        },
        Stats: { type: 'object', properties: statsProperties },
        ProvinceRow: {
          type: 'object',
          properties: {
            province_id: { type: 'string', enum: PROVINCES.map(p => p.id) },
            province: { type: 'string', example: 'La Habana' },
            ...statsProperties,
            first_test: { type: 'string', format: 'date-time', nullable: true },
            last_test: { type: 'string', format: 'date-time', nullable: true },
          },
        },
        DailyRow: {
          type: 'object',
          properties: {
            date: { type: 'string', example: '2026-09-15', description: 'Calendar day in `tz`.' },
            province_id: { type: 'string', description: 'Absent when `group_by=country`.' },
            province: { type: 'string', description: 'Absent when `group_by=country`.' },
            ...statsProperties,
          },
        },
        Meta: {
          type: 'object',
          properties: {
            source: { type: 'string', example: 'crowdsourced' },
            from: { type: 'string', format: 'date-time' },
            to: { type: 'string', format: 'date-time', description: 'Exclusive upper bound.' },
            timezone: { type: 'string' },
            include_timed_out: { type: 'boolean' },
            retention_days: { type: 'integer' },
            generated_at: { type: 'string', format: 'date-time' },
          },
        },
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'object',
              properties: {
                code: { type: 'string', example: 'invalid_range' },
                message: { type: 'string' },
              },
            },
          },
        },
      },
    },
  };

  return NextResponse.json(spec, {
    headers: { ...CORS_HEADERS, 'Cache-Control': 'public, max-age=3600' },
  });
}
