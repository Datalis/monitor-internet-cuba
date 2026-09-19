import { PROVINCE_IDS, PROVINCE_NAMES } from './provinces';

export const DEFAULT_TIMEZONE = 'America/Havana';
export const DEFAULT_RANGE_DAYS = 7;
export const MAX_RANGE_DAYS = 366;
/**
 * Retencion de la serie temporal. `null` = sin limite: no hay TTL en Mongo y los
 * datos historicos se conservan indefinidamente. Ver mongo/README.md.
 * El inicio real de la serie se expone como `first_test` en /api/v1/meta.
 */
export const RETENTION_DAYS: number | null = null;

export type RangeError = { code: string; message: string };

export type Query = {
  from: Date;
  /** Exclusive upper bound. */
  to: Date;
  timezone: string;
  provinces: string[] | null;
  includeTimedOut: boolean;
  format: 'json' | 'csv';
};

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Offset (ms) between the given instant's wall-clock time in `tz` and UTC. */
function timezoneOffsetMs(instant: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(instant);

  const get = (type: string) => Number(parts.find(p => p.type === type)?.value ?? '0');
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second'));
  return asUtc - instant.getTime();
}

/** Turn a wall-clock time in `tz` into the matching UTC instant. */
function zonedTimeToUtc(y: number, m: number, d: number, tz: string, dayOffset = 0): Date {
  const naive = Date.UTC(y, m - 1, d + dayOffset, 0, 0, 0);
  // Two passes so the result stays correct across a DST transition.
  let instant = new Date(naive - timezoneOffsetMs(new Date(naive), tz));
  instant = new Date(naive - timezoneOffsetMs(instant, tz));
  return instant;
}

/**
 * `YYYY-MM-DD` is read as a whole calendar day in `tz` — as the start of that
 * day for `from`, and as the start of the *next* day for `to`, so that the
 * requested end date is included. Full ISO 8601 timestamps are used verbatim.
 */
function parseBound(raw: string, tz: string, bound: 'from' | 'to'): Date | null {
  if (DATE_ONLY.test(raw)) {
    const [y, m, d] = raw.split('-').map(Number);
    if (m < 1 || m > 12 || d < 1 || d > 31) return null;
    const date = zonedTimeToUtc(y, m, d, tz, bound === 'to' ? 1 : 0);
    return isNaN(date.getTime()) ? null : date;
  }
  const date = new Date(raw);
  return isNaN(date.getTime()) ? null : date;
}

