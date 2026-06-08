import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { generateVaultCode, generateSanctuaryVaultId, generateToken } from '@/lib/firebase/crypto';

const VALID_IDENTITIES = ['Batman', 'Princess'] as const;
const PARTNER_ROLE: Record<string, string> = { Batman: 'partner1', Princess: 'partner2' };

function sanitizeName(s: string, max = 50): string | null {
  if (typeof s !== 'string') return null;
  const t = s.trim();
  if (!t || t.length > max) return null;
  return t;
}

const SESSION_DURATION_MS = 365 * 24 * 60 * 60 * 1000;

export async function POST(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  if (pathname.endsWith('/create')) return handleCreate(req);
  if (pathname.endsWith('/join')) return handleJoin(req);
  if (pathname.endsWith('/login')) return handleLogin(req);
  if (pathname.endsWith('/lock')) return handleLock(req);
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

async function handleCreate(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, theme, font, startDate, identity, memberName } = body;
    if (!VALID_IDENTITIES.includes(identity)) {
      return NextResponse.json({ error: 'identity must be "Batman" or "Princess"' }, { status: 400 });
    }

    const safeName = sanitizeName(memberName) || identity;
    const safeVaultName = sanitizeName(name, 100) || 'Our Sanctuary';
    const db = getAdminDb();

    let vaultCode = generateVaultCode();
    for (let i = 0; i < 5; i++) {
      const snap = await db.collection('vaults').where('vaultCode', '==', vaultCode).limit(1).get();
      if (snap.empty) break;
      vaultCode = generateVaultCode();
    }

    const vaultId = generateSanctuaryVaultId();
    const memberId = generateSanctuaryVaultId();
    const role = PARTNER_ROLE[identity];

    await db.collection('vaults').doc(vaultId).set({
      id: vaultId, vaultCode, name: safeVaultName,
      theme: theme || 'Pinky', font: font || 'Default',
      startDate: startDate ? new Date(startDate).toISOString() : new Date().toISOString(),
      createdAt: new Date().toISOString(),
      batmanName: identity === 'Batman' ? safeName : 'Batman',
      princessName: identity === 'Princess' ? safeName : 'Princess',
      members: {
        [role]: { id: memberId, name: safeName, role, photoUrl: '', mood: '', moodUpdatedAt: null },
      },
    });

    const token = generateToken();
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();
    await db.collection('sessions').add({
      token, memberId, vaultId, vaultCode, identity,
      expiresAt, lastUsedAt: new Date().toISOString(), createdAt: new Date().toISOString(),
    });

    return NextResponse.json({ vaultId, vaultCode, memberId, identity, sessionToken: token, expiresAt });
  } catch (err: any) {
    console.error('[Auth/create]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

async function handleJoin(req: NextRequest) {
  try {
    const body = await req.json();
    const { vaultCode, identity, memberName } = body;
    if (!VALID_IDENTITIES.includes(identity)) {
      return NextResponse.json({ error: 'identity must be "Batman" or "Princess"' }, { status: 400 });
    }
    if (!vaultCode || typeof vaultCode !== 'string' || !vaultCode.trim()) {
      return NextResponse.json({ error: 'vaultCode required' }, { status: 400 });
    }

    const safeName = sanitizeName(memberName) || identity;
    const db = getAdminDb();
    const cleanCode = vaultCode.trim().toUpperCase();

    const snap = await db.collection('vaults').where('vaultCode', '==', cleanCode).limit(1).get();
    if (snap.empty) return NextResponse.json({ error: 'Vault not found' }, { status: 404 });

    const vaultDoc = snap.docs[0];
    const vaultData = vaultDoc.data();
    const members = vaultData.members || {};
    const role = PARTNER_ROLE[identity];

    if (members[role]) return NextResponse.json({ error: `${identity} is already a member` }, { status: 409 });
    if (members.partner1 && members.partner2) return NextResponse.json({ error: 'Vault already has two members' }, { status: 403 });

    const memberId = generateSanctuaryVaultId();
    const updateData: any = {};
    updateData[`members.${role}`] = { id: memberId, name: safeName, role, photoUrl: '', mood: '', moodUpdatedAt: null };
    if (identity === 'Batman') updateData.batmanName = safeName;
    if (identity === 'Princess') updateData.princessName = safeName;
    await vaultDoc.ref.update(updateData);

    const token = generateToken();
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();
    await db.collection('sessions').add({
      token, memberId, vaultId: vaultDoc.id, vaultCode: cleanCode, identity,
      expiresAt, lastUsedAt: new Date().toISOString(), createdAt: new Date().toISOString(),
    });

    return NextResponse.json({ vaultId: vaultDoc.id, memberId, identity, sessionToken: token, expiresAt });
  } catch (err: any) {
    console.error('[Auth/join]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

async function handleLogin(req: NextRequest) {
  try {
    const body = await req.json();
    const { vaultCode, memberId, identity } = body;
    if (!vaultCode || typeof vaultCode !== 'string' || !vaultCode.trim()) {
      return NextResponse.json({ error: 'vaultCode required' }, { status: 400 });
    }

    const db = getAdminDb();
    const cleanCode = vaultCode.trim().toUpperCase();
    const snap = await db.collection('vaults').where('vaultCode', '==', cleanCode).limit(1).get();
    if (snap.empty) return NextResponse.json({ error: 'Vault not found' }, { status: 404 });

    const vaultDoc = snap.docs[0];
    const vaultData = vaultDoc.data();
    const members = vaultData.members || {};

    let matchedMember: any = null;
    let matchedIdentity: 'Batman' | 'Princess' | null = null;

    if (memberId && typeof memberId === 'string') {
      for (const [roleKey, m] of Object.entries(members) as any) {
        if (m.id === memberId) {
          matchedMember = m;
          matchedIdentity = roleKey === 'partner1' ? 'Batman' : 'Princess';
          break;
        }
      }
    } else if (VALID_IDENTITIES.includes(identity)) {
      const role = PARTNER_ROLE[identity];
      if (members[role]) {
        matchedMember = members[role];
        matchedIdentity = identity;
      }
    }

    if (!matchedMember || !matchedIdentity) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    const token = generateToken();
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();
    await db.collection('sessions').add({
      token, memberId: matchedMember.id, vaultId: vaultDoc.id, vaultCode: cleanCode, identity: matchedIdentity,
      expiresAt, lastUsedAt: new Date().toISOString(), createdAt: new Date().toISOString(),
    });

    return NextResponse.json({ vaultId: vaultDoc.id, memberId: matchedMember.id, identity: matchedIdentity, sessionToken: token, expiresAt });
  } catch (err: any) {
    console.error('[Auth/login]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

async function handleLock(req: NextRequest) {
  const auth = req.headers.get('authorization') || '';
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (m) {
    const db = getAdminDb();
    const snap = await db.collection('sessions').where('token', '==', m[1].trim()).get();
    for (const doc of snap.docs) {
      await doc.ref.delete();
    }
  }
  return NextResponse.json({ ok: true });
}
