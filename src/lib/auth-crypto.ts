import { randomBytes } from 'crypto';

export const SESSION_DURATION_MS = 365 * 24 * 60 * 60 * 1000; // 1 year

export function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

export function generateVaultCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(6);
  let out = '';
  for (let i = 0; i < 6; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

export function generateSanctuaryVaultId(): string {
  return 'vault-' + randomBytes(3).toString('hex');
}

export function nowPlus(durationMs: number): Date {
  return new Date(Date.now() + durationMs);
}

export function isExpired(date: Date | null | undefined): boolean {
  return !date || date.getTime() <= Date.now();
}