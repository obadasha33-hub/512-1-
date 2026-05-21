// API helper functions for connecting frontend to backend

const BASE = '';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  try {
    const res = await fetch(`${BASE}${url}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `HTTP ${res.status}`);
    }
    return res.json();
  } catch (err) {
    console.warn('[API] Request failed:', url, err);
    throw err;
  }
}

export const api = {
  vault: {
    get: (vaultId: string) =>
      request<{ vault: any }>(`/api/vault?vaultId=${encodeURIComponent(vaultId)}`),
    create: (data: { name?: string; theme?: string; font?: string; startDate?: string; members?: { role: string; name: string }[] }) =>
      request<{ vault: any }>('/api/vault', { method: 'POST', body: JSON.stringify(data) }),
    update: (vaultId: string, data: Record<string, any>) =>
      request<{ vault: any }>(`/api/vault/${encodeURIComponent(vaultId)}`, { method: 'PUT', body: JSON.stringify(data) }),
  },
  messages: {
    list: (vaultId: string) =>
      request<{ messages: any[] }>(`/api/vault/${encodeURIComponent(vaultId)}/messages`),
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
};
