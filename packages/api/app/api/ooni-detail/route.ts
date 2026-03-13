import { NextRequest, NextResponse } from 'next/server';

const OONI_API = 'https://api.ooni.org/api/v1/aggregation';

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get('date');
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'Invalid date parameter (expected YYYY-MM-DD)' }, { status: 400 });
  }

  const nextDay = new Date(date + 'T00:00:00Z');
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  const until = nextDay.toISOString().split('T')[0];

  const url = `${OONI_API}?probe_cc=CU&test_name=web_connectivity&since=${date}&until=${until}&axis_x=input`;

  try {
    const res = await fetch(url, { next: { revalidate: 300 } });
    if (!res.ok) throw new Error(`OONI API returned ${res.status}`);
    const json = await res.json();

    const data = (json.result || []).map((row: Record<string, unknown>) => ({
      input: row.input || 'unknown',
      measurement_count: row.measurement_count || 0,
      ok_count: row.ok_count ?? 0,
      confirmed_count: row.confirmed_count ?? 0,
      anomaly_count: row.anomaly_count ?? 0,
      failure_count: row.failure_count ?? 0,
    }));

    data.sort((a: { confirmed_count: number; anomaly_count: number }, b: { confirmed_count: number; anomaly_count: number }) =>
      (b.confirmed_count + b.anomaly_count) - (a.confirmed_count + a.anomaly_count)
    );

    return NextResponse.json({ count: data.length, data });
  } catch (err) {
    console.error('[OONI-detail] Error:', err);
    return NextResponse.json({ error: 'Failed to fetch OONI data' }, { status: 502 });
  }
}
