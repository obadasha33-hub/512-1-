const { createServer } = require('http');
const { parse } = require('url');
const { execSync } = require('child_process');
const next = require('next');
const { Server } = require('socket.io');
const { PrismaClient } = require('@prisma/client');
const { routeAuth } = require('./lib/auth-routes');
const gameEngine = require('./lib/game-engine');

const prisma = global.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'production' ? ['error'] : ['error', 'warn'],
});
if (!global.prisma) global.prisma = prisma;

// ── Configuration ──────────────────────────────────────────────────────────
const dev = process.env.NODE_ENV !== 'production';
const PORT = parseInt(process.env.PORT || '3000', 10);
const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:81',
  'http://localhost',
  'https://localhost',
  'capacitor://localhost',
  'file://',
  'null',
  'https://512-1-production.up.railway.app',
  'http://512-1-production.up.railway.app',
  // Generic same-origin patterns for Railway/Render/Fly/etc. deployments
  /^https?:\/\/([a-z0-9-]+\.)*railway\.app$/i,
  /^https?:\/\/([a-z0-9-]+\.)*up\.railway\.app$/i,
  /^https?:\/\/([a-z0-9-]+\.)*render\.com$/i,
  /^https?:\/\/([a-z0-9-]+\.)*fly\.dev$/i,
];
// Parse CORS_ORIGINS env var; defaults are always included, env var ADDS more (never replaces)
const envOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
// Deduplicate while preserving order (defaults first, then env additions)
const seen = new Set();
const ALLOWED_ORIGINS = [...DEFAULT_ALLOWED_ORIGINS.map(String), ...envOrigins].filter((o) => {
  const key = String(o);
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});
console.log(`[CORS] Allowed origins (${ALLOWED_ORIGINS.length}): ${ALLOWED_ORIGINS.map(String).join(', ')}`);
if (process.env.CORS_ORIGINS) console.log(`[CORS] CORS_ORIGINS env var: "${process.env.CORS_ORIGINS}"`);

function isAllowedOrigin(origin) {
  if (!origin) return true; // No origin = same-origin or non-browser
  if (ALLOWED_ORIGINS.includes('*')) return true;
  for (const allowed of ALLOWED_ORIGINS) {
    if (allowed instanceof RegExp) {
      if (allowed.test(origin)) return true;
    } else if (allowed === origin) {
      return true;
    }
  }
  return false;
}

function applyCors(req, res) {
  const origin = req.headers.origin;
  if (!isAllowedOrigin(origin)) return false;

  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return true;
}

// ── Database Migration (runs on every startup, idempotent) ─────────────────
async function ensureDatabase() {
  if (!process.env.DATABASE_URL) {
    console.warn('[DB] DATABASE_URL not set, skipping migration');
    return;
  }
  try {
    console.log('[DB] Running prisma db push...');
    execSync('npx prisma db push --skip-generate --accept-data-loss', {
      stdio: 'inherit',
      env: { ...process.env },
    });
    console.log('[DB] Database schema is in sync');
  } catch (err) {
    console.error('[DB] Migration failed:', err.message);
  }
}

// ── Next.js ────────────────────────────────────────────────────────────────
const app = next({ dev, port: PORT });
const handle = app.getRequestHandler();

