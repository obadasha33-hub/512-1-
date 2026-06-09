import { NextRequest, NextResponse } from 'next/server';
import { db } from './db';

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
    // Look up session in Prisma (matching auth-routes.js behavior)
    const session = await db.session.findUnique({
      where: { token },
      include: { member: true, vault: true },
    });

    if (!session) {
      return { ok: false as const, response: NextResponse.json({ error: 'Invalid session' }, { status: 401 }) };
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      // Expired — clean up
      await db.session.delete({ where: { id: session.id } }).catch(() => {});
      return { ok: false as const, response: NextResponse.json({ error: 'Session expired' }, { status: 401 }) };
    }

    // Update last used and sliding expiration (if more than half the session duration elapsed)
    const remaining = session.expiresAt.getTime() - Date.now();
    const HALF_SESSION = 15 * 24 * 60 * 60 * 1000; // Half of 30-day session
    if (remaining < HALF_SESSION) {
      const newExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await db.session
        .update({ where: { id: session.id }, data: { lastUsedAt: new Date(), expiresAt: newExpiry } })
        .catch(() => {});
    } else {
      await db.session.update({ where: { id: session.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
    }

    return {
      ok: true as const,
      member: {
        id: session.member.id,
        role: session.member.role,
        identity: session.member.role === 'partner1' ? 'Batman' : 'Princess',
      },
      vault: {
        id: session.vault.id,
        vaultCode: session.vault.vaultCode || '',
      },
    };
  } catch (err: any) {
    console.error('[Auth] Error:', err);
    return { ok: false as const, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
}