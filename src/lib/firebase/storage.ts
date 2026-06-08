/**
 * Firebase Storage for file uploads (optional - falls back to Cloudinary/local)
 * Note: Firebase Storage requires Blaze (paid) plan.
 * This module is a placeholder for when you upgrade.
 */
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getFirebaseApp } from './client';

let storageInitialized = false;

function getStorageInstance() {
  if (!storageInitialized && typeof window !== 'undefined') {
    try {
      getStorage(getFirebaseApp());
      storageInitialized = true;
    } catch {
      // Firebase Storage not available - will fall back to other methods
    }
  }
}

export async function uploadFile(path: string, file: File | Blob, filename?: string): Promise<string | null> {
  // Firebase Storage requires Blaze plan - return null to trigger fallback
  return null;
}

export async function uploadMediaFile(vaultId: string, file: File | Blob, type: 'image' | 'video' | 'audio' | 'document'): Promise<string | null> {
  // Use Cloudinary (set CLOUDINARY_* env vars) or local storage
  return null;
}