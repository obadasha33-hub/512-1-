/**
 * Network State Detection
 * Detects online/offline status and provides subscription mechanism
 */

type NetworkListener = (isOnline: boolean) => void;

let isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
const listeners: Set<NetworkListener> = new Set();

/**
 * Initialize network listeners
 */
export function initNetworkDetection(): void {
  if (typeof window === 'undefined') return;

  const handleOnline = () => {
    console.log('[Network] Back online');
    isOnline = true;
    notifyListeners(true);
  };

  const handleOffline = () => {
    console.log('[Network] Offline');
    isOnline = false;
    notifyListeners(false);
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
}

/**
 * Get current online status
 */
export function getNetworkStatus(): boolean {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine;
}

/**
 * Subscribe to network status changes
 */
export function onNetworkStatusChange(callback: NetworkListener): () => void {
  listeners.add(callback);

  // Return unsubscribe function
  return () => {
    listeners.delete(callback);
  };
}

/**
 * Notify all listeners of status change
 */
function notifyListeners(status: boolean): void {
  listeners.forEach(listener => {
    try {
      listener(status);
    } catch (e) {
      console.error('[Network] Listener error:', e);
    }
  });
}

/**
 * Get list of active listeners (for debugging)
 */
export function getListenerCount(): number {
  return listeners.size;
}