ensureDatabase().then(() => {
  return app.prepare();
}).then(() => {
  // ── HTTP Server (Next.js) ──────────────────────────────────────────────
  const fs = require('fs');
  const pathMod = require('path');

  const httpServer = createServer(async (req, res) => {
    try {
      if (!applyCors(req, res)) {
        res.statusCode = 403;
        res.end('Forbidden origin');
        return;
      }

      if (req.method === 'OPTIONS') {
        res.statusCode = 204;
        res.end();
        return;
      }

      // Auth routes (no Next.js routing needed)
      if (req.url && req.url.startsWith('/api/auth/')) {
        const pathname = req.url.split('?')[0];
        return routeAuth(req, res, pathname);
      }

      // Serve /uploads/* from filesystem directly (bypasses Next.js public dir)
      if (req.url && req.url.startsWith('/uploads/') && req.method === 'GET') {
        const safe = req.url.split('?')[0].replace(/^\/+/, '');
        const filePath = pathMod.join(process.cwd(), 'public', safe);
        // Prevent path traversal
        const publicDir = pathMod.join(process.cwd(), 'public');
        const resolved = pathMod.resolve(filePath);
        if (!resolved.startsWith(publicDir)) {
          res.statusCode = 403;
          res.end('Forbidden');
          return;
        }
        if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
          const ext = pathMod.extname(resolved).toLowerCase();
          const mime = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.bmp': 'image/bmp', '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4', '.pdf': 'application/pdf', '.txt': 'text/plain', '.json': 'application/json' }[ext] || 'application/octet-stream';
          res.setHeader('Content-Type', mime);
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          res.setHeader('Access-Control-Allow-Origin', '*');
          fs.createReadStream(resolved).pipe(res);
          return;
        } else {
          res.statusCode = 404;
          res.end('Not Found');
          return;
        }
      }

      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error handling request:', err);
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  });

  httpServer.listen(PORT, () => {
    console.log(`> Ready on port ${PORT}`);
  });

  // ── Socket.IO Server (attached to HTTP server, same port) ──────────────
  const MAX_MESSAGE_SIZE = 1024 * 1024;
  const RATE_LIMIT_WINDOW = 5000;
  const MAX_MESSAGES_PER_WINDOW = 30;

  const io = new Server(httpServer, {
    path: '/socket.io/',
    cors: {
      origin: ALLOWED_ORIGINS,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    maxHttpBufferSize: MAX_MESSAGE_SIZE,
  });

  console.log(`💬 Socket.IO running on same port as HTTP server (${PORT})`);

  // ── Types / State ─────────────────────────────────────────────────────
  const vaultPresence = new Map();
  const socketToPartner = new Map();
  const gameSessions = new Map();
  const messageTimestamps = new Map();

  function getVault(vaultId) {
    if (!vaultPresence.has(vaultId)) vaultPresence.set(vaultId, new Map());
    return vaultPresence.get(vaultId);
  }

  function setPartnerOnline(vaultId, identity, socketId, name) {
    getVault(vaultId).set(identity, { socketId, identity, name, online: true, lastSeen: Date.now() });
  }

  function setPartnerOffline(vaultId, identity) {
    const info = getVault(vaultId).get(identity);
    if (info) { info.online = false; info.lastSeen = Date.now(); }
  }

  function broadcastToOther(socket, vaultId, event, payload) {
    const vault = vaultPresence.get(vaultId);
    if (!vault) return;
    for (const [id, info] of vault) {
      if (info.socketId !== socket.id && info.online) io.to(info.socketId).emit(event, payload);
    }
  }

  function isValidIdentity(i) { return i === 'Batman' || i === 'Princess'; }
  function sanitizeString(s, max) { return typeof s === 'string' && s.length <= max ? s : null; }

  function isRateLimited(socketId) {
    const now = Date.now();
    const recent = (messageTimestamps.get(socketId) || []).filter(t => now - t < RATE_LIMIT_WINDOW);
    if (recent.length >= MAX_MESSAGES_PER_WINDOW) return true;
    recent.push(now);
    messageTimestamps.set(socketId, recent);
    return false;
  }

  // Cleanup rate limit entries
  setInterval(() => {
    const now = Date.now();
    for (const [sid, ts] of messageTimestamps) {
      const recent = ts.filter(t => now - t < RATE_LIMIT_WINDOW);
      recent.length === 0 ? messageTimestamps.delete(sid) : messageTimestamps.set(sid, recent);
    }
  }, 30000);

  // ── Socket.IO Connection Handler ───────────────────────────────────────
  io.on('connection', (socket) => {
    console.log(`[connect] ${socket.id}`);
    socket.data.auth = null; // { memberId, vaultId, identity }

    // Auth handshake: client emits 'auth' with { token } after connect.
    // Without valid auth, all join-vault / events are rejected.
    socket.on('auth', async ({ token } = {}) => {
      try {
        if (typeof token !== 'string' || !token) {
          return socket.emit('auth-result', { ok: false, error: 'Missing token' });
        }
        const session = await prisma.session.findUnique({
          where: { token },
          include: { member: true, vault: true },
        });
        if (!session || session.expiresAt.getTime() <= Date.now()) {
          return socket.emit('auth-result', { ok: false, error: 'Invalid or expired session' });
        }
        const identity = session.member.role === 'partner1' ? 'Batman' : 'Princess';
        socket.data.auth = {
          memberId: session.member.id,
          vaultId: session.vault.id,
          identity,
        };
        return socket.emit('auth-result', {
          ok: true,
          identity,
          memberId: session.member.id,
          vaultId: session.vault.id,
        });
      } catch (err) {
        console.error('[auth] socket auth error:', err.message);
        return socket.emit('auth-result', { ok: false, error: 'Auth failed' });
      }
    });

    socket.on('join-vault', (data) => {
      if (!socket.data.auth) return socket.emit('error', { message: 'Not authenticated' });
      const { identity, name } = data || {};
      if (!isValidIdentity(identity)) return socket.emit('error', { message: 'Invalid identity' });
      if (identity !== socket.data.auth.identity) {
        return socket.emit('error', { message: 'Identity mismatch with auth' });
      }
      const sv = socket.data.auth.vaultId;
      const sn = sanitizeString(name, 50) || identity;

      const prev = socketToPartner.get(socket.id);
      if (prev) {
        setPartnerOffline(prev.vaultId, prev.identity);
        broadcastToOther(socket, prev.vaultId, 'partner-offline', { identity: prev.identity });
        socket.leave(prev.vaultId);
      }

      socket.join(sv);
      setPartnerOnline(sv, identity, socket.id, sn);
      socketToPartner.set(socket.id, { vaultId: sv, identity });

      const vault = getVault(sv);
      const presenceData = {};
      for (const [id, info] of vault) presenceData[id] = { online: info.online, name: info.name, mood: info.mood, lastSeen: info.lastSeen };
      socket.emit('vault-presence', presenceData);
      broadcastToOther(socket, sv, 'partner-online', { identity, name: sn });
    });

    socket.on('send-message', async (data) => {
      try {
        if (isRateLimited(socket.id)) return socket.emit('error', { message: 'Rate limited' });

        if (!socket.data.auth) return socket.emit('error', { message: 'Not authenticated' });
        const auth = socket.data.auth;
        const msg = data?.message || {};
        if (msg.senderId && msg.senderId !== auth.identity) {
          return socket.emit('error', { message: 'Sender identity mismatch' });
        }
        if (data.vaultId && data.vaultId !== auth.vaultId) {
          return socket.emit('error', { message: 'Vault mismatch' });
        }

        // Ensure presence is set
        if (!socketToPartner.get(socket.id)) {
          socket.join(auth.vaultId);
          setPartnerOnline(auth.vaultId, auth.identity, socket.id, auth.identity);
          socketToPartner.set(socket.id, { vaultId: auth.vaultId, identity: auth.identity });
        }

        // Persist to DB so the message survives across reconnects/offline receivers
        try {
          const vaultId = auth.vaultId;
          const identity = auth.identity;
          const role = identity === 'Batman' ? 'partner1' : 'partner2';

          const sender = await prisma.vaultMember.findFirst({ where: { vaultId, role } });
          if (sender) {
            await prisma.message.create({
              data: {
                vaultId,
                senderId: sender.id,
                text: msg.text || null,
                imageUrl: msg.image || null,
                audioUrl: msg.audio || null,
                videoUrl: msg.video || null,
                documentUrl: msg.documentUrl || null,
                messageType: msg.messageType || (msg.text ? 'text' : msg.image ? 'image' : msg.audio ? 'audio' : msg.video ? 'video' : 'text'),
                fileName: msg.fileName || null,
                fileSize: msg.fileSize || null,
                status: 'sent',
              },
            });
          }
        } catch (dbErr) {
          console.warn('[send-message] DB persist failed (broadcast will still proceed):', dbErr.message);
        }

        broadcastToOther(socket, auth.vaultId, 'receive-message', { ...data, vaultId: auth.vaultId, message: { ...msg, senderId: auth.identity } });
      } catch (err) {
        console.error('[send-message] Handler error:', err);
      }
    });

    socket.on('typing', (d) => { const p = socketToPartner.get(socket.id); if (p?.vaultId === d.vaultId) broadcastToOther(socket, d.vaultId, 'partner-typing', d); });
    socket.on('stop-typing', (d) => { const p = socketToPartner.get(socket.id); if (p?.vaultId === d.vaultId) broadcastToOther(socket, d.vaultId, 'partner-stop-typing', d); });
    socket.on('message-status', (d) => { const p = socketToPartner.get(socket.id); if (p?.vaultId === d.vaultId) broadcastToOther(socket, d.vaultId, 'message-status-update', d); });
    socket.on('signal', (d) => { const p = socketToPartner.get(socket.id); if (p?.vaultId === d.vaultId && isValidIdentity(d.from)) broadcastToOther(socket, d.vaultId, 'receive-signal', d); });
    socket.on('mood-update', (d) => { const p = socketToPartner.get(socket.id); if (p?.vaultId === d.vaultId && isValidIdentity(d.identity)) { const info = getVault(d.vaultId).get(d.identity); if (info) info.mood = sanitizeString(d.mood, 10) || '😊'; broadcastToOther(socket, d.vaultId, 'partner-mood-update', d); } });
    socket.on('presence', (d) => { const p = socketToPartner.get(socket.id); if (p?.vaultId === d.vaultId) { const info = getVault(d.vaultId).get(d.identity); if (info) { info.online = true; info.lastSeen = Date.now(); } broadcastToOther(socket, d.vaultId, 'partner-presence', { identity: d.identity, online: true, lastSeen: Date.now() }); } });
    socket.on('reaction-add', (d) => { const p = socketToPartner.get(socket.id); if (p?.vaultId === d.vaultId && isValidIdentity(d.from)) broadcastToOther(socket, d.vaultId, 'partner-reaction', d); });
    socket.on('star-message', (d) => { const p = socketToPartner.get(socket.id); if (p?.vaultId === d.vaultId && isValidIdentity(d.from)) broadcastToOther(socket, d.vaultId, 'partner-star-message', d); });
    socket.on('unstar-message', (d) => { const p = socketToPartner.get(socket.id); if (p?.vaultId === d.vaultId && isValidIdentity(d.from)) broadcastToOther(socket, d.vaultId, 'partner-unstar-message', d); });
    socket.on('profile-photo-update', (d) => { const p = socketToPartner.get(socket.id); if (p?.vaultId === d.vaultId && isValidIdentity(d.identity)) broadcastToOther(socket, d.vaultId, 'partner-photo-update', d); });
    socket.on('letter-read', (d) => { const p = socketToPartner.get(socket.id); if (p?.vaultId === d.vaultId && isValidIdentity(d.from)) broadcastToOther(socket, d.vaultId, 'partner-letter-read', d); });
    socket.on('new-memory', (d) => { const p = socketToPartner.get(socket.id); if (p?.vaultId === d.vaultId) broadcastToOther(socket, d.vaultId, 'receive-memory', d); });

    // Game events (server-driven state — see lib/game-engine.js)
    socket.on('game-start', async (d) => {
      if (!socket.data.auth) return socket.emit('error', { message: 'Not authenticated' });
      const auth = socket.data.auth;
      if (auth.vaultId !== d.vaultId || !isValidIdentity(d.from)) return;
      try {
        await gameEngine.startGame(prisma, io, d.vaultId, d.from);
      } catch (err) {
        console.error('[game-start] error:', err.message);
      }
    });
    socket.on('game-answer', async (d) => {
      if (!socket.data.auth) return socket.emit('error', { message: 'Not authenticated' });
      const auth = socket.data.auth;
      if (auth.vaultId !== d.vaultId || auth.identity !== d.from) return;
      try {
        // Client sends correctIndex along with the answer (the client owns the
        // LOVE_QUIZ_QUESTIONS array; the server is just a relay + scorer).
        const result = await gameEngine.submitAnswer(
          prisma, io, d.vaultId, d.from, d.questionIndex, d.answer, d.correctIndex
        );
        if (result?.error) socket.emit('error', { message: result.error });
      } catch (err) {
        console.error('[game-answer] error:', err.message);
      }
    });
    socket.on('game-end', async (d) => {
      if (!socket.data.auth) return;
      const auth = socket.data.auth;
      if (auth.vaultId !== d.vaultId) return;
      // Mark any active session as abandoned
      try {
        await prisma.gameSession.updateMany({
          where: { vaultId: d.vaultId, status: 'active' },
          data: { status: 'abandoned' },
        });
        io.to(d.vaultId).emit('game-ended', { abandoned: true });
      } catch (err) {
        console.error('[game-end] error:', err.message);
      }
    });
    // Partner wants to know current game state (on reconnect / app resume)
    socket.on('game-resume', async () => {
      if (!socket.data.auth) return;
      const auth = socket.data.auth;
      try {
        const session = await prisma.gameSession.findFirst({
          where: { vaultId: auth.vaultId, status: 'active' },
        });
        if (session) {
          socket.emit('game-resumed', {
            sessionId: session.id,
            questionOrder: JSON.parse(session.questionOrder),
            questionIndex: session.currentIndex,
            scoreBatman: session.scoreBatman,
            scorePrincess: session.scorePrincess,
            answers: JSON.parse(session.answers),
            currentEndsAt: session.currentEndsAt?.getTime() || null,
          });
          gameEngine.scheduleTick(prisma, io, auth.vaultId);
        }
      } catch (err) {
        console.error('[game-resume] error:', err.message);
      }
    });

    socket.on('disconnect', (reason) => {
      const partner = socketToPartner.get(socket.id);
      if (partner) {
        const { vaultId, identity } = partner;
        setPartnerOffline(vaultId, identity);
        socketToPartner.delete(socket.id);
        messageTimestamps.delete(socket.id);
        const s = gameSessions.get(vaultId); if (s) { s.active = false; gameSessions.delete(vaultId); }
        broadcastToOther(socket, vaultId, 'partner-offline', { identity, lastSeen: Date.now() });
      }
    });
  });

  // ── Graceful Shutdown ──────────────────────────────────────────────────
  process.on('SIGTERM', () => { console.log('SIGTERM received'); process.exit(0); });
  process.on('SIGINT', () => { console.log('SIGINT received'); process.exit(0); });
});
