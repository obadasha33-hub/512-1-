import crypto from 'crypto';

export const SESSION_DURATION_MS = 365 * 24 * 60 * 60 * 1000;

export function generateToken() {
  return crypto.randomBytes(32).toString('base64url');
}

export function generateVaultCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(6);
  let out = '';
  for (let i = 0; i < 6; i++) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

export function generateSanctuaryVaultId() {
  return 'vault-' + crypto.randomBytes(3).toString('hex');
}
