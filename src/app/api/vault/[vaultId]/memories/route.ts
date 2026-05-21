import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/vault/[vaultId]/memories
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ vaultId: string }> }
) {
  try {
    const { vaultId } = await params;

    const memories = await db.memory.findMany({
      where: { vaultId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ memories });
  } catch (error) {
    console.error('[Memories GET] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch memories' }, { status: 500 });
  }
}

// POST /api/vault/[vaultId]/memories - Add a new memory
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ vaultId: string }> }
) {
  try {
    const { vaultId } = await params;
    const body = await req.json();
    const { content, imageUrl, category, revealDate } = body;

    if (!content) {
      return NextResponse.json({ error: 'content is required' }, { status: 400 });
    }

    const memory = await db.memory.create({
      data: {
        vaultId,
        content,
        imageUrl: imageUrl || null,
        category: category || 'General',
        revealDate: revealDate ? new Date(revealDate) : null,
      },
    });

    return NextResponse.json({ memory }, { status: 201 });
  } catch (error) {
    console.error('[Memories POST] Error:', error);
    return NextResponse.json({ error: 'Failed to add memory' }, { status: 500 });
  }
}

// PUT /api/vault/[vaultId]/memories?memoryId=xxx - Update memory
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ vaultId: string }> }
) {
  try {
    const { vaultId } = await params;
    const memoryId = req.nextUrl.searchParams.get('memoryId');

    if (!memoryId) {
      return NextResponse.json({ error: 'memoryId is required' }, { status: 400 });
    }

    const body = await req.json();
    const { content, imageUrl, category, revealDate } = body;

    const updateData: Record<string, any> = {};
    if (content !== undefined) updateData.content = content;
    if (imageUrl !== undefined) updateData.imageUrl = imageUrl;
    if (category !== undefined) updateData.category = category;
    if (revealDate !== undefined) updateData.revealDate = revealDate ? new Date(revealDate) : null;

    const memory = await db.memory.update({
      where: { id: memoryId },
      data: updateData,
    });

    return NextResponse.json({ memory });
  } catch (error) {
    console.error('[Memories PUT] Error:', error);
    return NextResponse.json({ error: 'Failed to update memory' }, { status: 500 });
  }
}

// DELETE /api/vault/[vaultId]/memories?memoryId=xxx - Delete memory
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ vaultId: string }> }
) {
  try {
    const { vaultId } = await params;
    const memoryId = req.nextUrl.searchParams.get('memoryId');

    if (!memoryId) {
      return NextResponse.json({ error: 'memoryId is required' }, { status: 400 });
    }

    await db.memory.delete({
      where: { id: memoryId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Memories DELETE] Error:', error);
    return NextResponse.json({ error: 'Failed to delete memory' }, { status: 500 });
  }
}
