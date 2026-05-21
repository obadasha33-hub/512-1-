import { createServer } from 'http'
import { Server, Socket } from 'socket.io'

const httpServer = createServer()

// ── Configuration ────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:81').split(',')
const PORT = parseInt(process.env.PORT || '3003', 10)
const MAX_MESSAGE_SIZE = 1024 * 1024 // 1MB max per message payload
const RATE_LIMIT_WINDOW = 5000 // 5 seconds
const MAX_MESSAGES_PER_WINDOW = 30 // max 30 messages per 5 seconds

const io = new Server(httpServer, {
  path: '/',
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  maxHttpBufferSize: MAX_MESSAGE_SIZE,
})

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Identity = 'Batman' | 'Princess'

interface JoinVaultPayload {
  vaultId: string
  identity: Identity
  name: string
}

interface ChatMessage {
  id: string
  type: string
  senderId: string
  text?: string
  image?: string
  audio?: string
  video?: string
  audioDuration?: number
  time: string
  status: string
  replyTo?: string
}

interface SendMessagePayload {
  vaultId: string
  message: ChatMessage
}

interface TypingPayload {
  vaultId: string
  identity: Identity
}

interface MessageStatusPayload {
  vaultId: string
  messageId: string
  status: string
}

interface SignalPayload {
  vaultId: string
  type: string
  from: Identity
}

interface MoodUpdatePayload {
  vaultId: string
  identity: Identity
  mood: string
}

interface PresencePayload {
  vaultId: string
  identity: Identity
}

// ---------------------------------------------------------------------------
// Presence tracking
// ---------------------------------------------------------------------------

interface PartnerInfo {
  socketId: string
  identity: Identity
  name: string
  mood?: string
  online: boolean
  lastSeen: number
}

// vaultId → { 'Batman' | 'Princess' → PartnerInfo }
const vaultPresence = new Map<string, Map<Identity, PartnerInfo>>()

function getVault(vaultId: string): Map<Identity, PartnerInfo> {
  if (!vaultPresence.has(vaultId)) {
    vaultPresence.set(vaultId, new Map())
  }
  return vaultPresence.get(vaultId)!
}

function setPartnerOnline(vaultId: string, identity: Identity, socketId: string, name: string) {
  const vault = getVault(vaultId)
  vault.set(identity, {
    socketId,
    identity,
    name,
    online: true,
    lastSeen: Date.now(),
  })
}

function setPartnerOffline(vaultId: string, identity: Identity) {
  const vault = getVault(vaultId)
  const info = vault.get(identity)
  if (info) {
    info.online = false
    info.lastSeen = Date.now()
  }
}

// Reverse lookup: socketId → { vaultId, identity }
const socketToPartner = new Map<string, { vaultId: string; identity: Identity }>()

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

const messageTimestamps = new Map<string, number[]>()

function isRateLimited(socketId: string): boolean {
  const now = Date.now()
  const timestamps = messageTimestamps.get(socketId) || []

  // Remove old timestamps outside the window
  const recent = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW)

  if (recent.length >= MAX_MESSAGES_PER_WINDOW) {
    return true
  }

  recent.push(now)
  messageTimestamps.set(socketId, recent)
  return false
}

// Cleanup rate limit entries periodically
setInterval(() => {
  const now = Date.now()
  for (const [socketId, timestamps] of messageTimestamps) {
    const recent = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW)
    if (recent.length === 0) {
      messageTimestamps.delete(socketId)
    } else {
      messageTimestamps.set(socketId, recent)
    }
  }
}, 30000)

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function isValidIdentity(identity: unknown): identity is Identity {
  return identity === 'Batman' || identity === 'Princess'
}

