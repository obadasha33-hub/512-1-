// Game session management — server-driven state, persistent across reconnects.
// All clients in the same vault see the same timer and reveal at the same instant.

const QUESTION_TIME_MS = 10_000; // 10 seconds per question
const REVEAL_DELAY_MS = 4_000;   // 4 seconds for both to see the answer + commentary

// In-memory cache of active game timers (vaultId -> interval id)
const gameTimers = new Map();

function scheduleTick(prisma, io, vaultId) {
  // Cancel any existing tick
  const existing = gameTimers.get(vaultId);
  if (existing) clearInterval(existing);

  const interval = setInterval(async () => {
    try {
      const session = await prisma.gameSession.findFirst({
        where: { vaultId, status: 'active' },
      });
      if (!session) {
        clearInterval(interval);
        gameTimers.delete(vaultId);
        return;
      }
      if (!session.currentEndsAt) {
        // Idle (waiting for next) — keep polling
        return;
      }
      const now = Date.now();
      const endsAt = session.currentEndsAt.getTime();
      const remainingMs = endsAt - now;
      if (remainingMs > 0) {
        // Broadcast tick so both clients stay in sync
        io.to(vaultId).emit('game-tick', {
          questionIndex: session.currentIndex,
          remainingMs,
          endsAt,
        });
      } else {
        // Time's up — auto-submit null answer for anyone who didn't answer
        await autoResolveIfReady(prisma, io, vaultId, session);
      }
    } catch (err) {
      console.error('[game tick] error:', err.message);
    }
  }, 1000);
  gameTimers.set(vaultId, interval);
}

async function autoResolveIfReady(prisma, io, vaultId, session) {
  // If both players have answered, reveal immediately; else force-submit null and reveal
  const answers = JSON.parse(session.answers || '{}');
  const key = String(session.currentIndex);
  const state = answers[key] || { batman: undefined, princess: undefined, revealedAt: null };
  let updated = false;
  if (state.batman === undefined || state.batman === null) {
    state.batman = null;
    state.batmanAutoSubmitted = true;
    updated = true;
  }
  if (state.princess === undefined || state.princess === null) {
    state.princess = null;
    state.princessAutoSubmitted = true;
    updated = true;
  }
  if (updated) {
    answers[key] = state;
    await prisma.gameSession.update({
      where: { id: session.id },
      data: { answers: JSON.stringify(answers) },
    });
  }
  // Reveal after a short delay so both clients can see the timeout
  setTimeout(() => revealAnswer(prisma, io, vaultId, session, state), 500);
}

async function revealAnswer(prisma, io, vaultId, session, state) {
  const answers = JSON.parse(session.answers || '{}');
  const key = String(session.currentIndex);
  const s = answers[key] || state;
  s.revealedAt = Date.now();
  answers[key] = s;

  // Update scores based on this question's correct answer
  // (caller passes correctAnswerIndex)
  // We do scoring at the question level; GAME_QUESTIONS index lookup is done on the client
  // because the questionOrder is also broadcast; for the server we just broadcast state.

  await prisma.gameSession.update({
    where: { id: session.id },
    data: {
      answers: JSON.stringify(answers),
      currentEndsAt: null, // no timer running during reveal
    },
  });
  io.to(vaultId).emit('game-reveal', {
    questionIndex: session.currentIndex,
    answers: s, // { batman, princess, revealedAt }
  });
  // After REVEAL_DELAY_MS, advance to next question (or finish)
  setTimeout(() => advanceQuestion(prisma, io, vaultId, session.id, session.questionOrder, session.currentIndex), REVEAL_DELAY_MS);
}

async function advanceQuestion(prisma, io, vaultId, sessionId, questionOrderJson, currentIndex) {
  const nextIndex = currentIndex + 1;
  const order = JSON.parse(questionOrderJson);
  const session = await prisma.gameSession.findUnique({ where: { id: sessionId } });
  if (!session || session.status !== 'active') return;
  if (nextIndex >= order.length) {
    await prisma.gameSession.update({
      where: { id: sessionId },
      data: { status: 'completed', completedAt: new Date() },
    });
    io.to(vaultId).emit('game-ended', {
      scoreBatman: session.scoreBatman,
      scorePrincess: session.scorePrincess,
    });
    const t = gameTimers.get(vaultId);
    if (t) { clearInterval(t); gameTimers.delete(vaultId); }
    return;
  }
  const endsAt = new Date(Date.now() + QUESTION_TIME_MS);
  await prisma.gameSession.update({
    where: { id: sessionId },
    data: { currentIndex: nextIndex, currentStartedAt: new Date(), currentEndsAt: endsAt },
  });
  io.to(vaultId).emit('game-next', {
    questionIndex: nextIndex,
    endsAt: endsAt.getTime(),
    questionOrder: order,
  });
  scheduleTick(prisma, io, vaultId);
}

