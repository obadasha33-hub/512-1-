/**
 * IndexedDB Storage Layer for Our Sanctuary
 * Replaces localStorage for large data (messages, media references)
 * Supports encryption at rest via the encryption module
 */

import { encryptData, decryptData, deriveKey } from './encryption';

const DB_NAME = 'sanctuary-db';
const DB_VERSION = 2;

// Store names
const STORES = {
  MESSAGES: 'messages',
  AI_CHAT: 'aiChat',
  MEDIA: 'media',
  MEMORIES: 'memories',
  EVENTS: 'events',
  OFFLINE_QUEUE: 'offlineQueue',
} as const;

let dbInstance: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Messages store - keyed by composite [vaultId, timestamp]
      if (!db.objectStoreNames.contains(STORES.MESSAGES)) {
        const msgStore = db.createObjectStore(STORES.MESSAGES, { keyPath: 'id' });
        msgStore.createIndex('vaultId', 'vaultId', { unique: false });
        msgStore.createIndex('vaultId_time', ['vaultId', 'time'], { unique: false });
      }

      // AI Chat store
      if (!db.objectStoreNames.contains(STORES.AI_CHAT)) {
        const chatStore = db.createObjectStore(STORES.AI_CHAT, { keyPath: 'id', autoIncrement: true });
        chatStore.createIndex('vaultId', 'vaultId', { unique: false });
      }

      // Media store - for large blobs
      if (!db.objectStoreNames.contains(STORES.MEDIA)) {
        const mediaStore = db.createObjectStore(STORES.MEDIA, { keyPath: 'id' });
        mediaStore.createIndex('vaultId', 'vaultId', { unique: false });
      }

      // Memories store
      if (!db.objectStoreNames.contains(STORES.MEMORIES)) {
        const memStore = db.createObjectStore(STORES.MEMORIES, { keyPath: 'id' });
        memStore.createIndex('vaultId', 'vaultId', { unique: false });
      }

      // Events store
      if (!db.objectStoreNames.contains(STORES.EVENTS)) {
        const evtStore = db.createObjectStore(STORES.EVENTS, { keyPath: 'id' });
        evtStore.createIndex('vaultId', 'vaultId', { unique: false });
      }

      // Offline Queue store (for Feature 5)
      if (!db.objectStoreNames.contains(STORES.OFFLINE_QUEUE)) {
        const queueStore = db.createObjectStore(STORES.OFFLINE_QUEUE, { keyPath: 'id' });
        queueStore.createIndex('vaultId', 'vaultId', { unique: false });
      }
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };
  });
}

// ─── Messages ───────────────────────────────────────────────────────────────

export async function saveMessage(msg: any, vaultId: string, encryptionKey?: string): Promise<void> {
  const db = await openDB();
  const key = encryptionKey ? deriveKey(encryptionKey) : '';
  
  const record: any = {
    ...msg,
    vaultId,
    // Encrypt text content if encryption is enabled
    text: msg.text && key ? encryptData(msg.text, key) : msg.text,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.MESSAGES, 'readwrite');
    const store = tx.objectStore(STORES.MESSAGES);
    store.put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function saveMessages(messages: any[], vaultId: string, encryptionKey?: string): Promise<void> {
  const db = await openDB();
  const key = encryptionKey ? deriveKey(encryptionKey) : '';

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.MESSAGES, 'readwrite');
    const store = tx.objectStore(STORES.MESSAGES);

    for (const msg of messages) {
      const record: any = {
        ...msg,
        vaultId,
        text: msg.text && key ? encryptData(msg.text, key) : msg.text,
      };
      store.put(record);
    }

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadMessages(vaultId: string, encryptionKey?: string): Promise<any[]> {
  const db = await openDB();
  const key = encryptionKey ? deriveKey(encryptionKey) : '';

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.MESSAGES, 'readonly');
    const store = tx.objectStore(STORES.MESSAGES);
    const index = store.index('vaultId');
    const request = index.getAll(vaultId);

    request.onsuccess = () => {
      const messages = request.result.map((msg: any) => ({
        ...msg,
        // Decrypt text content if encryption is enabled
        text: msg.text && key ? (decryptData<string>(msg.text, key) || msg.text) : msg.text,
      }));
      resolve(messages);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function deleteMessage(id: number | string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.MESSAGES, 'readwrite');
    const store = tx.objectStore(STORES.MESSAGES);
    store.delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearMessages(vaultId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.MESSAGES, 'readwrite');
    const store = tx.objectStore(STORES.MESSAGES);
    const index = store.index('vaultId');
    const request = index.openCursor(vaultId);

    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ─── AI Chat ────────────────────────────────────────────────────────────────

export async function saveAIChatMessage(vaultId: string, msg: { role: string; text: string }, encryptionKey?: string): Promise<void> {
  const db = await openDB();
  const key = encryptionKey ? deriveKey(encryptionKey) : '';

  const record = {
    vaultId,
    role: msg.role,
    text: key ? encryptData(msg.text, key) : msg.text,
    timestamp: Date.now(),
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.AI_CHAT, 'readwrite');
    const store = tx.objectStore(STORES.AI_CHAT);
    store.put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadAIChat(vaultId: string, encryptionKey?: string): Promise<{ role: 'user' | 'ai'; text: string }[]> {
  const db = await openDB();
  const key = encryptionKey ? deriveKey(encryptionKey) : '';

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.AI_CHAT, 'readonly');
    const store = tx.objectStore(STORES.AI_CHAT);
    const index = store.index('vaultId');
    const request = index.getAll(vaultId);

    request.onsuccess = () => {
      const messages = request.result.map((msg: any) => ({
        role: (msg.role === 'ai' ? 'ai' : 'user') as 'user' | 'ai',
        text: key ? (decryptData<string>(msg.text, key) || msg.text) : msg.text,
      }));
      resolve(messages);
    };
    request.onerror = () => reject(request.error);
  });
}

