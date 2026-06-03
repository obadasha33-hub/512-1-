// Server-side auth utilities — pure Node crypto.
// Simplified: no passphrase, no hashing, just tokens + vault codes.

const crypto = require('crypto');

const SESSION_DURATION_MS = 365 * 24 * 60 * 60 * 1000; // 1 year

function generateToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function generateVaultCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(6);
  let out = '';
  for (let i = 0; i < 6; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

function generateSanctuaryVaultId() {
  return 'vault-' + crypto.randomBytes(3).toString('hex');
}

function nowPlus(durationMs) {
  return new Date(Date.now() + durationMs);
}

function isExpired(date) {
  return !date || date.getTime() <= Date.now();
}

module.exports = {
  generateToken,
  generateVaultCode,
  generateSanctuaryVaultId,
  nowPlus,
  isExpired,
  SESSION_DURATION_MS,
};