async function startGame(prisma, io, vaultId, startedBy) {
  // End any existing active session
  await prisma.gameSession.updateMany({
    where: { vaultId, status: 'active' },
    data: { status: 'abandoned' },
  });

  // Pick 10 random questions (last one is daily bonus)
  const order = pickQuestionOrder();
  const endsAt = new Date(Date.now() + QUESTION_TIME_MS);
  const session = await prisma.gameSession.create({
    data: {
      vaultId,
      status: 'active',
      questionOrder: JSON.stringify(order),
      currentIndex: 0,
      currentStartedAt: new Date(),
      currentEndsAt: endsAt,
      answers: '{}',
    },
  });
  io.to(vaultId).emit('game-started', {
    sessionId: session.id,
    questionOrder: order,
    questionIndex: 0,
    endsAt: endsAt.getTime(),
    startedBy,
  });
  scheduleTick(prisma, io, vaultId);
  return session;
}

function pickQuestionOrder() {
  // Same shuffle algo as client: 10 random, last is daily bonus.
  // Daily bonus is server-stable for the day.
  const indices = Array.from({ length: 50 }, (_, i) => i); // 50 question pool; cap by real length
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  const today = new Date();
  const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
  const bonus = seed % indices.length;
  const selected = indices.slice(0, 9);
  selected.push(bonus);
  return selected;
}

async function submitAnswer(prisma, io, vaultId, identity, questionIndex, answerIndex, correctAnswerIndex) {
  const session = await prisma.gameSession.findFirst({
    where: { vaultId, status: 'active' },
  });
  if (!session) return { error: 'No active game' };
  if (session.currentIndex !== questionIndex) return { error: 'Wrong question' };

  const answers = JSON.parse(session.answers || '{}');
  const key = String(questionIndex);
  const state = answers[key] || { batman: undefined, princess: undefined, revealedAt: null, correctIndex: correctAnswerIndex };
  if (identity === 'Batman') {
    if (state.batman !== undefined && state.batman !== null) return { error: 'Already answered' };
    state.batman = answerIndex;
  } else {
    if (state.princess !== undefined && state.princess !== null) return { error: 'Already answered' };
    state.princess = answerIndex;
  }
  if (correctAnswerIndex !== undefined) state.correctIndex = correctAnswerIndex;
  answers[key] = state;

  // Score immediately
  let newScoreB = session.scoreBatman;
  let newScoreP = session.scorePrincess;
  if (state.correctIndex !== undefined && state.correctIndex !== null) {
    if (state.batman === state.correctIndex) {
      newScoreB += state.princess === state.correctIndex ? 2 : 1;
    }
    if (state.princess === state.correctIndex) {
      newScoreP += state.batman === state.correctIndex ? 2 : 1;
    }
  }

  await prisma.gameSession.update({
    where: { id: session.id },
    data: {
      answers: JSON.stringify(answers),
      scoreBatman: newScoreB,
      scorePrincess: newScoreP,
    },
  });

  io.to(vaultId).emit('game-answer', {
    questionIndex,
    from: identity,
    answer: answerIndex,
    scores: { batman: newScoreB, princess: newScoreP },
  });

  // If both answered, reveal immediately
  if (state.batman !== undefined && state.princess !== undefined) {
    setTimeout(() => revealAnswer(prisma, io, vaultId, session, state), 600);
  }

  return { ok: true, state, scores: { batman: newScoreB, princess: newScoreP } };
}

async function getOrCreateSession(prisma, vaultId) {
  let session = await prisma.gameSession.findFirst({
    where: { vaultId, status: 'active' },
  });
  return session;
}

module.exports = {
  startGame,
  submitAnswer,
  getOrCreateSession,
  scheduleTick,
  pickQuestionOrder,
  QUESTION_TIME_MS,
  REVEAL_DELAY_MS,
};
