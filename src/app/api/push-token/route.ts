import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { authenticateRequest } from '@/lib/api-auth';

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth.ok) return auth.response;
  try {
    const body = await request.json();
    const { token } = body;
    if (!token || typeof token !== 'string') {
      return NextResponse.json({ error: 'Token required' }, { status: 400 });
    }
    const db = getAdminDb();
    const role = auth.member.role;
    await db.collection('vaults').doc(auth.vault.id).update({
      [`members.${role}.pushToken`]: token,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Push token save error:', error);
    return NextResponse.json({ error: 'Failed to save push token' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth.ok) return auth.response;
  try {
    const db = getAdminDb();
    const role = auth.member.role;
    await db.collection('vaults').doc(auth.vault.id).update({
      [`members.${role}.pushToken`]: null,
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Failed to clear push token' }, { status: 500 });
  }
}
