import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/api-auth';

// GET /api/vault/[vaultId]/messages — requires auth
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

  const messages = await db.message.findMany({
    where: { vaultId, deleted: false },
    include: { sender: { select: { id: true, name: true, role: true, photoUrl: true } } },
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json({ messages });
}

// POST /api/vault/[vaultId]/messages — requires auth; sender is the auth member
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
  const { text, imageUrl, audioUrl, videoUrl, documentUrl, replyToId, replyToText, replyToSender, messageType, fileName, fileSize } = body;

  const message = await db.message.create({
    data: {
      vaultId,
      senderId: auth.member.id,
      text: text || null,
      imageUrl: imageUrl || null,
      audioUrl: audioUrl || null,
      videoUrl: videoUrl || null,
      documentUrl: documentUrl || null,
      replyToId: replyToId || null,
      replyToText: replyToText || null,
      replyToSender: replyToSender || null,
      messageType: messageType || 'text',
      fileName: fileName || null,
      fileSize: fileSize || null,
      status: 'sent',
    },
    include: { sender: { select: { id: true, name: true, role: true, photoUrl: true } } },
  });

  return NextResponse.json({ message }, { status: 201 });
}

// PUT /api/vault/[vaultId]/messages?msgId=xxx — requires auth
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

  const msgId = req.nextUrl.searchParams.get('msgId');
  if (!msgId) {
    return NextResponse.json({ error: 'msgId is required' }, { status: 400 });
  }

  const body = await req.json();
  const { reactions, status, starred, replyToId } = body;

  // Confirm the message belongs to this vault before updating
  const existing = await db.message.findUnique({ where: { id: msgId } });
  if (!existing || existing.vaultId !== vaultId) {
    return NextResponse.json({ error: 'Message not found' }, { status: 404 });
  }

  const updateData: Record<string, any> = {};
  if (reactions !== undefined) updateData.reactions = reactions;
  if (status !== undefined) updateData.status = status;
  if (starred !== undefined) updateData.starred = starred;
  if (replyToId !== undefined) updateData.replyToId = replyToId;

  const message = await db.message.update({
    where: { id: msgId },
    data: updateData,
    include: { sender: { select: { id: true, name: true, role: true, photoUrl: true } } },
  });

  return NextResponse.json({ message });
}

// DELETE /api/vault/[vaultId]/messages — requires auth; soft-deletes messages
export async function DELETE(
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
  const { msgIds } = body;
  if (!msgIds || !Array.isArray(msgIds) || msgIds.length === 0) {
    return NextResponse.json({ error: 'msgIds array is required' }, { status: 400 });
  }

  const result = await db.message.updateMany({
    where: { id: { in: msgIds }, vaultId },
    data: { deleted: true },
  });

  return NextResponse.json({ count: result.count });
}
