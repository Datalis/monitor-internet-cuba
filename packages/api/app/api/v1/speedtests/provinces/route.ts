import { NextRequest } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { authenticate, apiJson, apiCsv, apiError, corsPreflight } from '@/lib/apiAuth';
import { PROVINCES } from '@/lib/provinces';
import {
  parseQuery, buildMatch, statsAccumulators, formatStats, queryMeta,
  toCsv, csvFilename, STATS_CSV_HEADERS, statsCsvRow,
} from '@/lib/speedtestApi';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function OPTIONS() {
  return corsPreflight();
}

function iso(value: unknown): string | null {
  if (!value) return null;
  const date = new Date(value as string);
  return isNaN(date.getTime()) ? null : date.toISOString();
}

export async function GET(req: NextRequest) {
  const auth = authenticate(req);
  if (!auth.ok) return auth.response;

  const parsed = parseQuery(req.nextUrl.searchParams);
  if ('error' in parsed) return apiError(400, parsed.error.code, parsed.error.message, auth.headers);
  const query = parsed.query;

  try {
    const accumulators = statsAccumulators(query.includeTimedOut);
    const db = await getDb();
    const [facet] = await db.collection('metrics').aggregate([
      { $match: buildMatch(query) },
      {
        $facet: {
          by_province: [{ $group: { _id: '$metadata.province_id', ...accumulators } }],
          summary: [{ $group: { _id: null, ...accumulators } }],
        },
      },
    ]).toArray();

    const rows = (facet?.by_province || []) as Record<string, unknown>[];
    const byId = new Map(rows.map(r => [r._id as string, r]));
    const wanted = query.provinces
      ? PROVINCES.filter(p => query.provinces!.includes(p.id))
      : PROVINCES;

    const data = wanted.map(p => {
      const raw = byId.get(p.id) || null;
      return {
        province_id: p.id,
        province: p.name,
        ...formatStats(raw),
        first_test: iso(raw?.first_test),
        last_test: iso(raw?.last_test),
      };
    });

    const summaryRaw = ((facet?.summary || []) as Record<string, unknown>[])[0] || null;

    if (query.format === 'csv') {
      const csv = toCsv(
        ['province_id', 'province', ...STATS_CSV_HEADERS, 'first_test', 'last_test'],
        data.map(row => [row.province_id, row.province, ...statsCsvRow(row), row.first_test, row.last_test]),
      );
      const name = csvFilename('speedtests-provinces', query);
      return apiCsv(csv, name, auth.headers);
    }

    return apiJson(
      {
        meta: queryMeta(query, { provinces: data.length }),
        summary: formatStats(summaryRaw),
        data,
      },
      auth.headers,
    );
  } catch (err) {
    console.error('[api/v1/speedtests/provinces]', err);
    return apiError(500, 'internal_error', 'Could not read the speed test data.', auth.headers);
  }
}
