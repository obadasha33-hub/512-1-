import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/api-auth';

// GET /api/vault/[vaultId]/signals
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ vaultId: string }> }
) {
  const auth = await authenticateRequest(req);
  if (!auth.ok) return auth.response;
  const { vaultId } = await params;
  if (vaultId !== auth.vault.id) {
    return NextResponse.json({ error: 'Vault mismatch with session' }, { status: 403 });
  }

  const events = await db.sanctuaryEvent.findMany({
    where: { vaultId, type: 'signal' },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  const signals = events.map((e) => {
    try {
      return JSON.parse(e.title);
    } catch {
      return { type: 'miss', from: 'unknown', timestamp: e.createdAt };
    }
  });
  return NextResponse.json({ signals });
}

// POST /api/vault/[vaultId]/signals
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ vaultId: string }> }
) {
  const auth = await authenticateRequest(req);
  if (!auth.ok) return auth.response;
  const { vaultId } = await params;
  if (vaultId !== auth.vault.id) {
    return NextResponse.json({ error: 'Vault mismatch with session' }, { status: 403 });
  }

  const body = await req.json();
  const { type } = body;
  if (!type) {
    return NextResponse.json({ error: 'type is required' }, { status: 400 });
  }

  const senderRole = auth.member.role;
  const from = senderRole === 'partner1' ? 'Batman' : 'Princess';
  const signalData = JSON.stringify({ type, from, timestamp: new Date().toISOString() });
  const event = await db.sanctuaryEvent.create({
    data: { vaultId, title: signalData, type: 'signal', date: new Date() },
  });
  return NextResponse.json(
    { event: { type, from, timestamp: new Date().toISOString(), id: event.id } },
    { status: 201 }
  );
}
