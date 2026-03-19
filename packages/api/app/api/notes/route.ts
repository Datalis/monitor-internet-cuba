import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const type = searchParams.get('type'); // 'weekly' | 'outage' | null (all)
  const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50);

  const filter: Record<string, unknown> = {};
  if (type) filter.type = type;

  const db = await getDb();
  const notes = await db
    .collection('notes')
    .find(filter)
    .sort({ generated_at: -1 })
    .limit(limit)
    .toArray();

  return NextResponse.json({ count: notes.length, data: notes });
}
