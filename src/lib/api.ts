// API helper functions for connecting frontend to backend.
// All requests include a Bearer token if the user is authenticated.

export const DEFAULT_SERVER_URL =
  (process.env.NEXT_PUBLIC_SANCTUARY_SERVER_URL || 'https://512-1-production.up.railway.app').replace(/\/$/, '');

// ── Auth storage ──────────────────────────────────────────────────────────
// Token + memberId are persisted in localStorage so the app stays logged in
// across restarts. The SetupScreen and Settings > Lock call these helpers.

const AUTH_KEY = 'sanctuary-auth';

export interface StoredAuth {
  sessionToken: string;
  memberId: string;
  vaultId: string;
  identity: 'Batman' | 'Princess';
  vaultCode: string;
  expiresAt: string;
}

export function getStoredAuth(): StoredAuth | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredAuth;
    if (!parsed.sessionToken || !parsed.memberId || !parsed.vaultId) return null;
    if (parsed.expiresAt && new Date(parsed.expiresAt).getTime() <= Date.now()) {
      localStorage.removeItem(AUTH_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function setStoredAuth(auth: StoredAuth) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(AUTH_KEY, JSON.stringify(auth));
}

export function clearStoredAuth() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(AUTH_KEY);
}

function authHeader(): Record<string, string> {
  const auth = getStoredAuth();
  if (!auth) return {};
  return { Authorization: `Bearer ${auth.sessionToken}` };
}

// Detect if running inside Capacitor
function isCapacitor(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(window as any).Capacitor || (window.location.protocol === 'https:' && window.location.hostname === 'localhost');
}

// Get the API base URL — in Capacitor, use the configured server URL
export function getApiBase(): string {
  if (!isCapacitor()) return '';
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('sanctuary-server-url');
    if (saved) return saved.replace(/\/$/, '');
  }
  return DEFAULT_SERVER_URL;
}

