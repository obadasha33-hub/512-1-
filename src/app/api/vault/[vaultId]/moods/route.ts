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
    const vault = await db.vault.findUnique({
      where: { id: vaultId },
      include: { members: true }
    });

    if (!vault) return NextResponse.json({ members: [] });
    return NextResponse.json({ members: vault.members });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch moods' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ vaultId: string }> }) {
  const auth = await authenticateRequest(req);
  if (!auth.ok) return auth.response;
  const { vaultId } = await params;

  if (vaultId !== auth.vault.id) {
    return NextResponse.json({ error: 'Vault mismatch' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { mood } = body;
    if (!mood) return NextResponse.json({ error: 'mood required' }, { status: 400 });

    const updatedMember = await db.vaultMember.update({
      where: { id: auth.member.id },
      data: {
        mood,
        moodUpdatedAt: new Date()
      }
    });

    // Notify partner via Socket.IO
    if (global.io) {
      global.io.to(vaultId).emit('mood-updated', {
        identity: auth.member.role === 'partner1' ? 'Batman' : 'Princess',
        mood
      });
    }

    return NextResponse.json({ member: updatedMember });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update mood' }, { status: 500 });
  }
}