export function parseQuery(searchParams: URLSearchParams): { query: Query } | { error: RangeError } {
  const timezone = searchParams.get('tz')?.trim() || DEFAULT_TIMEZONE;
  if (!isValidTimezone(timezone)) {
    return { error: { code: 'invalid_timezone', message: `'${timezone}' is not a valid IANA timezone name.` } };
  }

  const format = (searchParams.get('format')?.trim().toLowerCase() || 'json');
  if (format !== 'json' && format !== 'csv') {
    return { error: { code: 'invalid_format', message: "format must be 'json' or 'csv'." } };
  }

  const rawFrom = searchParams.get('from')?.trim();
  const rawTo = searchParams.get('to')?.trim();
  const rawDays = searchParams.get('days')?.trim();

  if (rawDays && (rawFrom || rawTo)) {
    return { error: { code: 'conflicting_params', message: "Use either 'days' or 'from'/'to', not both." } };
  }

  let from: Date;
  let to: Date;

  if (rawDays) {
    const days = Number(rawDays);
    if (!Number.isInteger(days) || days < 1 || days > MAX_RANGE_DAYS) {
      return { error: { code: 'invalid_days', message: `days must be an integer between 1 and ${MAX_RANGE_DAYS}.` } };
    }
    to = new Date();
    from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
  } else {
    to = rawTo ? (parseBound(rawTo, timezone, 'to') ?? new Date(NaN)) : new Date();
    if (isNaN(to.getTime())) {
      return { error: { code: 'invalid_to', message: "to must be a date (YYYY-MM-DD) or an ISO 8601 timestamp." } };
    }
    from = rawFrom
      ? (parseBound(rawFrom, timezone, 'from') ?? new Date(NaN))
      : new Date(to.getTime() - DEFAULT_RANGE_DAYS * 24 * 60 * 60 * 1000);
    if (isNaN(from.getTime())) {
      return { error: { code: 'invalid_from', message: "from must be a date (YYYY-MM-DD) or an ISO 8601 timestamp." } };
    }
  }

  if (from >= to) {
    return { error: { code: 'invalid_range', message: 'from must be earlier than to.' } };
  }
  const spanDays = (to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000);
  if (spanDays > MAX_RANGE_DAYS) {
    return { error: { code: 'range_too_large', message: `The requested range spans more than ${MAX_RANGE_DAYS} days.` } };
  }

  let provinces: string[] | null = null;
  const rawProvince = searchParams.get('province')?.trim();
  if (rawProvince) {
    const ids = rawProvince.split(',').map(p => p.trim().toUpperCase()).filter(Boolean);
    const unknown = ids.filter(id => !PROVINCE_IDS.has(id));
    if (unknown.length > 0) {
      return {
        error: {
          code: 'unknown_province',
          message: `Unknown province code(s): ${unknown.join(', ')}. See /api/v1/meta for the list.`,
        },
      };
    }
    provinces = Array.from(new Set(ids));
  }

  const rawTimedOut = searchParams.get('include_timed_out')?.trim().toLowerCase();
  if (rawTimedOut !== undefined && rawTimedOut !== '' && !['true', 'false', '1', '0'].includes(rawTimedOut)) {
    return { error: { code: 'invalid_include_timed_out', message: 'include_timed_out must be true or false.' } };
  }
  const includeTimedOut = rawTimedOut === 'true' || rawTimedOut === '1';

  return { query: { from, to, timezone, provinces, includeTimedOut, format } };
}

export function buildMatch(query: Query): Record<string, unknown> {
  return {
    'metadata.source': 'crowdsourced',
    'metadata.province_id': query.provinces ? { $in: query.provinces } : { $ne: null },
    timestamp: { $gte: query.from, $lt: query.to },
  };
}

/**
 * $group accumulators shared by every aggregate endpoint.
 *
 * Timed-out tests are never filtered out in $match, so that every group can
 * report how many there were; they are instead nulled out of the statistics
 * unless the caller asked for them. $avg/$min/$max/$percentile all ignore
 * non-numeric input, so this matches filtering them out up front.
 */
export function statsAccumulators(includeTimedOut: boolean): Record<string, unknown> {
  const isUsable = { $ne: ['$timed_out', true] };
  const value = (field: string): unknown =>
    includeTimedOut ? `$${field}` : { $cond: [isUsable, `$${field}`, null] };
  const percentile = (field: string) => ({
    $percentile: { input: value(field), p: [0.5, 0.9], method: 'approximate' },
  });

  return {
    total_tests: { $sum: 1 },
    timed_out_tests: { $sum: { $cond: [{ $eq: ['$timed_out', true] }, 1, 0] } },
    tests: { $sum: includeTimedOut ? 1 : { $cond: [isUsable, 1, 0] } },
    dl_avg: { $avg: value('download_mbps') },
    dl_pct: percentile('download_mbps'),
    dl_min: { $min: value('download_mbps') },
    dl_max: { $max: value('download_mbps') },
    ul_avg: { $avg: value('upload_mbps') },
    ul_pct: percentile('upload_mbps'),
    ul_min: { $min: value('upload_mbps') },
    ul_max: { $max: value('upload_mbps') },
    lat_avg: { $avg: value('latency_ms') },
    lat_pct: percentile('latency_ms'),
    jitter_avg: { $avg: value('jitter_ms') },
    first_test: { $min: '$timestamp' },
    last_test: { $max: '$timestamp' },
  };
}

type RawStats = Record<string, unknown>;

