// Vault auth endpoints — simplified for personal use (no passphrase).
// Mounted by server.js at /api/auth/*
//
// Endpoints:
//   POST /api/auth/create  — create new vault
//                            body: { name, identity, memberName, theme?, font?, startDate? }
//                            returns: { vaultId, vaultCode, memberId, identity, sessionToken, expiresAt }
//   POST /api/auth/join    — join existing vault by code
//                            body: { vaultCode, identity, memberName }
//                            returns: { vaultId, memberId, identity, sessionToken, expiresAt }
//   POST /api/auth/login   — re-login with stored memberId
//                            body: { vaultCode, memberId }
//                            returns: { vaultId, memberId, identity, sessionToken, expiresAt }
//   POST /api/auth/lock    — invalidate current session
//                            requires Authorization header; returns { ok: true }

const {
  generateToken,
  generateVaultCode,
  generateSanctuaryVaultId,
  nowPlus,
  SESSION_DURATION_MS,
} = require('./auth-crypto');
const { authenticate, getRequestBody, sendJson, prisma } = require('./auth-middleware');

const VALID_IDENTITIES = ['Batman', 'Princess'];
const PARTNER_ROLE = { Batman: 'partner1', Princess: 'partner2' };

function sanitizeName(s, max = 50) {
  if (typeof s !== 'string') return null;
  const t = s.trim();
  if (!t || t.length > max) return null;
  return t;
}

async function handleCreate(req, res) {
  let body;
  try { body = await getRequestBody(req); } catch (e) { return sendJson(res, 400, { error: e.message }); }
  const { name, theme, font, startDate, identity, memberName } = body;
  if (!VALID_IDENTITIES.includes(identity)) {
    return sendJson(res, 400, { error: 'identity must be "Batman" or "Princess"' });
  }
  const safeName = sanitizeName(memberName) || identity;
  const safeVaultName = sanitizeName(name, 100) || 'Our Sanctuary';

  let vaultCode = generateVaultCode();
  for (let i = 0; i < 5; i++) {
    const existing = await prisma.vault.findUnique({ where: { vaultCode } });
    if (!existing) break;
    vaultCode = generateVaultCode();
  }

  const token = generateToken();
  const expiresAt = nowPlus(SESSION_DURATION_MS);

  const vault = await prisma.vault.create({
    data: {
      id: generateSanctuaryVaultId(),
      vaultCode,
      name: safeVaultName,
      theme: typeof theme === 'string' ? theme : 'Pinky',
      font: typeof font === 'string' ? font : 'Default',
      startDate: startDate ? new Date(startDate) : new Date(),
      hasSecurity: true,
      members: {
        create: { role: PARTNER_ROLE[identity], name: safeName },
      },
    },
    include: { members: true },
  });

  const member = vault.members[0];
  await prisma.session.create({
    data: { token, memberId: member.id, vaultId: vault.id, expiresAt },
  });

  return sendJson(res, 200, {
    vaultId: vault.id,
    vaultCode,
    memberId: member.id,
    identity,
    sessionToken: token,
    expiresAt: expiresAt.toISOString(),
  });
}

async function handleJoin(req, res) {
  let body;
  try { body = await getRequestBody(req); } catch (e) { return sendJson(res, 400, { error: e.message }); }
  const { vaultCode, identity, memberName } = body;
  if (!VALID_IDENTITIES.includes(identity)) {
    return sendJson(res, 400, { error: 'identity must be "Batman" or "Princess"' });
  }
  if (typeof vaultCode !== 'string' || !vaultCode.trim()) {
    return sendJson(res, 400, { error: 'vaultCode required' });
  }
  const safeName = sanitizeName(memberName) || identity;

  const vault = await prisma.vault.findUnique({
    where: { vaultCode: vaultCode.trim().toUpperCase() },
    include: { members: true },
  });
  if (!vault) return sendJson(res, 404, { error: 'Vault not found' });
  if (vault.members.length >= 2) return sendJson(res, 403, { error: 'Vault already has two members' });

  const role = PARTNER_ROLE[identity];
  if (vault.members.find((m) => m.role === role)) {
    return sendJson(res, 409, { error: `${identity} is already a member of this vault` });
  }

  const token = generateToken();
  const expiresAt = nowPlus(SESSION_DURATION_MS);

  const member = await prisma.vaultMember.create({
    data: { vaultId: vault.id, role, name: safeName },
  });
  await prisma.session.create({
    data: { token, memberId: member.id, vaultId: vault.id, expiresAt },
  });

  return sendJson(res, 200, {
    vaultId: vault.id,
    memberId: member.id,
    identity,
    sessionToken: token,
    expiresAt: expiresAt.toISOString(),
  });
}

async function handleLogin(req, res) {
  let body;
  try { body = await getRequestBody(req); } catch (e) { return sendJson(res, 400, { error: e.message }); }
  const { vaultCode, memberId, identity } = body;
  if (typeof vaultCode !== 'string' || !vaultCode.trim()) {
    return sendJson(res, 400, { error: 'vaultCode required' });
  }
  const vault = await prisma.vault.findUnique({
    where: { vaultCode: vaultCode.trim().toUpperCase() },
  });
  if (!vault) return sendJson(res, 404, { error: 'Vault not found' });

  let member = null;
  if (typeof memberId === 'string' && memberId) {
    member = await prisma.vaultMember.findUnique({ where: { id: memberId } });
    if (!member || member.vaultId !== vault.id) return sendJson(res, 404, { error: 'Member not found' });
  } else if (VALID_IDENTITIES.includes(identity)) {
    const role = PARTNER_ROLE[identity];
    member = await prisma.vaultMember.findFirst({ where: { vaultId: vault.id, role } });
    if (!member) return sendJson(res, 404, { error: `No ${identity} member in this vault` });
  } else {
    return sendJson(res, 400, { error: 'memberId or identity required' });
  }

  const token = generateToken();
  const expiresAt = nowPlus(SESSION_DURATION_MS);
  await prisma.session.create({
    data: { token, memberId: member.id, vaultId: vault.id, expiresAt },
  });
  return sendJson(res, 200, {
    vaultId: vault.id,
    memberId: member.id,
    identity: member.role === 'partner1' ? 'Batman' : 'Princess',
    sessionToken: token,
    expiresAt: expiresAt.toISOString(),
  });
}

async function handleLock(req, res) {
  const auth = req.headers.authorization || '';
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (m) {
    await prisma.session.deleteMany({ where: { token: m[1].trim() } }).catch(() => {});
  }
  return sendJson(res, 200, { ok: true });
}

async function routeAuth(req, res, pathname) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { error: 'Method not allowed' });
  }
  try {
    if (pathname === '/api/auth/create') return handleCreate(req, res);
    if (pathname === '/api/auth/join') return handleJoin(req, res);
    if (pathname === '/api/auth/login') return handleLogin(req, res);
    if (pathname === '/api/auth/lock') return handleLock(req, res);
    return sendJson(res, 404, { error: 'Not found' });
  } catch (err) {
    console.error('[auth] handler error:', err);
    return sendJson(res, 500, { error: 'Internal error' });
  }
}

module.exports = { routeAuth };
