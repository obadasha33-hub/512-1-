import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { authenticateRequest } from '@/lib/api-auth';

export async function GET(req: NextRequest, { params }: { params: Promise<{ vaultId: string }> }) {
  const auth = await authenticateRequest(req);
  if (!auth.ok) return auth.response;
  const { vaultId } = await params;
  if (vaultId !== auth.vault.id) return NextResponse.json({ error: 'Vault mismatch' }, { status: 403 });

  const db = getAdminDb();
  const limit = Math.min(Math.max(parseInt(req.nextUrl.searchParams.get('limit') || '50', 10) || 50, 1), 200);
  const cursor = req.nextUrl.searchParams.get('cursor');

  let query: any = db.collection('messages').where('vaultId', '==', vaultId).where('deleted', '==', false).orderBy('createdAt', 'desc');
  if (cursor) {
    const cursorDoc = await db.collection('messages').doc(cursor).get();
    if (cursorDoc.exists) {
      query = query.startAfter(cursorDoc);
    }
  }
  const snap = await query.limit(limit + 1).get();
  const messages = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
  const hasMore = messages.length > limit;
  if (hasMore) messages.pop();

  return NextResponse.json({
    messages,
    nextCursor: messages.length > 0 ? messages[messages.length - 1].id : null,
    hasMore,
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ vaultId: string }> }) {
  const auth = await authenticateRequest(req);
  if (!auth.ok) return auth.response;
  const { vaultId } = await params;
  if (vaultId !== auth.vault.id) return NextResponse.json({ error: 'Vault mismatch' }, { status: 403 });

  const body = await req.json();
  const db = getAdminDb();
  const msgData: any = {
    vaultId,
    senderId: auth.member.id,
    senderRole: auth.member.role,
    text: body.text || null,
    imageUrl: body.imageUrl || null,
    audioUrl: body.audioUrl || null,
    videoUrl: body.videoUrl || null,
    documentUrl: body.documentUrl || null,
    replyToId: body.replyToId || null,
    replyToText: body.replyToText || null,
    replyToSender: body.replyToSender || null,
    messageType: body.messageType || 'text',
    fileName: body.fileName || null,
    fileSize: body.fileSize || null,
    status: 'sent',
    reactions: '[]',
    starred: false,
    deleted: false,
    createdAt: new Date().toISOString(),
  };

  const ref = await db.collection('messages').add(msgData);
  return NextResponse.json({ message: { id: ref.id, ...msgData } }, { status: 201 });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ vaultId: string }> }) {
  const auth = await authenticateRequest(req);
  if (!auth.ok) return auth.response;
  const { vaultId } = await params;
  if (vaultId !== auth.vault.id) return NextResponse.json({ error: 'Vault mismatch' }, { status: 403 });

  const msgId = req.nextUrl.searchParams.get('msgId');
  if (!msgId) return NextResponse.json({ error: 'msgId required' }, { status: 400 });

  const body = await req.json();
  const db = getAdminDb();
  const updateData: Record<string, any> = {};
  if (body.reactions !== undefined) updateData.reactions = body.reactions;
  if (body.status !== undefined) updateData.status = body.status;
  if (body.starred !== undefined) updateData.starred = body.starred;
  if (body.replyToId !== undefined) updateData.replyToId = body.replyToId;

  await db.collection('messages').doc(msgId).update(updateData);
  const updated = await db.collection('messages').doc(msgId).get();
  return NextResponse.json({ message: { id: updated.id, ...updated.data() } });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ vaultId: string }> }) {
  const auth = await authenticateRequest(req);
  if (!auth.ok) return auth.response;
  const { vaultId } = await params;
  if (vaultId !== auth.vault.id) return NextResponse.json({ error: 'Vault mismatch' }, { status: 403 });

  const body = await req.json();
  const { msgIds } = body;
  if (!msgIds || !Array.isArray(msgIds) || msgIds.length === 0) {
    return NextResponse.json({ error: 'msgIds required' }, { status: 400 });
  }

  const db = getAdminDb();
  const batch = db.batch();
  for (const id of msgIds) {
    batch.update(db.collection('messages').doc(id), { deleted: true });
  }
  await batch.commit();
  return NextResponse.json({ count: msgIds.length });
}
