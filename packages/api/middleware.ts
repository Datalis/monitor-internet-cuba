import { NextRequest, NextResponse } from 'next/server';

export const config = {
  matcher: ['/speedtest/:path*', '/api/speedtest/:path*'],
};

// Known Cuban IP ranges (ETECSA AS27725)
const CUBAN_RANGES = [
  { start: 0x98CE0000, end: 0x98CFFFFF }, // 152.206.0.0/15 (152.206.0.0 - 152.207.255.255)
  { start: 0xC1640000, end: 0xC167FFFF }, // 193.100.0.0/14
  { start: 0xA9FE0000, end: 0xA9FEFFFF }, // 169.254.0.0/16 — skip, link-local
  { start: 0xBDB40000, end: 0xBDB4FFFF }, // 189.180.0.0/16
  { start: 0x0A000000, end: 0x0AFFFFFF }, // 10.0.0.0/8 — private, allow for testing behind NAT
];

function ipToInt(ip: string): number {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) return 0;
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function isCubanIP(ip: string): boolean {
  const num = ipToInt(ip);
  if (num === 0) return false;
  return CUBAN_RANGES.some(r => num >= r.start && num <= r.end);
}

function getClientIP(request: NextRequest): string | null {
  return request.headers.get('cf-connecting-ip')
    || request.headers.get('x-real-ip')
    || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || null;
}

function isCubanRequest(request: NextRequest): boolean {
  // Method 1: Cloudflare CF-IPCountry header (most reliable when proxy is active)
  const country = request.headers.get('cf-ipcountry');
  if (country === 'CU') return true;

  // Method 2: Fallback — check IP against known Cuban ranges
  const ip = getClientIP(request);
  if (ip && isCubanIP(ip)) return true;

  return false;
}

export function middleware(request: NextRequest) {
  // Bypass in development
  if (process.env.NODE_ENV === 'development') {
    return NextResponse.next();
  }

  // Public endpoints — no geo-restriction needed
  // Stats returns aggregate data for dashboard; debug-geo is for troubleshooting
  if (request.nextUrl.pathname === '/api/speedtest/stats') {
    return NextResponse.next();
  }

  if (request.nextUrl.pathname === '/api/speedtest/debug-geo') {
    const ip = getClientIP(request);
    return NextResponse.json({
      cf_ipcountry: request.headers.get('cf-ipcountry'),
      cf_connecting_ip: request.headers.get('cf-connecting-ip'),
      x_real_ip: request.headers.get('x-real-ip'),
      x_forwarded_for: request.headers.get('x-forwarded-for'),
      detected_ip: ip,
      is_cuban_ip: ip ? isCubanIP(ip) : null,
      is_cuban_request: isCubanRequest(request),
    });
  }

  if (isCubanRequest(request)) {
    return NextResponse.next();
  }

  // API routes → 403 JSON
  if (request.nextUrl.pathname.startsWith('/api/speedtest')) {
    return NextResponse.json(
      { error: 'No disponible fuera de Cuba' },
      { status: 403 },
    );
  }

  // Page routes → redirect to blocked page (avoid redirect loop)
  if (request.nextUrl.pathname === '/speedtest/blocked') {
    return NextResponse.next();
  }

  return NextResponse.redirect(new URL('/speedtest/blocked', request.url));
}
