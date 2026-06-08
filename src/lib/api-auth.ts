import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from './firebase/admin';

export async function authenticateRequest(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || '';
  const m = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!m) {
    return { ok: false as const, response: NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 }) };
  }
  const token = m[1].trim();
  if (!token) {
    return { ok: false as const, response: NextResponse.json({ error: 'Invalid token' }, { status: 401 }) };
  }

  try {
    const db = getAdminDb();
    const snap = await db.collection('sessions').where('token', '==', token).limit(1).get();
    if (snap.empty) {
      return { ok: false as const, response: NextResponse.json({ error: 'Invalid session' }, { status: 401 }) };
    }

    const sessionDoc = snap.docs[0];
    const session = sessionDoc.data();

    if (session.expiresAt && new Date(session.expiresAt).getTime() <= Date.now()) {
      await db.collection('sessions').doc(sessionDoc.id).delete().catch(() => {});
      return { ok: false as const, response: NextResponse.json({ error: 'Session expired' }, { status: 401 }) };
    }

    // Sliding expiration: refresh if less than 15 days remaining
    const remaining = new Date(session.expiresAt).getTime() - Date.now();
    if (remaining < 15 * 24 * 60 * 60 * 1000) {
      const newExpiry = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
      await db.collection('sessions').doc(sessionDoc.id).update({ expiresAt: newExpiry, lastUsedAt: new Date().toISOString() }).catch(() => {});
    } else {
      await db.collection('sessions').doc(sessionDoc.id).update({ lastUsedAt: new Date().toISOString() }).catch(() => {});
    }

    return {
      ok: true as const,
      member: {
        id: session.memberId,
        role: session.identity === 'Batman' ? 'partner1' : 'partner2',
        identity: session.identity,
      },
      vault: {
        id: session.vaultId,
        vaultCode: session.vaultCode || '',
      },
    };
  } catch (err: any) {
    return { ok: false as const, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
}
