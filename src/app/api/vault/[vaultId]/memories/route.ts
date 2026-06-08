import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { authenticateRequest } from '@/lib/api-auth';

async function checkAuth(req: NextRequest, vaultId: string) {
  const auth = await authenticateRequest(req);
  if (!auth.ok) return auth;
  if (vaultId !== auth.vault.id) {
    return { ok: false as const, response: NextResponse.json({ error: 'Vault mismatch' }, { status: 403 }) };
  }
  return auth;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ vaultId: string }> }) {
  const { vaultId } = await params;
  const auth = await checkAuth(req, vaultId);
  if (!auth.ok) return auth.response;

  const db = getAdminDb();
  const snap = await db.collection('memories').where('vaultId', '==', vaultId).orderBy('createdAt', 'desc').get();
  const memories = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
  return NextResponse.json({ memories });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ vaultId: string }> }) {
  const { vaultId } = await params;
  const auth = await checkAuth(req, vaultId);
  if (!auth.ok) return auth.response;

  const body = await req.json();
  const { content, imageUrl, category, revealDate } = body;
  if (!content) return NextResponse.json({ error: 'content required' }, { status: 400 });

  const db = getAdminDb();
  const memoryData: any = {
    vaultId,
    content,
    imageUrl: imageUrl || null,
    category: category || 'General',
    revealDate: revealDate || null,
    createdAt: new Date().toISOString(),
  };
  const ref = await db.collection('memories').add(memoryData);
  return NextResponse.json({ memory: { id: ref.id, ...memoryData } }, { status: 201 });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ vaultId: string }> }) {
  const { vaultId } = await params;
  const auth = await checkAuth(req, vaultId);
  if (!auth.ok) return auth.response;

  const memoryId = req.nextUrl.searchParams.get('memoryId');
  if (!memoryId) return NextResponse.json({ error: 'memoryId required' }, { status: 400 });

  const body = await req.json();
  const db = getAdminDb();
  const updateData: Record<string, any> = {};
  if (body.content !== undefined) updateData.content = body.content;
  if (body.imageUrl !== undefined) updateData.imageUrl = body.imageUrl;
  if (body.category !== undefined) updateData.category = body.category;
  if (body.revealDate !== undefined) updateData.revealDate = body.revealDate;

  await db.collection('memories').doc(memoryId).update(updateData);
  const updated = await db.collection('memories').doc(memoryId).get();
  return NextResponse.json({ memory: { id: updated.id, ...updated.data() } });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ vaultId: string }> }) {
  const { vaultId } = await params;
  const auth = await checkAuth(req, vaultId);
  if (!auth.ok) return auth.response;

  const memoryId = req.nextUrl.searchParams.get('memoryId');
  if (!memoryId) return NextResponse.json({ error: 'memoryId required' }, { status: 400 });

  const db = getAdminDb();
  await db.collection('memories').doc(memoryId).delete();
  return NextResponse.json({ success: true });
}
