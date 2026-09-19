import { NextRequest } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { authenticate, apiJson, apiError, corsPreflight } from '@/lib/apiAuth';
import { PROVINCES } from '@/lib/provinces';
import { DEFAULT_RANGE_DAYS, DEFAULT_TIMEZONE, MAX_RANGE_DAYS, RETENTION_DAYS } from '@/lib/speedtestApi';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function OPTIONS() {
  return corsPreflight();
}

/** Province catalogue plus what the dataset currently covers. Also the cheapest way to verify a key. */
export async function GET(req: NextRequest) {
  const auth = authenticate(req);
  if (!auth.ok) return auth.response;

  try {
    const db = await getDb();
    const [coverage] = await db.collection('metrics').aggregate([
      { $match: { 'metadata.source': 'crowdsourced', 'metadata.province_id': { $ne: null } } },
      {
        $group: {
          _id: null,
          total_tests: { $sum: 1 },
          timed_out_tests: { $sum: { $cond: [{ $eq: ['$timed_out', true] }, 1, 0] } },
          first_test: { $min: '$timestamp' },
          last_test: { $max: '$timestamp' },
        },
      },
    ]).toArray();

    return apiJson(
      {
        api_version: 'v1',
        dataset: {
          source: 'crowdsourced',
          description:
            'Browser speed tests run by visitors of internet.cubapk.com from Cuban networks, tagged with the province the visitor selected.',
          metrics: ['download_mbps', 'upload_mbps', 'latency_ms', 'jitter_ms'],
          retention_days: RETENTION_DAYS,
          total_tests: coverage?.total_tests ?? 0,
          timed_out_tests: coverage?.timed_out_tests ?? 0,
          first_test: coverage?.first_test ? new Date(coverage.first_test as Date).toISOString() : null,
          last_test: coverage?.last_test ? new Date(coverage.last_test as Date).toISOString() : null,
        },
        defaults: {
          range_days: DEFAULT_RANGE_DAYS,
          timezone: DEFAULT_TIMEZONE,
          include_timed_out: false,
          max_range_days: MAX_RANGE_DAYS,
        },
        provinces: PROVINCES.map(p => ({ id: p.id, name: p.name })),
        endpoints: [
          { path: '/api/v1/speedtests/provinces', description: 'Aggregates per province for a date range.' },
          { path: '/api/v1/speedtests/daily', description: 'Daily series, per province or nationwide.' },
          { path: '/api/v1/meta', description: 'This document.' },
        ],
        documentation: 'https://internet.cubapk.com/docs/api',
      },
      auth.headers,
    );
  } catch (err) {
    console.error('[api/v1/meta]', err);
    return apiError(500, 'internal_error', 'Could not read the dataset metadata.', auth.headers);
  }
}
