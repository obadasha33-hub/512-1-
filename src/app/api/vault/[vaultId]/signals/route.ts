import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/vault/[vaultId]/signals - Get recent signals
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ vaultId: string }> }
) {
  try {
    const { vaultId } = await params;

    const events = await db.sanctuaryEvent.findMany({
      where: { vaultId, type: 'signal' },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    // Parse signal data from title
    const signals = events.map((e) => {
      try {
        return JSON.parse(e.title);
      } catch {
        return { type: 'miss', from: 'unknown', timestamp: e.createdAt };
      }
    });

    return NextResponse.json({ signals });
  } catch (error) {
    console.error('[Signals GET] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch signals' }, { status: 500 });
  }
}

// POST /api/vault/[vaultId]/signals - Send a signal
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ vaultId: string }> }
) {
  try {
    const { vaultId } = await params;
    const body = await req.json();
    const { type, senderId } = body;

    if (!type || !senderId) {
      return NextResponse.json({ error: 'type and senderId are required' }, { status: 400 });
    }

    // Store signal as a SanctuaryEvent with type 'signal'
    const signalData = JSON.stringify({ type, from: senderId, timestamp: new Date().toISOString() });
    const event = await db.sanctuaryEvent.create({
      data: {
        vaultId,
        title: signalData,
        type: 'signal',
        date: new Date(),
      },
    });

    return NextResponse.json({ event: { type, from: senderId, timestamp: new Date().toISOString(), id: event.id } }, { status: 201 });
  } catch (error) {
    console.error('[Signals POST] Error:', error);
    return NextResponse.json({ error: 'Failed to send signal' }, { status: 500 });
  }
}
