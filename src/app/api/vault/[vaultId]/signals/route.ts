import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { authenticateRequest } from '@/lib/api-auth';

export async function GET(req: NextRequest, { params }: { params: Promise<{ vaultId: string }> }) {
  const auth = await authenticateRequest(req);
  if (!auth.ok) return auth.response;
  const { vaultId } = await params;
  if (vaultId !== auth.vault.id) return NextResponse.json({ error: 'Vault mismatch' }, { status: 403 });

  const db = getAdminDb();
  const snap = await db.collection('signals').where('vaultId', '==', vaultId).orderBy('createdAt', 'desc').limit(20).get();
  const signals = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
  return NextResponse.json({ signals });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ vaultId: string }> }) {
  const auth = await authenticateRequest(req);
  if (!auth.ok) return auth.response;
  const { vaultId } = await params;
  if (vaultId !== auth.vault.id) return NextResponse.json({ error: 'Vault mismatch' }, { status: 403 });

  const body = await req.json();
  const { type } = body;
  if (!type) return NextResponse.json({ error: 'type required' }, { status: 400 });

  const from = auth.member.role === 'partner1' ? 'Batman' : 'Princess';
  const db = getAdminDb();
  const signalData = {
    vaultId,
    type,
    from,
    createdAt: new Date().toISOString(),
  };
  const ref = await db.collection('signals').add(signalData);
  return NextResponse.json({ event: { id: ref.id, ...signalData } }, { status: 201 });
}