// ─── Media Blobs ────────────────────────────────────────────────────────────

export async function saveMediaBlob(id: string, vaultId: string, blob: Blob): Promise<void> {
  const db = await openDB();
  const record = { id, vaultId, blob, timestamp: Date.now() };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.MEDIA, 'readwrite');
    const store = tx.objectStore(STORES.MEDIA);
    store.put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadMediaBlob(id: string): Promise<Blob | null> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.MEDIA, 'readonly');
    const store = tx.objectStore(STORES.MEDIA);
    const request = store.get(id);

    request.onsuccess = () => {
      resolve(request.result?.blob || null);
    };
    request.onerror = () => reject(request.error);
  });
}

// ─── Generic Stats ──────────────────────────────────────────────────────────

export async function getStorageStats(vaultId: string): Promise<{
  messageCount: number;
  aiChatCount: number;
  mediaCount: number;
}> {
  const db = await openDB();

  const countStore = (storeName: string, indexName: string): Promise<number> => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const index = store.index(indexName);
      const request = index.count(vaultId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  };

  const [messageCount, aiChatCount, mediaCount] = await Promise.all([
    countStore(STORES.MESSAGES, 'vaultId'),
    countStore(STORES.AI_CHAT, 'vaultId'),
    countStore(STORES.MEDIA, 'vaultId'),
  ]);

  return { messageCount, aiChatCount, mediaCount };
}

// ─── Migration from localStorage ────────────────────────────────────────────

export async function migrateFromLocalStorage(
  vaultId: string,
  messages: any[],
  aiChat: { role: string; text: string }[],
  encryptionKey?: string,
): Promise<void> {
  // Migrate messages
  if (messages.length > 0) {
    await saveMessages(messages, vaultId, encryptionKey);
  }

  // Migrate AI chat
  for (const msg of aiChat) {
    await saveAIChatMessage(vaultId, msg, encryptionKey);
  }
}

// Check if IndexedDB has already been populated
export async function isMigrated(vaultId: string): Promise<boolean> {
  const stats = await getStorageStats(vaultId);
  return stats.messageCount > 0;
}

// ─── Storage Management ──────────────────────────────────────────────────────

export async function getStorageEstimate(): Promise<{ usage: number; quota: number }> {
  if (navigator.storage && navigator.storage.estimate) {
    const estimate = await navigator.storage.estimate();
    return {
      usage: estimate.usage || 0,
      quota: estimate.quota || 0,
    };
  }
  return { usage: 0, quota: 0 };
}

export async function clearOldMessages(vaultId: string, olderThanDays: number): Promise<number> {
  const db = await openDB();
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000).toISOString();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.MESSAGES, 'readwrite');
    const store = tx.objectStore(STORES.MESSAGES);
    const index = store.index('vaultId');
    const request = index.openCursor(vaultId);
    let deletedCount = 0;

    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;
      if (cursor) {
        const msg = cursor.value;
        if (msg.time && msg.time < cutoff) {
          cursor.delete();
          deletedCount++;
        }
        cursor.continue();
      }
    };

    tx.oncomplete = () => resolve(deletedCount);
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearMediaCache(vaultId: string): Promise<number> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.MEDIA, 'readwrite');
    const store = tx.objectStore(STORES.MEDIA);
    const index = store.index('vaultId');
    const request = index.openCursor(vaultId);
    let deletedCount = 0;

    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;
      if (cursor) {
        cursor.delete();
        deletedCount++;
        cursor.continue();
      }
    };

    tx.oncomplete = () => resolve(deletedCount);
    tx.onerror = () => reject(tx.error);
  });
}

// ─── Offline Queue (Feature 5) ──────────────────────────────────────────────

export interface OfflineQueueItem {
  id: string;
  vaultId: string;
  message: any;
  timestamp: number;
}

export async function saveOfflineMessage(item: OfflineQueueItem): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.OFFLINE_QUEUE, 'readwrite');
    const store = tx.objectStore(STORES.OFFLINE_QUEUE);
    store.put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadOfflineQueue(vaultId: string): Promise<OfflineQueueItem[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.OFFLINE_QUEUE, 'readonly');
    const store = tx.objectStore(STORES.OFFLINE_QUEUE);
    const index = store.index('vaultId');
    const request = index.getAll(vaultId);
    request.onsuccess = () => {
      // Sort by timestamp ascending
      const items = (request.result as OfflineQueueItem[]).sort((a, b) => a.timestamp - b.timestamp);
      resolve(items);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function clearOfflineQueue(vaultId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.OFFLINE_QUEUE, 'readwrite');
    const store = tx.objectStore(STORES.OFFLINE_QUEUE);
    const index = store.index('vaultId');
    const request = index.openCursor(vaultId);

    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
