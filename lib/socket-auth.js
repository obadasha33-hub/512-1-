// Socket.IO authentication using Prisma (matches API routes and auth-routes.js)
const prisma = (() => {
  // Use the global prisma if attached by server.js, else create a fresh one
  if (typeof global !== 'undefined' && global.prisma) return global.prisma;
  const { PrismaClient } = require('@prisma/client');
  return new PrismaClient({ log: ['error'] });
})();

const SESSION_DURATION_MS = 365 * 24 * 60 * 60 * 1000;

async function validateSocketToken(token) {
  if (!token || typeof token !== 'string') return null;

  try {
    // Look up session in Prisma (matching auth-routes.js and api-auth.ts behavior)
    const session = await prisma.session.findUnique({
      where: { token },
      include: { member: true, vault: true },
    });

    if (!session) return null;

    if (session.expiresAt.getTime() <= Date.now()) {
      // Expired - clean up
      await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
      return null;
    }

    return {
      session: {
        id: session.id,
        token: session.token,
        memberId: session.memberId,
        vaultId: session.vaultId,
        expiresAt: session.expiresAt,
        lastUsedAt: session.lastUsedAt,
      },
      member: {
        id: session.member.id,
        role: session.member.role,
        name: session.member.name,
        photoUrl: session.member.photoUrl || '',
        mood: session.member.mood || '',
      },
      vault: {
        id: session.vault.id,
        vaultCode: session.vault.vaultCode,
        name: session.vault.name,
        theme: session.vault.theme,
        font: session.vault.font,
      },
    };
  } catch (err) {
    console.error('[Socket Auth] Validation error:', err);
    return null;
  }
}

async function updateMemberOnlineStatus(vaultId, memberId, isOnline) {
  try {
    await prisma.vaultMember.update({
      where: { id: memberId },
      data: {
        isOnline,
        lastSeen: new Date(),
      },
    });
  } catch (err) {
    console.error('[Socket Auth] Failed to update online status:', err);
  }
}

module.exports = { validateSocketToken, updateMemberOnlineStatus };