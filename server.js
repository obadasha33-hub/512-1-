const { createServer } = require('http');
const { parse } = require('url');
const { execSync } = require('child_process');
const next = require('next');
const { Server } = require('socket.io');

// ── Configuration ──────────────────────────────────────────────────────────
const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const PORT = parseInt(process.env.PORT || '3000', 10);
const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:81').split(',');

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
const app = next({ dev, hostname, port: PORT });
const handle = app.getRequestHandler();

ensureDatabase().then(() => {
  return app.prepare();
}).then(() => {
  // ── HTTP Server (Next.js) ──────────────────────────────────────────────
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error handling request:', err);
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  });

  httpServer.listen(PORT, hostname, () => {
    console.log(`> Ready on http://${hostname}:${PORT}`);
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

    socket.on('join-vault', (data) => {
      const { vaultId, identity, name } = data;
      if (!isValidIdentity(identity)) return socket.emit('error', { message: 'Invalid identity' });
      const sv = sanitizeString(vaultId, 100), sn = sanitizeString(name, 50);
      if (!sv || !sn) return socket.emit('error', { message: 'Invalid vault or name' });

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

    socket.on('send-message', (data) => {
      if (isRateLimited(socket.id)) return socket.emit('error', { message: 'Rate limited' });
      const partner = socketToPartner.get(socket.id);
      if (!partner || partner.vaultId !== data.vaultId) return;
      broadcastToOther(socket, data.vaultId, 'receive-message', data);
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

    // Game events
    socket.on('game-start', (d) => {
      const p = socketToPartner.get(socket.id); if (p?.vaultId !== d.vaultId || !isValidIdentity(d.from)) return;
      gameSessions.set(d.vaultId, { vaultId: d.vaultId, currentQuestion: 0, answers: { Batman: null, Princess: null }, scores: { Batman: 0, Princess: 0 }, startedAt: Date.now(), active: true });
      io.to(d.vaultId).emit('game-started', { from: d.from, questionIndex: 0, questionOrder: d.questionOrder || [] });
    });
    socket.on('game-answer', (d) => {
      const p = socketToPartner.get(socket.id); if (p?.vaultId !== d.vaultId || !isValidIdentity(d.from)) return;
      const s = gameSessions.get(d.vaultId); if (!s?.active || d.questionIndex !== s.currentQuestion) return;
      s.answers[d.from] = d.answer;
      broadcastToOther(socket, d.vaultId, 'partner-game-answer', { questionIndex: d.questionIndex, answer: d.answer, from: d.from });
      const other = d.from === 'Batman' ? 'Princess' : 'Batman';
      if (s.answers[other] !== null) io.to(d.vaultId).emit('game-question-result', { questionIndex: s.currentQuestion, answers: { ...s.answers }, bothAnswered: true });
    });
    socket.on('game-next', (d) => {
      const p = socketToPartner.get(socket.id); if (p?.vaultId !== d.vaultId) return;
      const s = gameSessions.get(d.vaultId); if (!s?.active) return;
      s.currentQuestion = d.questionIndex; s.answers = { Batman: null, Princess: null };
      io.to(d.vaultId).emit('game-next-question', { questionIndex: d.questionIndex });
    });
    socket.on('game-end', (d) => {
      const p = socketToPartner.get(socket.id); if (p?.vaultId !== d.vaultId) return;
      const s = gameSessions.get(d.vaultId);
      if (s) { s.active = false; io.to(d.vaultId).emit('game-ended', { scores: s.scores }); gameSessions.delete(d.vaultId); }
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