function round(value: unknown, decimals: number): number | null {
  if (typeof value !== 'number' || !isFinite(value)) return null;
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

function pct(value: unknown, index: number): unknown {
  return Array.isArray(value) ? value[index] : null;
}

export type SpeedStats = {
  total_tests: number;
  tests: number;
  timed_out_tests: number;
  download_mbps: { avg: number | null; median: number | null; p90: number | null; min: number | null; max: number | null };
  upload_mbps: { avg: number | null; median: number | null; p90: number | null; min: number | null; max: number | null };
  latency_ms: { avg: number | null; median: number | null; p90: number | null };
  jitter_ms: { avg: number | null };
};

export function formatStats(raw: RawStats | null): SpeedStats {
  if (!raw) {
    return {
      total_tests: 0,
      tests: 0,
      timed_out_tests: 0,
      download_mbps: { avg: null, median: null, p90: null, min: null, max: null },
      upload_mbps: { avg: null, median: null, p90: null, min: null, max: null },
      latency_ms: { avg: null, median: null, p90: null },
      jitter_ms: { avg: null },
    };
  }
  return {
    total_tests: (raw.total_tests as number) || 0,
    tests: (raw.tests as number) || 0,
    timed_out_tests: (raw.timed_out_tests as number) || 0,
    download_mbps: {
      avg: round(raw.dl_avg, 2),
      median: round(pct(raw.dl_pct, 0), 2),
      p90: round(pct(raw.dl_pct, 1), 2),
      min: round(raw.dl_min, 2),
      max: round(raw.dl_max, 2),
    },
    upload_mbps: {
      avg: round(raw.ul_avg, 2),
      median: round(pct(raw.ul_pct, 0), 2),
      p90: round(pct(raw.ul_pct, 1), 2),
      min: round(raw.ul_min, 2),
      max: round(raw.ul_max, 2),
    },
    latency_ms: {
      avg: round(raw.lat_avg, 0),
      median: round(pct(raw.lat_pct, 0), 0),
      p90: round(pct(raw.lat_pct, 1), 0),
    },
    jitter_ms: { avg: round(raw.jitter_avg, 0) },
  };
}

export function provinceName(id: string): string {
  return PROVINCE_NAMES[id] || id;
}

export function queryMeta(query: Query, extra: Record<string, unknown> = {}) {
  return {
    source: 'crowdsourced',
    from: query.from.toISOString(),
    to: query.to.toISOString(),
    timezone: query.timezone,
    include_timed_out: query.includeTimedOut,
    retention_days: RETENTION_DAYS,
    generated_at: new Date().toISOString(),
    ...extra,
  };
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

/** `YYYY-MM-DD` for the given instant as seen in `tz`. */
function calendarDay(instant: Date, tz: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(instant);
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Names the download after the range the caller asked for, not the exclusive bound. */
export function csvFilename(prefix: string, query: Query): string {
  const first = calendarDay(query.from, query.timezone);
  const last = calendarDay(new Date(query.to.getTime() - 1), query.timezone);
  return `${prefix}_${first}_${last}.csv`;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  return [headers.join(','), ...rows.map(r => r.map(csvCell).join(','))].join('\n') + '\n';
}

export const STATS_CSV_HEADERS = [
  'total_tests', 'tests', 'timed_out_tests',
  'download_avg_mbps', 'download_median_mbps', 'download_p90_mbps', 'download_min_mbps', 'download_max_mbps',
  'upload_avg_mbps', 'upload_median_mbps', 'upload_p90_mbps', 'upload_min_mbps', 'upload_max_mbps',
  'latency_avg_ms', 'latency_median_ms', 'latency_p90_ms', 'jitter_avg_ms',
];

export function statsCsvRow(s: SpeedStats): unknown[] {
  return [
    s.total_tests, s.tests, s.timed_out_tests,
    s.download_mbps.avg, s.download_mbps.median, s.download_mbps.p90, s.download_mbps.min, s.download_mbps.max,
    s.upload_mbps.avg, s.upload_mbps.median, s.upload_mbps.p90, s.upload_mbps.min, s.upload_mbps.max,
    s.latency_ms.avg, s.latency_ms.median, s.latency_ms.p90, s.jitter_ms.avg,
  ];
}
