/**
 * Offline Message Queue
 * Ensures messages aren't lost if network fails during sync
 */

import { Message } from '../types';

const QUEUE_KEY = 'sanctuary-message-queue';

export interface QueuedMessage extends Message {
  queuedAt: string;
  retryCount?: number;
}

/**
 * Add a message to the offline queue
 */
export function queueMessage(message: Message): void {
  try {
    const queue = getQueue();
    const queuedMsg: QueuedMessage = {
      ...message,
      queuedAt: new Date().toISOString(),
      retryCount: 0,
    };
    queue.push(queuedMsg);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    console.log(`[Queue] Message ${message.id} queued. Queue size: ${queue.length}`);
  } catch (e) {
    console.error('[Queue] Failed to queue message:', e);
  }
}

/**
 * Get all queued messages
 */
export function getQueue(): QueuedMessage[] {
  try {
    const stored = localStorage.getItem(QUEUE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    console.error('[Queue] Failed to read queue:', e);
    return [];
  }
}

/**
 * Mark a message as successfully synced and remove from queue
 */
export function dequeueMessage(messageId: number | string): void {
  try {
    const queue = getQueue();
    const filtered = queue.filter(m => m.id !== messageId);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(filtered));
    console.log(`[Queue] Message ${messageId} dequeued. Remaining: ${filtered.length}`);
  } catch (e) {
    console.error('[Queue] Failed to dequeue message:', e);
  }
}

/**
 * Increment retry count for a message
 */
export function incrementRetryCount(messageId: number | string): void {
  try {
    const queue = getQueue();
    const msg = queue.find(m => m.id === messageId);
    if (msg) {
      msg.retryCount = (msg.retryCount || 0) + 1;
      localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    }
  } catch (e) {
    console.error('[Queue] Failed to increment retry:', e);
  }
}

/**
 * Clear entire queue (for debugging only)
 */
export function clearQueue(): void {
  try {
    localStorage.removeItem(QUEUE_KEY);
    console.log('[Queue] Queue cleared');
  } catch (e) {
    console.error('[Queue] Failed to clear queue:', e);
  }
}

/**
 * Get queue size
 */
export function getQueueSize(): number {
  return getQueue().length;
}
