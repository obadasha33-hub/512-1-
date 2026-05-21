import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/vault/[vaultId]/messages
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ vaultId: string }> }
) {
  try {
    const { vaultId } = await params;

    const messages = await db.message.findMany({
      where: { vaultId, deleted: false },
      include: { sender: { select: { id: true, name: true, role: true, photoUrl: true } } },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ messages });
  } catch (error) {
    console.error('[Messages GET] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }
}

// POST /api/vault/[vaultId]/messages - Send a new message
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ vaultId: string }> }
) {
  try {
    const { vaultId } = await params;
    const body = await req.json();
    const { senderId, text, imageUrl, audioUrl, videoUrl, replyToId } = body;

    if (!senderId) {
      return NextResponse.json({ error: 'senderId is required' }, { status: 400 });
    }

    // Verify sender is a member of this vault
    const sender = await db.vaultMember.findFirst({
      where: { id: senderId, vaultId },
    });

    if (!sender) {
      // Try to find the member by role
      const memberByRole = await db.vaultMember.findFirst({
        where: { vaultId, role: senderId === 'Batman' ? 'partner1' : 'partner2' },
      });

      if (!memberByRole) {
        return NextResponse.json({ error: 'Sender not found in vault' }, { status: 400 });
      }

      const message = await db.message.create({
        data: {
          vaultId,
          senderId: memberByRole.id,
          text: text || null,
          imageUrl: imageUrl || null,
          audioUrl: audioUrl || null,
          videoUrl: videoUrl || null,
          replyToId: replyToId || null,
          status: 'sent',
        },
        include: { sender: { select: { id: true, name: true, role: true, photoUrl: true } } },
      });

      return NextResponse.json({ message }, { status: 201 });
    }

    const message = await db.message.create({
      data: {
        vaultId,
        senderId,
        text: text || null,
        imageUrl: imageUrl || null,
        audioUrl: audioUrl || null,
        videoUrl: videoUrl || null,
        replyToId: replyToId || null,
        status: 'sent',
      },
      include: { sender: { select: { id: true, name: true, role: true, photoUrl: true } } },
    });

    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    console.error('[Messages POST] Error:', error);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}

// PUT /api/vault/[vaultId]/messages?msgId=xxx - Update message
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ vaultId: string }> }
) {
  try {
    const { vaultId } = await params;
    const msgId = req.nextUrl.searchParams.get('msgId');

    if (!msgId) {
      return NextResponse.json({ error: 'msgId is required' }, { status: 400 });
    }

    const body = await req.json();
    const { reactions, status, starred, replyToId } = body;

    const updateData: Record<string, any> = {};
    if (reactions !== undefined) updateData.reactions = reactions;
    if (status !== undefined) updateData.status = status;
    // Note: starred is stored in reactions JSON as a special entry since
    // the DB schema doesn't have a dedicated starred column
    if (starred !== undefined && reactions === undefined) {
      // Encode starred in status field as "starred" or "sent"/etc.
      // We'll skip DB update for starred - it stays local
    }
    if (replyToId !== undefined) updateData.replyToId = replyToId;

    const message = await db.message.update({
      where: { id: msgId },
      data: updateData,
      include: { sender: { select: { id: true, name: true, role: true, photoUrl: true } } },
    });

    return NextResponse.json({ message });
  } catch (error) {
    console.error('[Messages PUT] Error:', error);
    return NextResponse.json({ error: 'Failed to update message' }, { status: 500 });
  }
}

// DELETE /api/vault/[vaultId]/messages - Soft-delete messages
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ vaultId: string }> }
) {
  try {
    const { vaultId } = await params;
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
  } catch (error) {
    console.error('[Messages DELETE] Error:', error);
    return NextResponse.json({ error: 'Failed to delete messages' }, { status: 500 });
  }
}
