import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/vault/[vaultId]/moods
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ vaultId: string }> }
) {
  try {
    const { vaultId } = await params;

    const members = await db.vaultMember.findMany({
      where: { vaultId },
      select: { id: true, name: true, role: true, mood: true, moodUpdatedAt: true },
    });

    return NextResponse.json({ members });
  } catch (error) {
    console.error('[Moods GET] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch moods' }, { status: 500 });
  }
}

// PUT /api/vault/[vaultId]/moods - Update a member's mood
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ vaultId: string }> }
) {
  try {
    const { vaultId } = await params;
    const body = await req.json();
    const { memberId, mood } = body;

    if (!memberId || !mood) {
      return NextResponse.json({ error: 'memberId and mood are required' }, { status: 400 });
    }

    // Try to find member by id or by role
    let member = await db.vaultMember.findFirst({
      where: { id: memberId, vaultId },
    });

    if (!member) {
      // Try by role
      member = await db.vaultMember.findFirst({
        where: { vaultId, role: memberId === 'Batman' ? 'partner1' : 'partner2' },
      });
    }

    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    const updated = await db.vaultMember.update({
      where: { id: member.id },
      data: { mood, moodUpdatedAt: new Date() },
      select: { id: true, name: true, role: true, mood: true, moodUpdatedAt: true },
    });

    return NextResponse.json({ member: updated });
  } catch (error) {
    console.error('[Moods PUT] Error:', error);
    return NextResponse.json({ error: 'Failed to update mood' }, { status: 500 });
  }
}
