import { NextRequest } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { authenticate, apiJson, apiCsv, apiError, corsPreflight } from '@/lib/apiAuth';
import { PROVINCE_ORDER } from '@/lib/provinces';
import {
  parseQuery, buildMatch, statsAccumulators, formatStats, provinceName, queryMeta,
  toCsv, csvFilename, STATS_CSV_HEADERS, statsCsvRow,
} from '@/lib/speedtestApi';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function OPTIONS() {
  return corsPreflight();
}

export async function GET(req: NextRequest) {
  const auth = authenticate(req);
  if (!auth.ok) return auth.response;

  const groupBy = req.nextUrl.searchParams.get('group_by')?.trim().toLowerCase() || 'province';
  if (groupBy !== 'province' && groupBy !== 'country') {
    return apiError(400, 'invalid_group_by', "group_by must be 'province' or 'country'.", auth.headers);
  }

  const parsed = parseQuery(req.nextUrl.searchParams);
  if ('error' in parsed) return apiError(400, parsed.error.code, parsed.error.message, auth.headers);
  const query = parsed.query;

  try {
    const day = { $dateToString: { format: '%Y-%m-%d', date: '$timestamp', timezone: query.timezone } };
    const groupId: Record<string, unknown> = groupBy === 'province'
      ? { date: day, province_id: '$metadata.province_id' }
      : { date: day };

    const db = await getDb();
    const rows = await db.collection('metrics').aggregate([
      { $match: buildMatch(query) },
      { $group: { _id: groupId, ...statsAccumulators(query.includeTimedOut) } },
    ]).toArray();

    const data = rows
      .map(raw => {
        const id = raw._id as { date: string; province_id?: string };
        return {
          date: id.date,
          ...(groupBy === 'province'
            ? { province_id: id.province_id!, province: provinceName(id.province_id!) }
            : {}),
          ...formatStats(raw),
        };
      })
      .sort((a, b) => {
        if (a.date !== b.date) return a.date < b.date ? -1 : 1;
        const pa = PROVINCE_ORDER[(a as { province_id?: string }).province_id ?? ''] ?? 0;
        const pb = PROVINCE_ORDER[(b as { province_id?: string }).province_id ?? ''] ?? 0;
        return pa - pb;
      });

    if (query.format === 'csv') {
      const headers = groupBy === 'province'
        ? ['date', 'province_id', 'province', ...STATS_CSV_HEADERS]
        : ['date', ...STATS_CSV_HEADERS];
      const csv = toCsv(
        headers,
        data.map(row => groupBy === 'province'
          ? [row.date, (row as { province_id?: string }).province_id, (row as { province?: string }).province, ...statsCsvRow(row)]
          : [row.date, ...statsCsvRow(row)]),
      );
      const name = csvFilename('speedtests-daily', query);
      return apiCsv(csv, name, auth.headers);
    }

    return apiJson(
      { meta: queryMeta(query, { group_by: groupBy, rows: data.length }), data },
      auth.headers,
    );
  } catch (err) {
    console.error('[api/v1/speedtests/daily]', err);
    return apiError(500, 'internal_error', 'Could not read the speed test data.', auth.headers);
  }
}