function sanitizeString(str: unknown, maxLength: number): string | null {
  if (typeof str !== 'string') return null
  if (str.length > maxLength) return null
  return str
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function broadcastToOther(
  socket: Socket,
  vaultId: string,
  event: string,
  payload: unknown,
) {
  const vault = vaultPresence.get(vaultId)
  if (!vault) return

  for (const [identity, info] of vault) {
    if (info.socketId !== socket.id && info.online) {
      io.to(info.socketId).emit(event, payload)
    }
  }
}

// ---------------------------------------------------------------------------
// Connection handler
// ---------------------------------------------------------------------------

io.on('connection', (socket) => {
  console.log(`[connect] ${socket.id}`)

  // ── join-vault ──────────────────────────────────────────────────────────
  socket.on('join-vault', (data: JoinVaultPayload) => {
    const { vaultId, identity, name } = data

    // Validate inputs
    if (!isValidIdentity(identity)) {
      socket.emit('error', { message: 'Invalid identity' })
      return
    }

    const safeVaultId = sanitizeString(vaultId, 100)
    const safeName = sanitizeString(name, 50)

    if (!safeVaultId || !safeName) {
      socket.emit('error', { message: 'Invalid vault or name' })
      return
    }

    // Leave any previous vault room on this socket
    const prev = socketToPartner.get(socket.id)
    if (prev) {
      setPartnerOffline(prev.vaultId, prev.identity)
      broadcastToOther(socket, prev.vaultId, 'partner-offline', {
        identity: prev.identity,
      })
      socket.leave(prev.vaultId)
    }

    // Join the new vault room
    socket.join(safeVaultId)
    setPartnerOnline(safeVaultId, identity, socket.id, safeName)
    socketToPartner.set(socket.id, { vaultId: safeVaultId, identity })

    console.log(`[join-vault] ${safeName} (${identity}) joined vault ${safeVaultId}`)

    // Tell the joining partner who's already here
    const vault = getVault(safeVaultId)
    const presenceData: Record<string, { online: boolean; name: string; mood?: string; lastSeen: number }> = {}
    for (const [id, info] of vault) {
      presenceData[id] = {
        online: info.online,
        name: info.name,
        mood: info.mood,
        lastSeen: info.lastSeen,
      }
    }
    socket.emit('vault-presence', presenceData)

    // Notify the other partner that this partner is now online
    broadcastToOther(socket, safeVaultId, 'partner-online', {
      identity,
      name: safeName,
    })
  })

  // ── send-message ────────────────────────────────────────────────────────
  socket.on('send-message', (data: SendMessagePayload) => {
    // Rate limit check
    if (isRateLimited(socket.id)) {
      socket.emit('error', { message: 'Rate limited: slow down!' })
      return
    }

    const { vaultId, message } = data

    // Validate vault membership
    const partner = socketToPartner.get(socket.id)
    if (!partner || partner.vaultId !== vaultId) {
      return // Not a member of this vault
    }

    console.log(`[send-message] vault=${vaultId} msg=${message.id} from=${message.senderId}`)

    // Forward to the other partner only
    broadcastToOther(socket, vaultId, 'receive-message', data)
  })

  // ── typing ──────────────────────────────────────────────────────────────
  socket.on('typing', (data: TypingPayload) => {
    const partner = socketToPartner.get(socket.id)
    if (!partner || partner.vaultId !== data.vaultId) return
    broadcastToOther(socket, data.vaultId, 'partner-typing', data)
  })

  // ── stop-typing ─────────────────────────────────────────────────────────
  socket.on('stop-typing', (data: TypingPayload) => {
    const partner = socketToPartner.get(socket.id)
    if (!partner || partner.vaultId !== data.vaultId) return
    broadcastToOther(socket, data.vaultId, 'partner-stop-typing', data)
  })

  // ── message-status ──────────────────────────────────────────────────────
  socket.on('message-status', (data: MessageStatusPayload) => {
    const partner = socketToPartner.get(socket.id)
    if (!partner || partner.vaultId !== data.vaultId) return
    console.log(`[message-status] vault=${data.vaultId} msg=${data.messageId} status=${data.status}`)
    broadcastToOther(socket, data.vaultId, 'message-status-update', data)
  })

  // ── signal (love signals) ───────────────────────────────────────────────
  socket.on('signal', (data: SignalPayload) => {
    const partner = socketToPartner.get(socket.id)
    if (!partner || partner.vaultId !== data.vaultId) return
    if (!isValidIdentity(data.from)) return
    console.log(`[signal] vault=${data.vaultId} type=${data.type} from=${data.from}`)
    broadcastToOther(socket, data.vaultId, 'receive-signal', data)
  })

  // ── mood-update ─────────────────────────────────────────────────────────
  socket.on('mood-update', (data: MoodUpdatePayload) => {
    const partner = socketToPartner.get(socket.id)
    if (!partner || partner.vaultId !== data.vaultId) return
    if (!isValidIdentity(data.identity)) return
    const { vaultId, identity, mood } = data
    console.log(`[mood-update] vault=${vaultId} identity=${identity} mood=${mood}`)

    // Persist mood in presence map
    const vault = getVault(vaultId)
    const info = vault.get(identity)
    if (info) {
      info.mood = sanitizeString(mood, 10) || '😊'
    }

    broadcastToOther(socket, vaultId, 'partner-mood-update', data)
  })

  // ── presence (heartbeat) ────────────────────────────────────────────────
  socket.on('presence', (data: PresencePayload) => {
    const partner = socketToPartner.get(socket.id)
    if (!partner || partner.vaultId !== data.vaultId) return
    const { vaultId, identity } = data
    const vault = getVault(vaultId)
    const info = vault.get(identity)
    if (info) {
      info.online = true
      info.lastSeen = Date.now()
    }
    broadcastToOther(socket, vaultId, 'partner-presence', {
      identity,
      online: true,
      lastSeen: Date.now(),
    })
  })

  // ── disconnect ──────────────────────────────────────────────────────────
  socket.on('disconnect', (reason) => {
    const partner = socketToPartner.get(socket.id)
    if (partner) {
      const { vaultId, identity } = partner
      setPartnerOffline(vaultId, identity)
      socketToPartner.delete(socket.id)
      messageTimestamps.delete(socket.id)

      console.log(`[disconnect] ${identity} left vault ${vaultId} (${reason})`)

      broadcastToOther(socket, vaultId, 'partner-offline', {
        identity,
        lastSeen: Date.now(),
      })
    } else {
      console.log(`[disconnect] ${socket.id} (${reason})`)
    }
  })

  // ── error ───────────────────────────────────────────────────────────────
  socket.on('error', (error) => {
    console.error(`[error] socket=${socket.id}`, error)
  })
})

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

httpServer.listen(PORT, () => {
  console.log(`💬 Chat service (Socket.IO) running on port ${PORT}`)
  console.log(`🔒 CORS origins: ${ALLOWED_ORIGINS.join(', ')}`)
  console.log(`🛡️ Rate limit: ${MAX_MESSAGES_PER_WINDOW} messages per ${RATE_LIMIT_WINDOW / 1000}s`)
})

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down chat service…')
  httpServer.close(() => {
    console.log('Chat service closed')
    process.exit(0)
  })
})

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down chat service…')
  httpServer.close(() => {
    console.log('Chat service closed')
    process.exit(0)
  })
})
