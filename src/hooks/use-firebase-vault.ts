/**
 * React hook for real-time vault synchronization using Firestore
 */
import { useEffect } from 'react';
import { doc, onSnapshot, type DocumentData, type QueryDocumentSnapshot, type Unsubscribe } from 'firebase/firestore';
import { getFirestoreDb } from '@/lib/firebase/client';

interface VaultSyncOptions {
  vaultId: string;
  onData: (data: DocumentData) => void;
  onError?: (error: Error) => void;
}

export function useVaultSync({ vaultId, onData, onError }: VaultSyncOptions) {
  useEffect(() => {
    if (!vaultId) return;

    const db = getFirestoreDb();
    const vaultDoc = doc(db, 'vaults', vaultId);

    const unsub: Unsubscribe = onSnapshot(vaultDoc, (snap: QueryDocumentSnapshot<DocumentData>) => {
      if (snap.exists()) {
        onData(snap.data());
      }
    }, (error: Error) => {
      onError?.(error);
    });

    return () => unsub();
  }, [vaultId, onData, onError]);

  return {};
}