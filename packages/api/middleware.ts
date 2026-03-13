import { NextRequest, NextResponse } from 'next/server';

export const config = {
  matcher: ['/speedtest/:path*', '/api/speedtest/:path*'],
};

export function middleware(request: NextRequest) {
  // Bypass in development
  if (process.env.NODE_ENV === 'development') {
    return NextResponse.next();
  }

  const country = request.headers.get('cf-ipcountry');

  if (country === 'CU') {
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
