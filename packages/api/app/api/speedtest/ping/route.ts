import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    { t: Date.now() },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
