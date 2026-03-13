import { NextRequest, NextResponse } from 'next/server';

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

export async function POST(req: NextRequest) {
  const contentLength = parseInt(req.headers.get('content-length') || '0');
  if (contentLength > MAX_SIZE) {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
  }

  const body = await req.arrayBuffer();

  return NextResponse.json(
    { received: body.byteLength, t: Date.now() },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