export function buildApiUrl(path: string): string {
  const base = getApiBase();
  if (!base) return path;
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

export function withApiBase(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (/^(https?:|data:|blob:)/i.test(url)) return url;
  return buildApiUrl(url);
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const base = getApiBase();
  try {
    const res = await fetch(`${base}${url}`, {
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      ...options,
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Request failed' }));
      const err: any = new Error(error.error || `HTTP ${res.status}`);
      err.status = res.status;
      // Session expired or invalid — clear stored auth so the app can re-prompt
      if (res.status === 401 && !url.startsWith('/api/auth/')) {
        try { clearStoredAuth(); } catch {}
        if (typeof window !== 'undefined') {
          // Lazy import the store to avoid circular deps
          try {
            const { useAppStore } = await import('./sanctuary-store');
            useAppStore.setState({ setupComplete: false });
          } catch {}
        }
      }
      throw err;
    }
    return res.json();
  } catch (err) {
    console.warn('[API] Request failed:', url, err);
    throw err;
  }
}

// Auth endpoints (no Bearer header required) — simplified for personal use, no passphrase needed.
export const auth = {
  create: (data: { name: string; identity: 'Batman' | 'Princess'; memberName: string; theme?: string; font?: string; startDate?: string }) =>
    request<{ vaultId: string; vaultCode: string; memberId: string; identity: 'Batman' | 'Princess'; sessionToken: string; expiresAt: string }>(
      '/api/auth/create',
      { method: 'POST', body: JSON.stringify(data) }
    ),
  join: (data: { vaultCode: string; identity: 'Batman' | 'Princess'; memberName: string }) =>
    request<{ vaultId: string; memberId: string; identity: 'Batman' | 'Princess'; sessionToken: string; expiresAt: string }>(
      '/api/auth/join',
      { method: 'POST', body: JSON.stringify(data) }
    ),
  login: (data: { vaultCode: string; memberId?: string; identity?: 'Batman' | 'Princess' }) =>
    request<{ vaultId: string; memberId: string; identity: 'Batman' | 'Princess'; sessionToken: string; expiresAt: string }>(
      '/api/auth/login',
      { method: 'POST', body: JSON.stringify(data) }
    ),
  lock: () => request<{ ok: boolean }>('/api/auth/lock', { method: 'POST' }),
};

export const api = {
  vault: {
    get: (vaultId: string) =>
      request<{ vault: any; currentMemberId: string }>(`/api/vault?vaultId=${encodeURIComponent(vaultId)}`),
    create: (data: { id?: string; name?: string; theme?: string; font?: string; startDate?: string; members?: { role: string; name: string }[] }) =>
      request<{ vault: any }>('/api/vault', { method: 'POST', body: JSON.stringify(data) }),
    update: (vaultId: string, data: Record<string, any>) =>
      request<{ vault: any }>(`/api/vault?vaultId=${encodeURIComponent(vaultId)}`, { method: 'PUT', body: JSON.stringify(data) }),
  },
  messages: {
    list: (vaultId: string, cursor?: string) =>
      request<{ messages: any[]; nextCursor: string | null; hasMore: boolean }>(
        `/api/vault/${encodeURIComponent(vaultId)}/messages${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`
      ),
    send: (vaultId: string, msg: { senderId: string; text?: string; imageUrl?: string; audioUrl?: string; videoUrl?: string; documentUrl?: string; replyToId?: string; replyToText?: string; replyToSender?: string; messageType?: string; fileName?: string; fileSize?: number }) =>
      request<{ message: any }>(`/api/vault/${encodeURIComponent(vaultId)}/messages`, { method: 'POST', body: JSON.stringify(msg) }),
    update: (vaultId: string, msgId: string, data: { reactions?: string; status?: string; starred?: boolean; replyToId?: string | null }) =>
      request<{ message: any }>(`/api/vault/${encodeURIComponent(vaultId)}/messages?msgId=${encodeURIComponent(msgId)}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (vaultId: string, msgIds: string[]) =>
      request<{ count: number }>(`/api/vault/${encodeURIComponent(vaultId)}/messages`, { method: 'DELETE', body: JSON.stringify({ msgIds }) }),
  },
  moods: {
    get: (vaultId: string) =>
      request<{ members: any[] }>(`/api/vault/${encodeURIComponent(vaultId)}/moods`),
    update: (vaultId: string, memberId: string, mood: string) =>
      request<{ member: any }>(`/api/vault/${encodeURIComponent(vaultId)}/moods`, { method: 'PUT', body: JSON.stringify({ memberId, mood }) }),
  },
  signals: {
    send: (vaultId: string, type: string, senderId: string) =>
      request<{ event: any }>(`/api/vault/${encodeURIComponent(vaultId)}/signals`, { method: 'POST', body: JSON.stringify({ type, senderId }) }),
    list: (vaultId: string) =>
      request<{ signals: any[] }>(`/api/vault/${encodeURIComponent(vaultId)}/signals`),
  },
  memories: {
    list: (vaultId: string) =>
      request<{ memories: any[] }>(`/api/vault/${encodeURIComponent(vaultId)}/memories`),
    add: (vaultId: string, memory: { content: string; imageUrl?: string; category?: string; revealDate?: string }) =>
      request<{ memory: any }>(`/api/vault/${encodeURIComponent(vaultId)}/memories`, { method: 'POST', body: JSON.stringify(memory) }),
    update: (vaultId: string, memoryId: string, data: Record<string, any>) =>
      request<{ memory: any }>(`/api/vault/${encodeURIComponent(vaultId)}/memories?memoryId=${encodeURIComponent(memoryId)}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (vaultId: string, memoryId: string) =>
      request<{ success: boolean }>(`/api/vault/${encodeURIComponent(vaultId)}/memories?memoryId=${encodeURIComponent(memoryId)}`, { method: 'DELETE' }),
  },
  ai: {
    send: (message: string, history: { role: 'user' | 'assistant' | 'system'; content: string }[] = []) =>
      request<{ reply: string; userMessageId: string; assistantMessageId: string }>(
        '/api/ai',
        { method: 'POST', body: JSON.stringify({ message, history }) }
      ),
    history: () =>
      request<{ messages: any[] }>('/api/ai'),
  },
  fcmRegister: (vaultId: string, token: string) =>
    request<{ ok: boolean }>('/api/push-token', { method: 'POST', body: JSON.stringify({ token }) }),
  fcmUnregister: (vaultId: string) =>
    request<{ ok: boolean }>('/api/push-token', { method: 'DELETE' }),
};
