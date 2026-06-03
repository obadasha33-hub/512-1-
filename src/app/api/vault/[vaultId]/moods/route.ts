import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/api-auth';

// GET /api/vault/[vaultId]/moods
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

  const members = await db.vaultMember.findMany({
    where: { vaultId },
    select: { id: true, name: true, role: true, mood: true, moodUpdatedAt: true },
  });
  return NextResponse.json({ members });
}

// PUT /api/vault/[vaultId]/moods — auth member can only update their own mood
export async function PUT(
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
  const { mood } = body;
  if (!mood) {
    return NextResponse.json({ error: 'mood is required' }, { status: 400 });
  }

  const updated = await db.vaultMember.update({
    where: { id: auth.member.id },
    data: { mood, moodUpdatedAt: new Date() },
    select: { id: true, name: true, role: true, mood: true, moodUpdatedAt: true },
  });
  return NextResponse.json({ member: updated });
}
