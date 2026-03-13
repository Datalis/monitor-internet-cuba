import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';

// Pre-generate a 5 MB random buffer (reused across requests, incompressible)
const CHUNK = randomBytes(5 * 1024 * 1024);

export async function GET(req: NextRequest) {
  const sizeParam = parseInt(req.nextUrl.searchParams.get('size') || '102400');
  const size = Math.max(1024, Math.min(sizeParam, 10 * 1024 * 1024));

  // Slice from the pre-generated buffer, or concat if larger than 5MB
  const data = size <= CHUNK.length
    ? CHUNK.subarray(0, size)
    : Buffer.concat([CHUNK, randomBytes(size - CHUNK.length)]);

  return new NextResponse(data, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Length': size.toString(),
      'Cache-Control': 'no-store',
      'Content-Encoding': 'identity',
    },
  });
}
