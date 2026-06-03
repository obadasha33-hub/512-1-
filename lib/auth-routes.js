// Vault auth endpoints. Mounted by server.js at /api/auth/*
//
// Endpoints:
//   POST /api/auth/create   — create new vault with passphrase
//                            body: { name, theme?, font?, startDate?, identity, memberName, passphrase }
//                            returns: { vaultId, vaultCode, memberId, sessionToken, pairingCode }
//   POST /api/auth/join     — join existing vault (legacy or secure)
//                            body: { vaultCode, identity, memberName, passphrase? }
//                            returns: { vaultId, memberId, sessionToken }
//   POST /api/auth/login    — login with existing credentials
//                            body: { vaultCode, memberId, password }
//                            returns: { sessionToken }
//   POST /api/auth/lock     — invalidate current session
//                            requires Authorization header; returns { ok: true }
//   POST /api/auth/pair     — generate a fresh pairing code (creator only)
//                            body: { }  (auth from header)
//                            returns: { pairingCode, expiresAt }

const {
  generateSalt,
  hashPassphrase,
  verifyPassphrase,
  generateToken,
  generateVaultCode,
  generatePairingCode,
  generateSanctuaryVaultId,
  nowPlus,
  isExpired,
  SESSION_DURATION_MS,
  PAIRING_CODE_TTL_MS,
  LOCKOUT_DURATION_MS,
  MAX_FAILED_ATTEMPTS,
} = require('./auth-crypto');
const { authenticate, getRequestBody, sendJson, prisma } = require('./auth-middleware');

const VALID_IDENTITIES = ['Batman', 'Princess'];
const PARTNER_ROLE = { Batman: 'partner1', Princess: 'partner2' };

function isValidPassphrase(p) {
  return typeof p === 'string' && p.length >= 6 && p.length <= 128;
}

function sanitizeName(s, max = 50) {
  if (typeof s !== 'string') return null;
  const t = s.trim();
  if (!t || t.length > max) return null;
  return t;
}

async function handleCreate(req, res) {
  let body;
  try {
    body = await getRequestBody(req);
  } catch (e) {
    return sendJson(res, 400, { error: e.message });
  }
  const { name, theme, font, startDate, identity, memberName, passphrase } = body;
  if (!VALID_IDENTITIES.includes(identity)) {
    return sendJson(res, 400, { error: 'identity must be "Batman" or "Princess"' });
  }
  if (!isValidPassphrase(passphrase)) {
    return sendJson(res, 400, { error: 'passphrase must be 6-128 characters' });
  }
  const safeName = sanitizeName(memberName) || identity;
  const safeVaultName = sanitizeName(name, 100) || 'Our Sanctuary';

  // Generate a unique vaultCode (retry on collision)
  let vaultCode = generateVaultCode();
  for (let i = 0; i < 5; i++) {
    const existing = await prisma.vault.findUnique({ where: { vaultCode } });
    if (!existing) break;
    vaultCode = generateVaultCode();
  }

  const secretSalt = generateSalt();
  const secretHash = hashPassphrase(passphrase, secretSalt);
  const memberSalt = generateSalt();
  const memberHash = hashPassphrase(passphrase, memberSalt);
  const pairingCode = generatePairingCode();
  const pairingExpiresAt = nowPlus(PAIRING_CODE_TTL_MS);
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
      secretHash,
      secretSalt,
      hasSecurity: true,
      pairingCode,
      pairingExpiresAt,
      members: {
        create: {
          role: PARTNER_ROLE[identity],
          name: safeName,
          passwordHash: memberHash,
          passwordSalt: memberSalt,
        },
      },
    },
    include: { members: true },
  });

  const member = vault.members[0];
  await prisma.session.create({
    data: {
      token,
      memberId: member.id,
      vaultId: vault.id,
      expiresAt,
    },
  });

  return sendJson(res, 200, {
    vaultId: vault.id,
    vaultCode,
    memberId: member.id,
    identity,
    sessionToken: token,
    pairingCode,
    pairingExpiresAt: pairingExpiresAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  });
}

