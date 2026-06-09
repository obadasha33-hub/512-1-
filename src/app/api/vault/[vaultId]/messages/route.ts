import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/api-auth';

/**
 * PRODUCTION-GRADE Message API
 * Uses Prisma for relational integrity and high-speed pagination.
 */

export async function GET(req: NextRequest, { params }: { params: Promise<{ vaultId: string }> }) {
  const auth = await authenticateRequest(req);
  if (!auth.ok) return auth.response;
  const { vaultId } = await params;

  if (vaultId !== auth.vault.id) {
    return NextResponse.json({ error: 'Vault mismatch' }, { status: 403 });
  }

  const limit = Math.min(Math.max(parseInt(req.nextUrl.searchParams.get('limit') || '50', 10) || 50, 1), 200);
  const cursor = req.nextUrl.searchParams.get('cursor');

  try {
    const messages = await db.message.findMany({
      where: {
        vaultId,
        deleted: false,
      },
      take: limit + 1,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        sender: {
          select: {
            id: true,
            role: true,
            name: true,
          }
        }
      }
    });

    const hasMore = messages.length > limit;
    if (hasMore) messages.pop();

    return NextResponse.json({
      messages,
      nextCursor: messages.length > 0 ? messages[messages.length - 1].id : null,
      hasMore,
    });
  } catch (error) {
    console.error('[Messages GET] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
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

    const message = await db.message.create({
      data: {
        vaultId,
        senderId: auth.member.id,
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
      },
      include: {
        sender: {
          select: {
            id: true,
            role: true,
            name: true,
          }
        }
      }
    });

    // Broadcast to partner via Socket.IO if available
    if (global.io) {
      global.io.to(vaultId).emit('new-message', message);
    }

    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    console.error('[Messages POST] Error:', error);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ vaultId: string }> }) {
  const auth = await authenticateRequest(req);
  if (!auth.ok) return auth.response;
  const { vaultId } = await params;

  if (vaultId !== auth.vault.id) {
    return NextResponse.json({ error: 'Vault mismatch' }, { status: 403 });
  }

  const msgId = req.nextUrl.searchParams.get('msgId');
  if (!msgId) return NextResponse.json({ error: 'msgId required' }, { status: 400 });

  try {
    const body = await req.json();
    const updateData: any = {};

    if (body.reactions !== undefined) updateData.reactions = body.reactions;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.starred !== undefined) updateData.starred = body.starred;

    const updated = await db.message.update({
      where: { id: msgId, vaultId },
      data: updateData,
      include: {
        sender: {
          select: { id: true, role: true, name: true }
        }
      }
    });

    return NextResponse.json({ message: updated });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update message' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ vaultId: string }> }) {
  const auth = await authenticateRequest(req);
  if (!auth.ok) return auth.response;
  const { vaultId } = await params;

  if (vaultId !== auth.vault.id) {
    return NextResponse.json({ error: 'Vault mismatch' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { msgIds } = body;

    if (!msgIds || !Array.isArray(msgIds)) {
      return NextResponse.json({ error: 'msgIds array required' }, { status: 400 });
    }

    await db.message.updateMany({
      where: {
        id: { in: msgIds },
        vaultId
      },
      data: { deleted: true }
    });

    return NextResponse.json({ success: true, count: msgIds.length });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete messages' }, { status: 500 });
  }
}
