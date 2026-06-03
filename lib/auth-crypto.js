// Server-side auth utilities — pure Node crypto, no external deps.
// PBKDF2-SHA256 with 100k iterations for password hashing.
// Tokens are 32 random bytes (256 bits), base64url.

const crypto = require('crypto');

const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_KEYLEN = 32;
const PBKDF2_DIGEST = 'sha256';
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const PAIRING_CODE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const LOCKOUT_DURATION_MS = 5 * 60 * 1000; // 5 min after 5 failed attempts
const MAX_FAILED_ATTEMPTS = 5;

function generateSalt() {
  return crypto.randomBytes(16).toString('base64');
}

function hashPassphrase(passphrase, salt) {
  if (typeof passphrase !== 'string' || !passphrase) {
    throw new Error('Passphrase required');
  }
  if (typeof salt !== 'string' || !salt) {
    throw new Error('Salt required');
  }
  return crypto
    .pbkdf2Sync(passphrase.normalize('NFKC'), salt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST)
    .toString('base64');
}

function verifyPassphrase(passphrase, salt, expectedHash) {
  if (!expectedHash || !salt) return false;
  try {
    const candidate = hashPassphrase(passphrase, salt);
    if (candidate.length !== expectedHash.length) return false;
    return crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(expectedHash));
  } catch {
    return false;
  }
}

function generateToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function generateVaultCode() {
  // 6 chars, uppercase + digits, no I/O/0/1 for clarity
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(6);
  let out = '';
  for (let i = 0; i < 6; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

function generatePairingCode() {
  // 6-digit numeric pairing code
  const n = crypto.randomInt(0, 1_000_000);
  return String(n).padStart(6, '0');
}

function generateSanctuaryVaultId() {
  // 6-char hex suffix to match existing convention
  return 'vault-' + crypto.randomBytes(3).toString('hex');
}

function nowPlus(durationMs) {
  return new Date(Date.now() + durationMs);
}

function isExpired(date) {
  return !date || date.getTime() <= Date.now();
}

module.exports = {
  // crypto
  generateSalt,
  hashPassphrase,
  verifyPassphrase,
  generateToken,
  generateVaultCode,
  generatePairingCode,
  generateSanctuaryVaultId,
  nowPlus,
  isExpired,
  // constants
  SESSION_DURATION_MS,
  PAIRING_CODE_TTL_MS,
  LOCKOUT_DURATION_MS,
  MAX_FAILED_ATTEMPTS,
};
