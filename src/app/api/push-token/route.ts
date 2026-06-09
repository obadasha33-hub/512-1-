import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/api-auth';

/**
 * HIGH-VALUE Push Token API
 * Synchronizes partner device tokens in the relational database.
 */

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const { token } = body;

    if (!token || typeof token !== 'string') {
      return NextResponse.json({ error: 'Token required' }, { status: 400 });
    }

    // Save token to the specific member using Prisma
    await db.vaultMember.update({
      where: { id: auth.member.id },
      data: { pushToken: token }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[Push Token POST] Error:', error);
    return NextResponse.json({ error: 'Failed to register token' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth.ok) return auth.response;

  try {
    await db.vaultMember.update({
      where: { id: auth.member.id },
      data: { pushToken: null }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to unregister token' }, { status: 500 });
  }
}
