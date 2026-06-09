const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');
const { PrismaClient } = require('@prisma/client');
const { routeAuth } = require('./lib/auth-routes');
const { validateSocketToken, updateMemberOnlineStatus } = require('./lib/socket-auth');

// Initialize Prisma globally so auth-middleware and socket-auth can reuse it
const prisma = global.prisma || new PrismaClient({ log: process.env.NODE_ENV === 'production' ? ['error'] : ['error', 'warn'] });
if (!global.prisma) global.prisma = prisma;

const dev = process.env.NODE_ENV !== 'production';
const PORT = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev });
// Trust Railway proxy (required for WebSocket upgrades behind load balancer)
app.set('trust proxy', true);
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      const { pathname } = parsedUrl;

      // 1. Handle custom Auth routes (Prisma-based)
      if (pathname.startsWith('/api/auth/')) {
        return routeAuth(req, res, pathname);
      }

      // 2. Handle Next.js requests
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error handling request:', err);
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  });

  // 3. Initialize Socket.IO with enterprise-grade stability settings
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
      credentials: true
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    maxHttpBufferSize: 1e8, // 100MB to prevent crashes on large payloads
    transports: ['polling', 'websocket'], // Polling first for Railway proxy compatibility
    allowUpgrades: true,
    upgradeTimeout: 30000,
    cookie: false
  });

  // Attach Socket.IO to global for potential use in API routes
  global.io = io;

  // Track active connections per memberId to prevent premature "offline" status
  // when a user has multiple tabs or devices open
  const activeConnections = new Map();

  io.on('connection', (socket) => {
    console.log('Socket connected:', socket.id);

    socket.on('auth', async ({ token }) => {
      try {
        const authData = await validateSocketToken(token);

        if (!authData) {
          return socket.emit('auth-result', { ok: false, error: 'Invalid session' });
        }

        const { session, member, vault } = authData;

        socket.data.auth = {
          memberId: member.id,
          vaultId: vault.id,
          identity: member.role === 'partner1' ? 'Batman' : 'Princess'
        };

        // Track this connection
        if (!activeConnections.has(member.id)) {
          activeConnections.set(member.id, new Set());
          // Only set online if this is the first connection for this member
          await updateMemberOnlineStatus(vault.id, member.id, true);
        }
        activeConnections.get(member.id).add(socket.id);

        socket.join(vault.id);
        socket.to(vault.id).emit('partner-presence', { identity: socket.data.auth.identity, online: true });

        socket.emit('auth-result', { ok: true, identity: socket.data.auth.identity });
        console.log(`Socket authenticated: ${socket.data.auth.identity} in ${vault.id}`);
      } catch (err) {
        console.error('[Socket auth] Error:', err);
        socket.emit('auth-result', { ok: false, error: 'Server error' });
      }
    });

    // Message events
    socket.on('send-message', ({ vaultId, message, from }) => {
      if (!socket.data.auth) return;
      if (socket.data.auth.vaultId !== vaultId) return;
      socket.to(vaultId).emit('receive-message', { vaultId, message });
    });

    socket.on('message-status', ({ vaultId, messageId, status }) => {
      if (!socket.data.auth) return;
      socket.to(vaultId).emit('message-status-update', { vaultId, messageId, status });
    });

    socket.on('typing', ({ vaultId, identity }) => {
      if (!socket.data.auth) return;
      if (socket.data.auth.vaultId !== vaultId) return;
      socket.to(vaultId).emit('partner-typing', { vaultId, identity });
    });

    socket.on('stop-typing', ({ vaultId, identity }) => {
      if (!socket.data.auth) return;
      if (socket.data.auth.vaultId !== vaultId) return;
      socket.to(vaultId).emit('partner-stop-typing', { vaultId, identity });
    });

    // Signal events (hug, kiss, miss)
    socket.on('signal', ({ vaultId, type, from }) => {
      if (!socket.data.auth) return;
      if (socket.data.auth.vaultId !== vaultId) return;
      socket.to(vaultId).emit('receive-signal', { vaultId, type, from });
    });

    // Mood and presence updates
    socket.on('mood-update', ({ vaultId, identity, mood }) => {
      if (!socket.data.auth) return;
      if (socket.data.auth.vaultId !== vaultId) return;
      socket.to(vaultId).emit('partner-mood-update', { vaultId, identity, mood });
    });

    socket.on('presence', ({ vaultId, identity }) => {
      if (!socket.data.auth) return;
      if (socket.data.auth.vaultId !== vaultId) return;
      socket.to(vaultId).emit('partner-presence', { vaultId, identity, online: true, lastSeen: new Date().toISOString() });
    });

    // Message interactions
    socket.on('reaction-add', ({ vaultId, messageId, reaction, from }) => {
      if (!socket.data.auth) return;
      if (socket.data.auth.vaultId !== vaultId) return;
      socket.to(vaultId).emit('partner-reaction', { vaultId, messageId, reaction, from });
    });

    socket.on('star-message', ({ vaultId, messageId, from }) => {
      if (!socket.data.auth) return;
      if (socket.data.auth.vaultId !== vaultId) return;
      socket.to(vaultId).emit('partner-star-message', { vaultId, messageId, from });
    });

    socket.on('unstar-message', ({ vaultId, messageId, from }) => {
      if (!socket.data.auth) return;
      if (socket.data.auth.vaultId !== vaultId) return;
      socket.to(vaultId).emit('partner-unstar-message', { vaultId, messageId, from });
    });

    // Profile updates
    socket.on('profile-photo-update', ({ vaultId, identity, photoUrl }) => {
      if (!socket.data.auth) return;
      if (socket.data.auth.vaultId !== vaultId) return;
      socket.to(vaultId).emit('partner-photo-update', { vaultId, identity, photoUrl });
    });

    // Letter read receipts
    socket.on('letter-read', ({ vaultId, letterId, from }) => {
      if (!socket.data.auth) return;
      if (socket.data.auth.vaultId !== vaultId) return;
      socket.to(vaultId).emit('partner-letter-read', { vaultId, letterId, from });
    });

    socket.on('new-memory', ({ vaultId, memory, from }) => {
      if (!socket.data.auth) return;
      socket.to(vaultId).emit('receive-memory', { vaultId, memory, from });
    });

    // Game events (disabled — requires Firebase-based game engine implementation)
    socket.on('game-start', ({ vaultId, from }) => {
      if (!socket.data.auth) return;
      socket.emit('game-error', { error: 'Game feature temporarily unavailable — backend migration in progress' });
    });

    socket.on('game-answer', ({ vaultId, questionIndex, answer, from, correctIndex }) => {
      if (!socket.data.auth) return;
      socket.emit('game-error', { error: 'Game feature temporarily unavailable — backend migration in progress' });
    });

    socket.on('game-end', ({ vaultId }) => {
      if (!socket.data.auth) return;
      socket.emit('game-error', { error: 'Game feature temporarily unavailable — backend migration in progress' });
    });

    socket.on('game-resume', ({ vaultId }) => {
      if (!socket.data.auth) return;
      socket.emit('game-error', { error: 'Game feature temporarily unavailable — backend migration in progress' });
    });

    socket.on('disconnect', async () => {
      if (socket.data.auth?.memberId) {
        const memberId = socket.data.auth.memberId;
        const vaultId = socket.data.auth.vaultId;
        const identity = socket.data.auth.identity;
        const connections = activeConnections.get(memberId);
        
        if (connections) {
          connections.delete(socket.id);
          
          // Only set offline if this was the last connection for this member
          if (connections.size === 0) {
            activeConnections.delete(memberId);
            await updateMemberOnlineStatus(vaultId, memberId, false);

            socket.to(vaultId).emit('partner-presence', {
              identity,
              online: false,
              lastSeen: new Date().toISOString()
            });
          }
        }
      }
      console.log('Socket disconnected:', socket.id);
    });
  });

  httpServer.listen(PORT, () => {
    console.log(`> Ready on port ${PORT}`);
  });
});
