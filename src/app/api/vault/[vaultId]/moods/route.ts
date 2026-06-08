import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { authenticateRequest } from '@/lib/api-auth';

export async function GET(req: NextRequest, { params }: { params: Promise<{ vaultId: string }> }) {
  const auth = await authenticateRequest(req);
  if (!auth.ok) return auth.response;
  const { vaultId } = await params;
  if (vaultId !== auth.vault.id) return NextResponse.json({ error: 'Vault mismatch' }, { status: 403 });

  const db = getAdminDb();
  const snap = await db.collection('vaults').doc(vaultId).get();
  if (!snap.exists) return NextResponse.json({ members: [] });
  const vault = snap.data()!;
  const members = Object.values(vault.members || {});
  return NextResponse.json({ members });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ vaultId: string }> }) {
  const auth = await authenticateRequest(req);
  if (!auth.ok) return auth.response;
  const { vaultId } = await params;
  if (vaultId !== auth.vault.id) return NextResponse.json({ error: 'Vault mismatch' }, { status: 403 });

  const body = await req.json();
  const { mood } = body;
  if (!mood) return NextResponse.json({ error: 'mood required' }, { status: 400 });

  const db = getAdminDb();
  const role = auth.member.role;
  const field = `members.${role}`;
  await db.collection('vaults').doc(vaultId).update({
    [`${field}.mood`]: mood,
    [`${field}.moodUpdatedAt`]: new Date().toISOString(),
  });

  return NextResponse.json({ member: { role, mood, moodUpdatedAt: new Date().toISOString() } });
}
