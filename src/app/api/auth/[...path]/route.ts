import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import crypto from 'crypto';

const VALID_IDENTITIES = ['Batman', 'Princess'] as const;
const PARTNER_ROLE: Record<string, string> = { Batman: 'partner1', Princess: 'partner2' };
const SESSION_DURATION_MS = 365 * 24 * 60 * 60 * 1000;

function generateToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function generateVaultCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(6);
  let out = '';
  for (let i = 0; i < 6; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

function generateSanctuaryVaultId() {
  return 'vault-' + crypto.randomBytes(3).toString('hex');
}

function sanitizeName(s: string, max = 50): string | null {
  if (typeof s !== 'string') return null;
  const t = s.trim();
  if (!t || t.length > max) return null;
  return t;
}

function nowPlus(durationMs: number) {
  return new Date(Date.now() + durationMs);
}

export async function POST(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  try {
    if (pathname.endsWith('/create')) return handleCreate(req);
    if (pathname.endsWith('/join')) return handleJoin(req);
    if (pathname.endsWith('/login')) return handleLogin(req);
    if (pathname.endsWith('/lock')) return handleLock(req);
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  } catch (err) {
    console.error('[Auth] handler error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

async function handleCreate(req: NextRequest) {
  const body = await req.json();
  const { name, theme, font, startDate, identity, memberName } = body;
  if (!VALID_IDENTITIES.includes(identity)) {
    return NextResponse.json({ error: 'identity must be "Batman" or "Princess"' }, { status: 400 });
  }
  const safeName = sanitizeName(memberName) || identity;
  const safeVaultName = sanitizeName(name, 100) || 'Our Sanctuary';

  let vaultCode = generateVaultCode();
  for (let i = 0; i < 5; i++) {
    const existing = await db.vault.findUnique({ where: { vaultCode } });
    if (!existing) break;
    vaultCode = generateVaultCode();
  }

  const token = generateToken();
  const expiresAt = nowPlus(SESSION_DURATION_MS);

  const vault = await db.vault.create({
    data: {
      id: generateSanctuaryVaultId(),
      vaultCode,
      name: safeVaultName,
      theme: typeof theme === 'string' ? theme : 'Pinky',
      font: typeof font === 'string' ? font : 'Default',
      startDate: startDate ? new Date(startDate) : new Date(),
      members: {
        create: { role: PARTNER_ROLE[identity], name: safeName },
      },
    },
    include: { members: true },
  });

  const member = vault.members[0];
  await db.session.create({
    data: { token, memberId: member.id, vaultId: vault.id, expiresAt },
  });

  return NextResponse.json({
    vaultId: vault.id,
    vaultCode,
    memberId: member.id,
    identity,
    sessionToken: token,
    expiresAt: expiresAt.toISOString(),
  });
}

async function handleJoin(req: NextRequest) {
  const body = await req.json();
  const { vaultCode, identity, memberName } = body;
  if (!VALID_IDENTITIES.includes(identity)) {
    return NextResponse.json({ error: 'identity must be "Batman" or "Princess"' }, { status: 400 });
  }
  if (typeof vaultCode !== 'string' || !vaultCode.trim()) {
    return NextResponse.json({ error: 'vaultCode required' }, { status: 400 });
  }
  const safeName = sanitizeName(memberName) || identity;

  const vault = await db.vault.findUnique({
    where: { vaultCode: vaultCode.trim().toUpperCase() },
    include: { members: true },
  });
  if (!vault) return NextResponse.json({ error: 'Vault not found' }, { status: 404 });
  if (vault.members.length >= 2) return NextResponse.json({ error: 'Vault already has two members' }, { status: 403 });

  const role = PARTNER_ROLE[identity];
  if (vault.members.find((m) => m.role === role)) {
    return NextResponse.json({ error: `${identity} is already a member of this vault` }, { status: 409 });
  }

  const token = generateToken();
  const expiresAt = nowPlus(SESSION_DURATION_MS);

  const member = await db.vaultMember.create({
    data: { vaultId: vault.id, role, name: safeName },
  });
  await db.session.create({
    data: { token, memberId: member.id, vaultId: vault.id, expiresAt },
  });

  return NextResponse.json({
    vaultId: vault.id,
    memberId: member.id,
    identity,
    sessionToken: token,
    expiresAt: expiresAt.toISOString(),
  });
}

async function handleLogin(req: NextRequest) {
  const body = await req.json();
  const { vaultCode, memberId, identity } = body;
  if (typeof vaultCode !== 'string' || !vaultCode.trim()) {
    return NextResponse.json({ error: 'vaultCode required' }, { status: 400 });
  }
  const vault = await db.vault.findUnique({
    where: { vaultCode: vaultCode.trim().toUpperCase() },
  });
  if (!vault) return NextResponse.json({ error: 'Vault not found' }, { status: 404 });

  let member = null;
  if (typeof memberId === 'string' && memberId) {
    member = await db.vaultMember.findUnique({ where: { id: memberId } });
    if (!member || member.vaultId !== vault.id) return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  } else if (VALID_IDENTITIES.includes(identity)) {
    const role = PARTNER_ROLE[identity];
    member = await db.vaultMember.findFirst({ where: { vaultId: vault.id, role } });
    if (!member) return NextResponse.json({ error: `No ${identity} member in this vault` }, { status: 404 });
  } else {
    return NextResponse.json({ error: 'memberId or identity required' }, { status: 400 });
  }

  const token = generateToken();
  const expiresAt = nowPlus(SESSION_DURATION_MS);
  await db.session.create({
    data: { token, memberId: member.id, vaultId: vault.id, expiresAt },
  });

  return NextResponse.json({
    vaultId: vault.id,
    memberId: member.id,
    identity: member.role === 'partner1' ? 'Batman' : 'Princess',
    sessionToken: token,
    expiresAt: expiresAt.toISOString(),
  });
}

async function handleLock(req: NextRequest) {
  const auth = req.headers.get('authorization') || '';
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (m) {
    await db.session.deleteMany({ where: { token: m[1].trim() } }).catch(() => {});
  }
  return NextResponse.json({ ok: true });
}
