/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import CryptoJS from 'crypto-js';

export const encryptData = (data: any, key: string): string => {
  if (!data) return "";
  if (!key) return JSON.stringify(data);
  return CryptoJS.AES.encrypt(JSON.stringify(data), key).toString();
};

export const decryptData = (ciphertext: string, key: string): any => {
  if (!ciphertext) return null;
  if (!key) {
    try {
      return JSON.parse(ciphertext);
    } catch {
      return ciphertext;
    }
  }
  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, key);
    if (!bytes) return null;
    const decryptedData = bytes.toString(CryptoJS.enc.Utf8);
    if (!decryptedData) return null;
    return JSON.parse(decryptedData);
  } catch (error) {
    console.error('Decryption failed', error);
    return null;
  }
};
