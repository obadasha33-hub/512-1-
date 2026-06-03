// Next.js auth helper for use in API route handlers.
// Validates Authorization: Bearer <token> and returns { session, member, vault }.

import { NextRequest, NextResponse } from 'next/server';
import { db } from './db';

const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

export async function authenticateRequest(req: NextRequest) {
  const auth = req.headers.get('authorization') || '';
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) {
    return { ok: false as const, response: NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 }) };
  }
  const token = m[1].trim();
  if (!token) {
    return { ok: false as const, response: NextResponse.json({ error: 'Invalid token' }, { status: 401 }) };
  }
  const session = await db.session.findUnique({
    where: { token },
    include: { member: true, vault: true },
  });
  if (!session) {
    return { ok: false as const, response: NextResponse.json({ error: 'Invalid session' }, { status: 401 }) };
  }
  if (session.expiresAt.getTime() <= Date.now()) {
    await db.session.delete({ where: { id: session.id } }).catch(() => {});
    return { ok: false as const, response: NextResponse.json({ error: 'Session expired' }, { status: 401 }) };
  }
  // Sliding expiration
  const remaining = session.expiresAt.getTime() - Date.now();
  if (remaining < 15 * 24 * 60 * 60 * 1000) {
    const newExpiry = new Date(Date.now() + SESSION_DURATION_MS);
    await db.session
      .update({ where: { id: session.id }, data: { lastUsedAt: new Date(), expiresAt: newExpiry } })
      .catch(() => {});
  } else {
    await db.session.update({ where: { id: session.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
  }
  return { ok: true as const, session, member: session.member, vault: session.vault };
}
