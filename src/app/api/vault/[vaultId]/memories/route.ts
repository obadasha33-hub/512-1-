import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/api-auth';

/**
 * HIGH-VALUE Memory API
 * Uses Prisma for reliable storage of couple's memories.
 */

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

  try {
    const memories = await db.memory.findMany({
      where: { vaultId },
      orderBy: { createdAt: 'desc' }
    });
    return NextResponse.json({ memories });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch memories' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ vaultId: string }> }) {
  const { vaultId } = await params;
  const auth = await checkAuth(req, vaultId);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const { content, imageUrl, category, revealDate } = body;
    if (!content) return NextResponse.json({ error: 'content required' }, { status: 400 });

    const memory = await db.memory.create({
      data: {
        vaultId,
        content,
        imageUrl: imageUrl || null,
        category: category || 'General',
        revealDate: revealDate ? new Date(revealDate) : null,
      }
    });

    return NextResponse.json({ memory }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create memory' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ vaultId: string }> }) {
  const { vaultId } = await params;
  const auth = await checkAuth(req, vaultId);
  if (!auth.ok) return auth.response;

  const memoryId = req.nextUrl.searchParams.get('memoryId');
  if (!memoryId) return NextResponse.json({ error: 'memoryId required' }, { status: 400 });

  try {
    const body = await req.json();
    const updateData: any = {};
    if (body.content !== undefined) updateData.content = body.content;
    if (body.imageUrl !== undefined) updateData.imageUrl = body.imageUrl;
    if (body.category !== undefined) updateData.category = body.category;
    if (body.revealDate !== undefined) updateData.revealDate = body.revealDate ? new Date(body.revealDate) : null;

    const updated = await db.memory.update({
      where: { id: memoryId, vaultId },
      data: updateData
    });
    return NextResponse.json({ memory: updated });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update memory' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ vaultId: string }> }) {
  const { vaultId } = await params;
  const auth = await checkAuth(req, vaultId);
  if (!auth.ok) return auth.response;

  const memoryId = req.nextUrl.searchParams.get('memoryId');
  if (!memoryId) return NextResponse.json({ error: 'memoryId required' }, { status: 400 });

  try {
    await db.memory.delete({
      where: { id: memoryId, vaultId }
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete memory' }, { status: 500 });
  }
}
