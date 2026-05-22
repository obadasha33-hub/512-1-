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

// New event payloads
interface ReactionPayload {
  vaultId: string
  messageId: string
  reaction: string
  from: Identity
}

interface StarPayload {
  vaultId: string
  messageId: string
  from: Identity
}

interface ProfilePhotoPayload {
  vaultId: string
  identity: Identity
  photoUrl: string
}

interface LetterReadPayload {
  vaultId: string
  letterId: string
  from: Identity
}

interface GameStartPayload {
  vaultId: string
  from: Identity
  questionOrder?: number[]
}

interface GameAnswerPayload {
  vaultId: string
  questionIndex: number
  answer: number
  from: Identity
}

interface GameNextPayload {
  vaultId: string
  questionIndex: number
}

interface GameEndPayload {
  vaultId: string
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
// Game State
// ---------------------------------------------------------------------------

interface GameSession {
  vaultId: string
  currentQuestion: number
  answers: Record<Identity, number | null> // identity → answer index
  scores: Record<Identity, number>
  startedAt: number
  active: boolean
}

const gameSessions = new Map<string, GameSession>()

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

function validateVaultMembership(socket: Socket, vaultId: string): { vaultId: string; identity: Identity } | null {
  const partner = socketToPartner.get(socket.id)
  if (!partner || partner.vaultId !== vaultId) return null
  return partner
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

  // ══════════════════════════════════════════════════════════════════════════
  // NEW EVENTS — Features 1, 2, 8, 10, 13
  // ══════════════════════════════════════════════════════════════════════════

  // ── reaction-add (Feature 1) ────────────────────────────────────────────
  socket.on('reaction-add', (data: ReactionPayload) => {
    const membership = validateVaultMembership(socket, data.vaultId)
    if (!membership) return
    if (!isValidIdentity(data.from)) return
    console.log(`[reaction-add] vault=${data.vaultId} msg=${data.messageId} reaction=${data.reaction} from=${data.from}`)
    broadcastToOther(socket, data.vaultId, 'partner-reaction', data)
  })

  // ── star-message (Feature 2) ────────────────────────────────────────────
  socket.on('star-message', (data: StarPayload) => {
    const membership = validateVaultMembership(socket, data.vaultId)
    if (!membership) return
    if (!isValidIdentity(data.from)) return
    console.log(`[star-message] vault=${data.vaultId} msg=${data.messageId} from=${data.from}`)
    broadcastToOther(socket, data.vaultId, 'partner-star-message', data)
  })

  // ── unstar-message (Feature 2) ──────────────────────────────────────────
  socket.on('unstar-message', (data: StarPayload) => {
    const membership = validateVaultMembership(socket, data.vaultId)
    if (!membership) return
    if (!isValidIdentity(data.from)) return
    console.log(`[unstar-message] vault=${data.vaultId} msg=${data.messageId} from=${data.from}`)
    broadcastToOther(socket, data.vaultId, 'partner-unstar-message', data)
  })

  // ── profile-photo-update (Feature 10) ───────────────────────────────────
  socket.on('profile-photo-update', (data: ProfilePhotoPayload) => {
    const membership = validateVaultMembership(socket, data.vaultId)
    if (!membership) return
    if (!isValidIdentity(data.identity)) return
    console.log(`[profile-photo-update] vault=${data.vaultId} identity=${data.identity}`)
    broadcastToOther(socket, data.vaultId, 'partner-photo-update', data)
  })

  // ── letter-read (Feature 8) ─────────────────────────────────────────────
  socket.on('letter-read', (data: LetterReadPayload) => {
    const membership = validateVaultMembership(socket, data.vaultId)
    if (!membership) return
    if (!isValidIdentity(data.from)) return
    console.log(`[letter-read] vault=${data.vaultId} letter=${data.letterId} from=${data.from}`)
    broadcastToOther(socket, data.vaultId, 'partner-letter-read', data)
  })

  // ══════════════════════════════════════════════════════════════════════════
  // GAME EVENTS — Feature 13: Love Quiz Battle
  // ══════════════════════════════════════════════════════════════════════════

  // ── game-start (Feature 13) ─────────────────────────────────────────────
  socket.on('game-start', (data: GameStartPayload) => {
    const membership = validateVaultMembership(socket, data.vaultId)
    if (!membership) return
    if (!isValidIdentity(data.from)) return
    console.log(`[game-start] vault=${data.vaultId} from=${data.from}`)

    // Initialize game session
    const session: GameSession = {
      vaultId: data.vaultId,
      currentQuestion: 0,
      answers: { Batman: null, Princess: null },
      scores: { Batman: 0, Princess: 0 },
      startedAt: Date.now(),
      active: true,
    }
    gameSessions.set(data.vaultId, session)

    // Broadcast to both partners (including sender) so both see the game
    // Relay questionOrder so both partners use the same question sequence
    io.to(data.vaultId).emit('game-started', { from: data.from, questionIndex: 0, questionOrder: data.questionOrder || [] })
  })

  // ── game-answer (Feature 13) ────────────────────────────────────────────
  socket.on('game-answer', (data: GameAnswerPayload) => {
    const membership = validateVaultMembership(socket, data.vaultId)
    if (!membership) return
    if (!isValidIdentity(data.from)) return
    console.log(`[game-answer] vault=${data.vaultId} q=${data.questionIndex} answer=${data.answer} from=${data.from}`)

    const session = gameSessions.get(data.vaultId)
    if (!session || !session.active) return
    if (data.questionIndex !== session.currentQuestion) return

    // Record this player's answer
    session.answers[data.from] = data.answer

    // Broadcast the answer to the other partner
    broadcastToOther(socket, data.vaultId, 'partner-game-answer', {
      questionIndex: data.questionIndex,
      answer: data.answer,
      from: data.from,
    })

    // Check if both partners have answered
    const otherIdentity: Identity = data.from === 'Batman' ? 'Princess' : 'Batman'
    if (session.answers[otherIdentity] !== null) {
      // Both answered — broadcast results to the vault
      io.to(data.vaultId).emit('game-question-result', {
        questionIndex: session.currentQuestion,
        answers: { ...session.answers },
        bothAnswered: true,
      })
    }
  })

  // ── game-next (Feature 13) ──────────────────────────────────────────────
  socket.on('game-next', (data: GameNextPayload) => {
    const membership = validateVaultMembership(socket, data.vaultId)
    if (!membership) return
    console.log(`[game-next] vault=${data.vaultId} nextQ=${data.questionIndex}`)

    const session = gameSessions.get(data.vaultId)
    if (!session || !session.active) return

    // Update scores based on previous answers
    const prevAnswers = session.answers
    // Scoring will be handled client-side; server just resets answers for next question
    session.currentQuestion = data.questionIndex
    session.answers = { Batman: null, Princess: null }

    // Broadcast next question to both
    io.to(data.vaultId).emit('game-next-question', { questionIndex: data.questionIndex })
  })

  // ── game-end (Feature 13) ───────────────────────────────────────────────
  socket.on('game-end', (data: GameEndPayload) => {
    const membership = validateVaultMembership(socket, data.vaultId)
    if (!membership) return
    console.log(`[game-end] vault=${data.vaultId}`)

    const session = gameSessions.get(data.vaultId)
    if (session) {
      session.active = false
    }

    // Broadcast game end to both
    io.to(data.vaultId).emit('game-ended', { scores: session?.scores || { Batman: 0, Princess: 0 } })
    gameSessions.delete(data.vaultId)
  })

  // ── disconnect ──────────────────────────────────────────────────────────
  socket.on('disconnect', (reason) => {
    const partner = socketToPartner.get(socket.id)
    if (partner) {
      const { vaultId, identity } = partner
      setPartnerOffline(vaultId, identity)
      socketToPartner.delete(socket.id)
      messageTimestamps.delete(socket.id)

      // Clean up game session
      const session = gameSessions.get(vaultId)
      if (session) {
        session.active = false
        gameSessions.delete(vaultId)
      }

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
