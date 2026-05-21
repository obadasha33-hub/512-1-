import { createServer } from 'http'
import { Server, Socket } from 'socket.io'

const httpServer = createServer()
const io = new Server(httpServer, {
  // DO NOT change the path — Caddy uses it to route to this port
  path: '/',
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
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
    socket.join(vaultId)
    setPartnerOnline(vaultId, identity, socket.id, name)
    socketToPartner.set(socket.id, { vaultId, identity })

    console.log(`[join-vault] ${name} (${identity}) joined vault ${vaultId}`)

    // Tell the joining partner who's already here
    const vault = getVault(vaultId)
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
    broadcastToOther(socket, vaultId, 'partner-online', {
      identity,
      name,
    })
  })

  // ── send-message ────────────────────────────────────────────────────────
  socket.on('send-message', (data: SendMessagePayload) => {
    const { vaultId, message } = data
    console.log(`[send-message] vault=${vaultId} msg=${message.id} from=${message.senderId}`)

    // Forward to the other partner only
    broadcastToOther(socket, vaultId, 'receive-message', data)
  })

  // ── typing ──────────────────────────────────────────────────────────────
  socket.on('typing', (data: TypingPayload) => {
    broadcastToOther(socket, data.vaultId, 'partner-typing', data)
  })

  // ── stop-typing ─────────────────────────────────────────────────────────
  socket.on('stop-typing', (data: TypingPayload) => {
    broadcastToOther(socket, data.vaultId, 'partner-stop-typing', data)
  })

  // ── message-status ──────────────────────────────────────────────────────
  socket.on('message-status', (data: MessageStatusPayload) => {
    console.log(`[message-status] vault=${data.vaultId} msg=${data.messageId} status=${data.status}`)
    broadcastToOther(socket, data.vaultId, 'message-status-update', data)
  })

  // ── signal (love signals) ───────────────────────────────────────────────
  socket.on('signal', (data: SignalPayload) => {
    console.log(`[signal] vault=${data.vaultId} type=${data.type} from=${data.from}`)
    broadcastToOther(socket, data.vaultId, 'receive-signal', data)
  })

  // ── mood-update ─────────────────────────────────────────────────────────
  socket.on('mood-update', (data: MoodUpdatePayload) => {
    const { vaultId, identity, mood } = data
    console.log(`[mood-update] vault=${vaultId} identity=${identity} mood=${mood}`)

    // Persist mood in presence map
    const vault = getVault(vaultId)
    const info = vault.get(identity)
    if (info) {
      info.mood = mood
    }

    broadcastToOther(socket, vaultId, 'partner-mood-update', data)
  })

  // ── presence (heartbeat) ────────────────────────────────────────────────
  socket.on('presence', (data: PresencePayload) => {
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

const PORT = 3003
httpServer.listen(PORT, () => {
  console.log(`💬 Chat service (Socket.IO) running on port ${PORT}`)
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
