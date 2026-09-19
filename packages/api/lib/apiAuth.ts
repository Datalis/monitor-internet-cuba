import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';

/**
 * API-key auth for the public v1 API (/api/v1/*).
 *
 * Keys live in the PUBLIC_API_KEYS env var as a comma-separated list of
 * `label:key` pairs, e.g.
 *
 *   PUBLIC_API_KEYS=eltoque:mic_live_a1b2...,partner:mic_live_c3d4...
 *
 * The label is only used for logging and rate-limit bucketing; it is never
 * returned to the caller.
 */

type ApiClient = { label: string; key: string };

const RATE_LIMIT = Math.max(1, parseInt(process.env.PUBLIC_API_RATE_LIMIT || '120', 10));
const RATE_WINDOW_MS = 60 * 1000;

function loadClients(): ApiClient[] {
  return (process.env.PUBLIC_API_KEYS || '')
    .split(',')
    .map(entry => entry.trim())
    .filter(Boolean)
    .map(entry => {
      const sep = entry.indexOf(':');
      if (sep === -1) return { label: 'unlabeled', key: entry };
      return { label: entry.slice(0, sep).trim() || 'unlabeled', key: entry.slice(sep + 1).trim() };
    })
    .filter(c => c.key.length >= 8);
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function extractKey(req: NextRequest): string | null {
  const header = req.headers.get('x-api-key');
  if (header) return header.trim();

  const auth = req.headers.get('authorization');
  if (auth) {
    const match = /^Bearer\s+(.+)$/i.exec(auth.trim());
    if (match) return match[1].trim();
  }

  return req.nextUrl.searchParams.get('api_key')?.trim() || null;
}

// Fixed-window rate limiter, per key. Single-instance deployment, so an
// in-memory counter is enough.
const hits = new Map<string, { count: number; resetAt: number }>();

function rateLimit(label: string): { ok: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = hits.get(label);

  if (!entry || entry.resetAt <= now) {
    const resetAt = now + RATE_WINDOW_MS;
    hits.set(label, { count: 1, resetAt });
    return { ok: true, remaining: RATE_LIMIT - 1, resetAt };
  }

  entry.count += 1;
  return {
    ok: entry.count <= RATE_LIMIT,
    remaining: Math.max(0, RATE_LIMIT - entry.count),
    resetAt: entry.resetAt,
  };
}

// Drop stale buckets so the map cannot grow unbounded.
setInterval(() => {
  const now = Date.now();
  for (const [label, entry] of hits) {
    if (entry.resetAt <= now) hits.delete(label);
  }
}, 5 * RATE_WINDOW_MS).unref?.();

export const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-API-Key, Authorization',
  'Access-Control-Max-Age': '86400',
};

export function apiError(
  status: number,
  code: string,
  message: string,
  extra: Record<string, string> = {},
): NextResponse {
  return NextResponse.json(
    { error: { code, message } },
    { status, headers: { ...CORS_HEADERS, ...extra } },
  );
}

export function apiJson(body: unknown, extra: Record<string, string> = {}): NextResponse {
  return NextResponse.json(body, {
    headers: {
      ...CORS_HEADERS,
      'Cache-Control': 'private, max-age=300',
      ...extra,
    },
  });
}

export function apiCsv(csv: string, filename: string, extra: Record<string, string> = {}): NextResponse {
  return new NextResponse(csv, {
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, max-age=300',
      ...extra,
    },
  });
}

export type AuthResult =
  | { ok: true; label: string; headers: Record<string, string> }
  | { ok: false; response: NextResponse };

export function authenticate(req: NextRequest): AuthResult {
  const clients = loadClients();
  if (clients.length === 0) {
    console.error('[api/v1] PUBLIC_API_KEYS is not configured — rejecting request');
    return {
      ok: false,
      response: apiError(503, 'not_configured', 'The API is not accepting keys yet. Contact the maintainers.'),
    };
  }

  const provided = extractKey(req);
  if (!provided) {
    return {
      ok: false,
      response: apiError(
        401,
        'missing_api_key',
        'Provide your API key in the X-API-Key header (or Authorization: Bearer <key>, or ?api_key=<key>).',
      ),
    };
  }

  const client = clients.find(c => safeEqual(c.key, provided));
  if (!client) {
    return { ok: false, response: apiError(401, 'invalid_api_key', 'The API key provided is not valid.') };
  }

  const limit = rateLimit(client.label);
  const headers = {
    'X-RateLimit-Limit': String(RATE_LIMIT),
    'X-RateLimit-Remaining': String(limit.remaining),
    'X-RateLimit-Reset': String(Math.ceil(limit.resetAt / 1000)),
  };

  if (!limit.ok) {
    const retryAfter = Math.max(1, Math.ceil((limit.resetAt - Date.now()) / 1000));
    return {
      ok: false,
      response: apiError(429, 'rate_limited', `Rate limit of ${RATE_LIMIT} requests per minute exceeded.`, {
        ...headers,
        'Retry-After': String(retryAfter),
      }),
    };
  }

  return { ok: true, label: client.label, headers };
}

export function corsPreflight(): NextResponse {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
