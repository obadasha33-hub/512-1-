import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/api-auth';

async function checkAuth(req: NextRequest, vaultId: string) {
  const auth = await authenticateRequest(req);
  if (!auth.ok) return auth;
  if (vaultId !== auth.vault.id) {
    return { ok: false as const, response: NextResponse.json({ error: 'Vault mismatch with session' }, { status: 403 }) };
  }
  return auth;
}

// GET /api/vault/[vaultId]/memories
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ vaultId: string }> }
) {
  const { vaultId } = await params;
  const auth = await checkAuth(req, vaultId);
  if (!auth.ok) return auth.response;

  const memories = await db.memory.findMany({
    where: { vaultId },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json({ memories });
}

// POST /api/vault/[vaultId]/memories
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ vaultId: string }> }
) {
  const { vaultId } = await params;
  const auth = await checkAuth(req, vaultId);
  if (!auth.ok) return auth.response;

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
}

// PUT /api/vault/[vaultId]/memories?memoryId=xxx
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ vaultId: string }> }
) {
  const { vaultId } = await params;
  const auth = await checkAuth(req, vaultId);
  if (!auth.ok) return auth.response;

  const memoryId = req.nextUrl.searchParams.get('memoryId');
  if (!memoryId) {
    return NextResponse.json({ error: 'memoryId is required' }, { status: 400 });
  }

  const existing = await db.memory.findUnique({ where: { id: memoryId } });
  if (!existing || existing.vaultId !== vaultId) {
    return NextResponse.json({ error: 'Memory not found' }, { status: 404 });
  }

  const body = await req.json();
  const { content, imageUrl, category, revealDate } = body;

  const updateData: Record<string, any> = {};
  if (content !== undefined) updateData.content = content;
  if (imageUrl !== undefined) updateData.imageUrl = imageUrl;
  if (category !== undefined) updateData.category = category;
  if (revealDate !== undefined) updateData.revealDate = revealDate ? new Date(revealDate) : null;

  const memory = await db.memory.update({ where: { id: memoryId }, data: updateData });
  return NextResponse.json({ memory });
}

// DELETE /api/vault/[vaultId]/memories?memoryId=xxx
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ vaultId: string }> }
) {
  const { vaultId } = await params;
  const auth = await checkAuth(req, vaultId);
  if (!auth.ok) return auth.response;

  const memoryId = req.nextUrl.searchParams.get('memoryId');
  if (!memoryId) {
    return NextResponse.json({ error: 'memoryId is required' }, { status: 400 });
  }

  const existing = await db.memory.findUnique({ where: { id: memoryId } });
  if (!existing || existing.vaultId !== vaultId) {
    return NextResponse.json({ error: 'Memory not found' }, { status: 404 });
  }

  await db.memory.delete({ where: { id: memoryId } });
  return NextResponse.json({ success: true });
}
