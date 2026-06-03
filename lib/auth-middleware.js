// Auth middleware: validates Bearer token from Authorization header
// and attaches { session, member, vault } to the request object.
// On failure responds 401/403 directly.

const prisma = (() => {
  // Use the global prisma if attached by server.js, else create a fresh one
  if (typeof global !== 'undefined' && global.prisma) return global.prisma;
  const { PrismaClient } = require('@prisma/client');
  return new PrismaClient({ log: ['error'] });
})();

async function authenticate(req, res) {
  const auth = req.headers.authorization || '';
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Missing Authorization header' }));
    return null;
  }
  const token = m[1].trim();
  if (!token) {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Invalid token' }));
    return null;
  }
  const session = await prisma.session.findUnique({
    where: { token },
    include: { member: true, vault: true },
  });
  if (!session) {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Invalid session' }));
    return null;
  }
  if (session.expiresAt.getTime() <= Date.now()) {
    // Expired — clean up
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Session expired' }));
    return null;
  }
  // Sliding expiration: refresh lastUsedAt, push expiry forward if more than half elapsed
  const remaining = session.expiresAt.getTime() - Date.now();
  if (remaining < 15 * 24 * 60 * 60 * 1000) {
    const newExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await prisma.session
      .update({ where: { id: session.id }, data: { lastUsedAt: new Date(), expiresAt: newExpiry } })
      .catch(() => {});
  } else {
    await prisma.session.update({ where: { id: session.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
  }
  return { session, member: session.member, vault: session.vault };
}

function getRequestBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1e6) {
        req.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (e) {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

module.exports = { authenticate, getRequestBody, sendJson, prisma };
