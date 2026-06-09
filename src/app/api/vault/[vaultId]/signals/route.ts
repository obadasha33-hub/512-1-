import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/api-auth';

export async function GET(req: NextRequest, { params }: { params: Promise<{ vaultId: string }> }) {
  const auth = await authenticateRequest(req);
  if (!auth.ok) return auth.response;
  const { vaultId } = await params;

  if (vaultId !== auth.vault.id) {
    return NextResponse.json({ error: 'Vault mismatch' }, { status: 403 });
  }

  try {
    const signals = await db.signal.findMany({
      where: { vaultId },
      orderBy: { createdAt: 'desc' },
      take: 20
    });
    return NextResponse.json({ signals });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch signals' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ vaultId: string }> }) {
  const auth = await authenticateRequest(req);
  if (!auth.ok) return auth.response;
  const { vaultId } = await params;

  if (vaultId !== auth.vault.id) {
    return NextResponse.json({ error: 'Vault mismatch' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { type } = body;
    if (!type) return NextResponse.json({ error: 'type required' }, { status: 400 });

    const from = auth.member.role === 'partner1' ? 'Batman' : 'Princess';

    const signal = await db.signal.create({
      data: {
        vaultId,
        type,
        from,
      }
    });

    // Real-time broadcast to partner
    if (global.io) {
      global.io.to(vaultId).emit('signal-received', { type, from });
    }

    return NextResponse.json({ event: signal }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to send signal' }, { status: 500 });
  }
}
