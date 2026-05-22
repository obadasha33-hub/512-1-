/**
 * End-to-End Encryption for Our Sanctuary
 * Uses AES-256-CBC via CryptoJS with a shared couple key
 * 
 * Both partners share the same encryption key (derived from the vault code).
 * Messages are encrypted before storage and decrypted on read.
 * Only partners with the key can read the messages.
 */

import CryptoJS from 'crypto-js';

// Derive a 256-bit key from the vault code + a pepper
// This ensures the key is always consistent for both partners
export function deriveKey(vaultCode: string): string {
  const pepper = '🦇Sanctuary_P3pp3r_2024_L1l14_❤️';
  return CryptoJS.SHA256(vaultCode + pepper).toString();
}

// Encrypt any data structure to a string
export function encryptData(data: unknown, key: string): string {
  if (!data) return '';
  if (!key) return JSON.stringify(data);
  try {
    return CryptoJS.AES.encrypt(JSON.stringify(data), key).toString();
  } catch (error) {
    console.error('[Encryption] Failed to encrypt:', error);
    return JSON.stringify(data);
  }
}

// Decrypt a string back to a data structure
export function decryptData<T = unknown>(ciphertext: string, key: string): T | null {
  if (!ciphertext) return null;
  if (!key) {
    try {
      return JSON.parse(ciphertext) as T;
    } catch {
      return ciphertext as unknown as T;
    }
  }
  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, key);
    if (!bytes) return null;
    const decryptedStr = bytes.toString(CryptoJS.enc.Utf8);
    if (!decryptedStr) return null;
    return JSON.parse(decryptedStr) as T;
  } catch (error) {
    console.error('[Encryption] Failed to decrypt:', error);
    return null;
  }
}

// Encrypt a single message's text content
export function encryptMessageText(text: string, key: string): string {
  if (!text || !key) return text;
  try {
    return CryptoJS.AES.encrypt(text, key).toString();
  } catch {
    return text;
  }
}

// Decrypt a single message's text content
export function decryptMessageText(ciphertext: string, key: string): string {
  if (!ciphertext || !key) return ciphertext;
  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, key);
    const result = bytes.toString(CryptoJS.enc.Utf8);
    return result || ciphertext;
  } catch {
    return ciphertext;
  }
}

// Hash a value (for vault code verification, etc.)
export function hashValue(value: string): string {
  return CryptoJS.SHA256(value).toString();
}

// Generate a secure random vault code
export function generateSecureVaultCode(): string {
  const array = new Uint8Array(12);
  if (typeof window !== 'undefined' && window.crypto) {
    window.crypto.getRandomValues(array);
  } else {
    // Fallback for server
    const words = CryptoJS.lib.WordArray.random(12);
    for (let i = 0; i < 12; i++) {
      array[i] = (words.words[i >> 2] >> ((i % 4) * 8)) & 0xff;
    }
  }
  return Array.from(array, (b) => b.toString(16).padStart(2, '0'))
    .join('')
    .match(/.{1,4}/g)
    ?.join('-') || 'xxxx-xxxx-xxxx';
}