async function handleJoin(req, res) {
  let body;
  try {
    body = await getRequestBody(req);
  } catch (e) {
    return sendJson(res, 400, { error: e.message });
  }
  const { vaultCode, identity, memberName, passphrase } = body;
  if (!VALID_IDENTITIES.includes(identity)) {
    return sendJson(res, 400, { error: 'identity must be "Batman" or "Princess"' });
  }
  if (typeof vaultCode !== 'string' || !vaultCode.trim()) {
    return sendJson(res, 400, { error: 'vaultCode required' });
  }
  if (!isValidPassphrase(passphrase)) {
    return sendJson(res, 400, { error: 'passphrase must be 6-128 characters' });
  }
  const safeName = sanitizeName(memberName) || identity;

  const vault = await prisma.vault.findUnique({
    where: { vaultCode: vaultCode.trim().toUpperCase() },
    include: { members: true },
  });
  if (!vault) {
    return sendJson(res, 404, { error: 'Vault not found' });
  }
  if (vault.hasSecurity) {
    if (!verifyPassphrase(passphrase, vault.secretSalt, vault.secretHash)) {
      return sendJson(res, 401, { error: 'Invalid passphrase' });
    }
  }

  // 2-member cap
  if (vault.members.length >= 2) {
    return sendJson(res, 403, { error: 'This vault already has two members' });
  }

  // Identity must not already exist in the vault
  const role = PARTNER_ROLE[identity];
  if (vault.members.find((m) => m.role === role)) {
    return sendJson(res, 409, { error: `${identity} is already a member of this vault` });
  }

  const memberSalt = generateSalt();
  const memberHash = hashPassphrase(passphrase, memberSalt);
  const token = generateToken();
  const expiresAt = nowPlus(SESSION_DURATION_MS);

  const member = await prisma.vaultMember.create({
    data: {
      vaultId: vault.id,
      role,
      name: safeName,
      passwordHash: memberHash,
      passwordSalt: memberSalt,
    },
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
  try {
    body = await getRequestBody(req);
  } catch (e) {
    return sendJson(res, 400, { error: e.message });
  }
  const { vaultCode, memberId, password } = body;
  if (typeof vaultCode !== 'string' || !vaultCode.trim()) {
    return sendJson(res, 400, { error: 'vaultCode required' });
  }
  if (typeof memberId !== 'string' || !memberId) {
    return sendJson(res, 400, { error: 'memberId required' });
  }
  if (!isValidPassphrase(password)) {
    return sendJson(res, 400, { error: 'password must be 6-128 characters' });
  }
  const vault = await prisma.vault.findUnique({
    where: { vaultCode: vaultCode.trim().toUpperCase() },
  });
  if (!vault) {
    return sendJson(res, 404, { error: 'Vault not found' });
  }
  const member = await prisma.vaultMember.findUnique({ where: { id: memberId } });
  if (!member || member.vaultId !== vault.id) {
    return sendJson(res, 404, { error: 'Member not found' });
  }
  // Check lockout
  if (member.lockedUntil && member.lockedUntil.getTime() > Date.now()) {
    return sendJson(res, 429, {
      error: 'Too many failed attempts. Try again later.',
      retryAfter: Math.ceil((member.lockedUntil.getTime() - Date.now()) / 1000),
    });
  }
  if (!verifyPassphrase(password, member.passwordSalt, member.passwordHash)) {
    const newAttempts = (member.failedAttempts || 0) + 1;
    const update = { failedAttempts: newAttempts };
    if (newAttempts >= MAX_FAILED_ATTEMPTS) {
      update.lockedUntil = nowPlus(LOCKOUT_DURATION_MS);
      update.failedAttempts = 0;
    }
    await prisma.vaultMember.update({ where: { id: member.id }, data: update });
    return sendJson(res, 401, { error: 'Invalid password' });
  }
  // Success — clear failed attempts
  await prisma.vaultMember.update({
    where: { id: member.id },
    data: { failedAttempts: 0, lockedUntil: null },
  });
  const token = generateToken();
  const expiresAt = nowPlus(SESSION_DURATION_MS);
  await prisma.session.create({
    data: { token, memberId: member.id, vaultId: vault.id, expiresAt },
  });
  return sendJson(res, 200, {
    vaultId: vault.id,
    memberId: member.id,
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

async function handlePair(req, res) {
  // Requires Authorization header. Generates a new pairing code.
  const ctx = await authenticate(req, res);
  if (!ctx) return;
  const code = generatePairingCode();
  const expiresAt = nowPlus(PAIRING_CODE_TTL_MS);
  await prisma.vault.update({
    where: { id: ctx.vault.id },
    data: { pairingCode: code, pairingExpiresAt: expiresAt },
  });
  return sendJson(res, 200, { pairingCode: code, expiresAt: expiresAt.toISOString() });
}

async function handleSecureLegacy(req, res) {
  // One-time migration: takes an unsecured legacy vaultId and a new passphrase,
  // sets secretHash on the vault and passwordHash on the two existing members,
  // and issues a session for the requesting member. Returns a vaultCode that
  // can be shared with the partner.
  let body;
  try {
    body = await getRequestBody(req);
  } catch (e) {
    return sendJson(res, 400, { error: e.message });
  }
  const { vaultId, passphrase, memberId } = body;
  if (typeof vaultId !== 'string' || !vaultId) {
    return sendJson(res, 400, { error: 'vaultId required' });
  }
  if (!isValidPassphrase(passphrase)) {
    return sendJson(res, 400, { error: 'passphrase must be 6-128 characters' });
  }
  if (typeof memberId !== 'string' || !memberId) {
    return sendJson(res, 400, { error: 'memberId required' });
  }
  const vault = await prisma.vault.findUnique({
    where: { id: vaultId },
    include: { members: true },
  });
  if (!vault) {
    return sendJson(res, 404, { error: 'Vault not found' });
  }
  if (vault.hasSecurity) {
    return sendJson(res, 409, { error: 'Vault is already secured; use /api/auth/join or /api/auth/login' });
  }
  if (vault.members.length > 2) {
    return sendJson(res, 409, { error: 'Cannot secure a vault with more than 2 members' });
  }
  const member = vault.members.find((m) => m.id === memberId);
  if (!member) {
    return sendJson(res, 404, { error: 'Member not found' });
  }

  // Generate a vaultCode (ensure uniqueness)
  let vaultCode = generateVaultCode();
  for (let i = 0; i < 5; i++) {
    const existing = await prisma.vault.findUnique({ where: { vaultCode } });
    if (!existing) break;
    vaultCode = generateVaultCode();
  }
  const secretSalt = generateSalt();
  const secretHash = hashPassphrase(passphrase, secretSalt);
  const memberSalt = generateSalt();
  const memberHash = hashPassphrase(passphrase, memberSalt);
  const pairingCode = generatePairingCode();
  const pairingExpiresAt = nowPlus(PAIRING_CODE_TTL_MS);
  const token = generateToken();
  const expiresAt = nowPlus(SESSION_DURATION_MS);

  await prisma.vault.update({
    where: { id: vault.id },
    data: {
      secretHash,
      secretSalt,
      hasSecurity: true,
      vaultCode,
      pairingCode,
      pairingExpiresAt,
    },
  });
  await prisma.vaultMember.update({
    where: { id: member.id },
    data: { passwordHash: memberHash, passwordSalt: memberSalt },
  });
  // Also secure the other member with the same passphrase (they will need
  // to log in with the same passphrase after this migration).
  for (const other of vault.members) {
    if (other.id === member.id) continue;
    const otherSalt = generateSalt();
    const otherHash = hashPassphrase(passphrase, otherSalt);
    await prisma.vaultMember.update({
      where: { id: other.id },
      data: { passwordHash: otherHash, passwordSalt: otherSalt },
    });
  }
  await prisma.session.create({
    data: { token, memberId: member.id, vaultId: vault.id, expiresAt },
  });

  return sendJson(res, 200, {
    vaultId: vault.id,
    vaultCode,
    memberId: member.id,
    identity: member.role === 'partner1' ? 'Batman' : 'Princess',
    sessionToken: token,
    pairingCode,
    pairingExpiresAt: pairingExpiresAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  });
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
    if (pathname === '/api/auth/pair') return handlePair(req, res);
    if (pathname === '/api/auth/secure-legacy') return handleSecureLegacy(req, res);
    return sendJson(res, 404, { error: 'Not found' });
  } catch (err) {
    console.error('[auth] handler error:', err);
    return sendJson(res, 500, { error: 'Internal error' });
  }
}

module.exports = { routeAuth };
