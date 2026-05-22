import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ThemeName, FontStyle } from './themes';
import { api } from './api';
import {
  saveMessage,
  loadMessages,
  deleteMessage as idbDeleteMessage,
  clearMessages as idbClearMessages,
  saveAIChatMessage,
  loadAIChat,
  migrateFromLocalStorage,
  isMigrated,
} from './idb-storage';
import { deriveKey, encryptMessageText, decryptMessageText, generateSecureVaultCode } from './encryption';

export interface MoodEntry {
  userId: 'Batman' | 'Princess';
  mood: string;
  timestamp: string;
}

export interface SanctuaryEvent {
  id: string;
  title: string;
  date: string;
  type: 'Date' | 'Goal' | 'Anniversary';
}

export interface LoveLetter {
  id: string;
  from: string;
  to: string;
  content: string;
  timestamp: string;
  read?: boolean;
}

export interface MemoryEntry {
  id: string;
  content: string;
  imageUrl?: string;
  timestamp: string;
  category?: 'General' | 'Joke' | 'Favorite' | 'Date' | 'Important';
  revealDate?: string;
  reminder?: 'none' | '1M' | '1Y';
}

export interface AIMemory {
  chosenInteractions: string[];
  userPreferences: string[];
  chatStyleNotes: string[];
  explicitMemories: MemoryEntry[];
}

export type MessageType = 'text' | 'image' | 'video' | 'audio' | 'document';

export interface Message {
  id: number;
  type: 'received' | 'sent';
  senderId?: 'Batman' | 'Princess';
  text?: string;
  image?: string;
  audio?: string;
  video?: string;
  audioDuration?: number;
  time: string;
  status?: 'sent' | 'received' | 'seen';
  reactions?: string[];
  replyTo?: {
    id: number;
    text?: string;
    sender: string;
  };
  deleted?: boolean;
  starred?: boolean;
  messageType?: MessageType;
  fileName?: string;
  fileSize?: number;
  documentUrl?: string;
  waveform?: number[];
}

export interface NotificationSettings {
  messages: boolean;
  signals: boolean;
  memories: boolean;
  moodUpdates: boolean;
  sound: boolean;
  vibration: boolean;
  showPreview: boolean;
}

export interface Signal {
  type: 'miss' | 'hug' | 'kiss';
  from: 'Batman' | 'Princess';
  timestamp: string;
}

export type TabName = 'home' | 'chat' | 'memories' | 'settings' | 'sanctuary';
export type SanctuarySubTab = 'ai' | 'dark' | 'plan' | 'vault' | 'memory' | 'game';

export interface AppState {
  setupComplete: boolean;
  vaultId: string;
  theme: ThemeName;
  font: FontStyle;
  identity: 'Batman' | 'Princess';
  currentTab: TabName;
  sanctuarySubTab: SanctuarySubTab;
  daysTogether: number;
  relationshipStartDate: string;
  batmanName: string;
  princessName: string;
  batmanPhoto: string;
  princessPhoto: string;
  chatWallpaper: string;
  moods: MoodEntry[];
  events: SanctuaryEvent[];
  letters: LoveLetter[];
  aiMemory: AIMemory;
  memoryEntries: MemoryEntry[];
  messages: Message[];
  sanctuaryChat: { role: 'user' | 'ai'; text: string }[];
  notificationSettings: NotificationSettings;
  autoSync: boolean;
  encryptionEnabled: boolean;
  encryptionKey: string;
  aiApiKey: string;
  signals: Signal[];
  chatOpen: boolean;
  partnerOnline: boolean;
  partnerLastSeen: string;
  replyingTo: Message | null;
  selectedMessages: number[];
  isSelectionMode: boolean;

  // Chat mute state
  chatMuted: boolean;

  // WebSocket state (not persisted)
  wsConnected: boolean;
  partnerTypingWS: boolean;

  // Auth state
  isAuthenticated: boolean;

  // Hydration tracking
  _hasHydrated: boolean;

  // Sync tracking
  lastSyncTimestamp: string;

  // Actions
  completeSetup: (data: { myName: string; partnerName: string; vaultCode: string; identity: 'Batman' | 'Princess'; relationshipStartDate?: string }) => void;
  setWsConnected: (connected: boolean) => void;
  setPartnerTypingWS: (typing: boolean) => void;
  setTab: (tab: TabName) => void;
  setSanctuarySubTab: (tab: SanctuarySubTab) => void;
  setTheme: (theme: ThemeName) => void;
  setFont: (font: FontStyle) => void;
  setIdentity: (identity: 'Batman' | 'Princess') => void;
  setRelationshipStartDate: (date: string) => void;
  setBatmanName: (name: string) => void;
  setPrincessName: (name: string) => void;
  setBatmanPhoto: (url: string) => void;
  setPrincessPhoto: (url: string) => void;
  setChatWallpaper: (url: string) => void;
  setMoods: (moods: MoodEntry[]) => void;
  setEvents: (events: SanctuaryEvent[]) => void;
  setLetters: (letters: LoveLetter[]) => void;
  setAiMemory: (aiMemory: AIMemory) => void;
  setMemoryEntries: (entries: MemoryEntry[]) => void;
  addMemoryEntry: (entry: MemoryEntry) => void;
  setMessages: (messages: Message[]) => void;
  addMessage: (msg: Message) => void;
  addReceivedMessage: (msg: Message) => void;
  updateMessageStatus: (messageId: number, status: 'sent' | 'received' | 'seen') => void;
  deleteMessage: (id: number) => void;
  addReaction: (messageId: number, reaction: string) => void;
  setSanctuaryChat: (chat: { role: 'user' | 'ai'; text: string }[]) => void;
  addSanctuaryChatMessage: (msg: { role: 'user' | 'ai'; text: string }) => void;
  setNotificationSettings: (settings: NotificationSettings) => void;
  setAutoSync: (val: boolean) => void;
  setEncryptionEnabled: (val: boolean) => void;
  setEncryptionKey: (key: string) => void;
  setAiApiKey: (key: string) => void;
  sendSignal: (type: Signal['type']) => void;
  setChatMuted: (muted: boolean) => void;
  setChatOpen: (open: boolean) => void;
  setPartnerOnline: (online: boolean) => void;
  setPartnerLastSeen: (lastSeen: string) => void;
  setReplyingTo: (msg: Message | null) => void;
  toggleSelectMessage: (id: number) => void;
  setSelectedMessages: (ids: number[]) => void;
  setSelectionMode: (val: boolean) => void;
  exitSelectionMode: () => void;
  deleteSelectedMessages: () => void;
  starMessage: (id: number) => void;
  unstarMessage: (id: number) => void;
  markLetterRead: (letterId: string) => void;
  resetApp: () => void;
  loadFromServer: () => Promise<void>;
  loadFromIDB: () => Promise<void>;
  setAuthenticated: (val: boolean) => void;
  setLastSyncTimestamp: (ts: string) => void;
}

function generateVaultId(): string {
  // Use crypto-secure random if available
  if (typeof window !== 'undefined' && window.crypto) {
    return generateSecureVaultCode();
  }
  return 'xxxx-xxxx-xxxx'.replace(/x/g, () =>
    Math.floor(Math.random() * 16).toString(16)
  );
}

const defaultStartDate = new Date(
  new Date().setDate(new Date().getDate() - 512)
).toISOString();

const defaultNotificationSettings: NotificationSettings = {
  messages: true,
  signals: true,
  memories: true,
  moodUpdates: true,
  sound: true,
  vibration: true,
  showPreview: true,
};

const defaultMessages: Message[] = [];
const defaultMemoryEntries: MemoryEntry[] = [];
const defaultEvents: SanctuaryEvent[] = [];
const defaultLetters: LoveLetter[] = [];

// Helper: Try API call, don't block on failure
function tryApi(fn: () => Promise<any>) {
  fn().catch((err) => {
    console.warn('[Store] API call failed (using local fallback):', err);
  });
}

// Get encryption key for current vault
function getEncryptionKey(vaultId: string, encryptionEnabled: boolean, encryptionKey: string): string | undefined {
  if (!encryptionEnabled || !encryptionKey) return undefined;
  return deriveKey(encryptionKey);
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      setupComplete: false,
      vaultId: generateVaultId(),
      theme: 'Pinky' as ThemeName,
      font: 'Default' as FontStyle,
      identity: 'Batman' as 'Batman' | 'Princess',
      currentTab: 'home' as TabName,
      sanctuarySubTab: 'ai' as SanctuarySubTab,
      daysTogether: 0,
      relationshipStartDate: new Date().toISOString(),
      batmanName: 'Me',
      princessName: 'My Love',
      batmanPhoto: '',
      princessPhoto: '',
      chatWallpaper: '',
      moods: [],
      events: defaultEvents,
      letters: defaultLetters,
      aiMemory: {
        chosenInteractions: [],
        userPreferences: [],
        chatStyleNotes: [],
        explicitMemories: [],
      },
      memoryEntries: defaultMemoryEntries,
      messages: defaultMessages,
      sanctuaryChat: [],
      notificationSettings: { ...defaultNotificationSettings },
      autoSync: false,
      encryptionEnabled: false,
      encryptionKey: '',
      aiApiKey: '',
      signals: [],
      chatMuted: false,
      chatOpen: false,
      partnerOnline: false,
      partnerLastSeen: new Date().toISOString(),
      replyingTo: null,
      selectedMessages: [],
      isSelectionMode: false,

      // WebSocket state
      wsConnected: false,
      partnerTypingWS: false,

      // Auth state
      isAuthenticated: false,

      // Hydration tracking
      _hasHydrated: false,

      // Sync tracking
      lastSyncTimestamp: '',

      completeSetup: (data) => {
        const startDate = data.relationshipStartDate || new Date().toISOString();
        const start = new Date(startDate);
        const now = new Date();
        const days = Math.max(0, Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));

        set({
          setupComplete: true,
          batmanName: data.identity === 'Batman' ? data.myName : data.partnerName,
          princessName: data.identity === 'Princess' ? data.myName : data.partnerName,
          identity: data.identity,
          vaultId: data.vaultCode,
          relationshipStartDate: startDate,
          daysTogether: days,
          isAuthenticated: true,
        });

        // Try to create the vault on server
        const state = get();
        tryApi(() => api.vault.create({
          name: 'Our Sanctuary',
          theme: state.theme,
          font: state.font,
          startDate: startDate,
          members: [
            { role: 'partner1', name: state.batmanName },
            { role: 'partner2', name: state.princessName },
          ],
        }));
      },

      setWsConnected: (connected) => set({ wsConnected: connected }),
      setPartnerTypingWS: (typing) => set({ partnerTypingWS: typing }),

      setTab: (tab) => set({ currentTab: tab }),
      setSanctuarySubTab: (tab) => set({ sanctuarySubTab: tab }),
      setTheme: (theme) => {
        set({ theme });
        const state = get();
        tryApi(() => api.vault.update(state.vaultId, { theme }));
      },
      setFont: (font) => {
        set({ font });
        const state = get();
        tryApi(() => api.vault.update(state.vaultId, { font }));
      },
      setIdentity: (identity) => set({ identity }),
      setRelationshipStartDate: (date) => {
        const start = new Date(date);
        const now = new Date();
        const days = Math.max(0, Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
        set({ relationshipStartDate: date, daysTogether: days });
        const state = get();
        tryApi(() => api.vault.update(state.vaultId, { startDate: date }));
      },
      setBatmanName: (name) => {
        set({ batmanName: name });
        const state = get();
        tryApi(() => api.vault.update(state.vaultId, { batmanName: name }));
      },
      setPrincessName: (name) => {
        set({ princessName: name });
        const state = get();
        tryApi(() => api.vault.update(state.vaultId, { princessName: name }));
      },
      setBatmanPhoto: (url) => {
        set({ batmanPhoto: url });
        const state = get();
        tryApi(() => api.vault.update(state.vaultId, { batmanPhoto: url }));
        // Emit profile photo update via socket
        if (typeof window !== 'undefined') {
          try { (window as any).__sanctuarySocket?.emitProfilePhotoUpdate('Batman', url); } catch {}
        }
      },
      setPrincessPhoto: (url) => {
        set({ princessPhoto: url });
        const state = get();
        tryApi(() => api.vault.update(state.vaultId, { princessPhoto: url }));
        // Emit profile photo update via socket
        if (typeof window !== 'undefined') {
          try { (window as any).__sanctuarySocket?.emitProfilePhotoUpdate('Princess', url); } catch {}
        }
      },
      setChatWallpaper: (url) => set({ chatWallpaper: url }),
      setMoods: (moods) => {
        set({ moods });
        const state = get();
        const updatedMood = moods.find((m) => m.userId === state.identity);
        if (updatedMood) {
          tryApi(() => api.moods.update(state.vaultId, updatedMood.userId, updatedMood.mood));
        }
      },
      setEvents: (events) => set({ events }),
      setLetters: (letters) => set({ letters }),
      setAiMemory: (aiMemory) => set({ aiMemory }),
      setMemoryEntries: (entries) => set({ memoryEntries: entries }),
      addMemoryEntry: (entry) => {
        set((state) => ({ memoryEntries: [entry, ...state.memoryEntries] }));
        const state = get();
        tryApi(() => api.memories.add(state.vaultId, {
          content: entry.content,
          imageUrl: entry.imageUrl,
          category: entry.category,
          revealDate: entry.revealDate,
        }));
      },
      setMessages: (messages) => set({ messages }),
      addMessage: (msg) => {
        set((state) => ({ messages: [...state.messages, msg] }));
        const state = get();
        const encKey = getEncryptionKey(state.vaultId, state.encryptionEnabled, state.encryptionKey);

        // Save to IndexedDB (with encryption if enabled)
        saveMessage(msg, state.vaultId, state.encryptionEnabled ? state.encryptionKey : undefined).catch((err) => {
          console.warn('[Store] IDB save failed:', err);
        });

        // Save to server API (with encrypted text if enabled)
        if (msg.type === 'sent') {
          const textToSend = msg.text && encKey ? encryptMessageText(msg.text, encKey) : msg.text;
          tryApi(() => api.messages.send(state.vaultId, {
            senderId: msg.senderId || state.identity,
            text: textToSend,
            imageUrl: msg.image,
            audioUrl: msg.audio,
            videoUrl: msg.video,
            documentUrl: msg.documentUrl,
            replyToId: msg.replyTo ? String(msg.replyTo.id) : undefined,
            replyToText: msg.replyTo?.text,
            replyToSender: msg.replyTo?.sender,
          }));
        }
      },
      addReceivedMessage: (msg) => {
        set((state) => ({ messages: [...state.messages, msg] }));
        const state = get();
        const encKey = getEncryptionKey(state.vaultId, state.encryptionEnabled, state.encryptionKey);

        // FIX: Also save received messages to IndexedDB + server
        saveMessage(msg, state.vaultId, state.encryptionEnabled ? state.encryptionKey : undefined).catch((err) => {
          console.warn('[Store] IDB save failed for received msg:', err);
        });

        // FIX: Also persist received messages to server DB
        const textToSend = msg.text && encKey ? encryptMessageText(msg.text, encKey) : msg.text;
        tryApi(() => api.messages.send(state.vaultId, {
          senderId: msg.senderId || (msg.type === 'received' ? 'Princess' : 'Batman'),
          text: textToSend,
          imageUrl: msg.image,
          audioUrl: msg.audio,
          videoUrl: msg.video,
          documentUrl: msg.documentUrl,
          replyToId: msg.replyTo ? String(msg.replyTo.id) : undefined,
        }));
      },
      updateMessageStatus: (messageId, status) => {
        set((state) => ({
          messages: state.messages.map((m) =>
            m.id === messageId ? { ...m, status } : m
          ),
        }));
      },
      deleteMessage: (id) => {
        set((state) => ({
          messages: state.messages.map((m) =>
            m.id === id ? { ...m, deleted: true } : m
          ),
        }));
        const state = get();
        idbDeleteMessage(id).catch(() => {});
        tryApi(() => api.messages.delete(state.vaultId, [String(id)]));
      },
      addReaction: (messageId, reaction) => {
        set((state) => ({
          messages: state.messages.map((m) =>
            m.id === messageId
              ? { ...m, reactions: [...(m.reactions || []), reaction] }
              : m
          ),
        }));
        const state = get();
        const msg = state.messages.find((m) => m.id === messageId);
        if (msg) {
          tryApi(() => api.messages.update(state.vaultId, String(messageId), {
            reactions: JSON.stringify(msg.reactions),
          }));
        }
      },
      setSanctuaryChat: (chat) => set({ sanctuaryChat: chat }),
      addSanctuaryChatMessage: (msg) => {
        set((state) => ({ sanctuaryChat: [...state.sanctuaryChat, msg] }));
        const state = get();
        saveAIChatMessage(state.vaultId, msg, state.encryptionEnabled ? state.encryptionKey : undefined).catch(() => {});
      },
      setNotificationSettings: (settings) =>
        set({ notificationSettings: settings }),
      setAutoSync: (val) => set({ autoSync: val }),
      setEncryptionEnabled: (val) => set({ encryptionEnabled: val }),
      setEncryptionKey: (key) => set({ encryptionKey: key }),
      setAiApiKey: (key) => set({ aiApiKey: key }),
      sendSignal: (type) => {
        set((state) => ({
          signals: [
            ...state.signals,
            {
              type,
              from: state.identity,
              timestamp: new Date().toISOString(),
            },
          ],
        }));
        const state = get();
        tryApi(() => api.signals.send(state.vaultId, type, state.identity));
      },
      setChatMuted: (muted) => set({ chatMuted: muted }),
      setChatOpen: (open) => set({ chatOpen: open }),
      setPartnerOnline: (online) => set({ partnerOnline: online }),
      setPartnerLastSeen: (lastSeen) => set({ partnerLastSeen: lastSeen }),
      setReplyingTo: (msg) => set({ replyingTo: msg }),
      toggleSelectMessage: (id) =>
        set((state) => {
          const isSelected = state.selectedMessages.includes(id);
          const newSelected = isSelected
            ? state.selectedMessages.filter((sid) => sid !== id)
            : [...state.selectedMessages, id];
          return {
            selectedMessages: newSelected,
            isSelectionMode: newSelected.length > 0,
          };
        }),
      setSelectedMessages: (ids) => set({ selectedMessages: ids, isSelectionMode: ids.length > 0 }),
      setSelectionMode: (val) => set({ isSelectionMode: val, selectedMessages: [] }),
      exitSelectionMode: () => set({ selectedMessages: [], isSelectionMode: false }),
      deleteSelectedMessages: () => {
        const state = get();
        const ids = state.selectedMessages;
        set((s) => ({
          messages: s.messages.map((m) =>
            s.selectedMessages.includes(m.id) ? { ...m, deleted: true } : m
          ),
          selectedMessages: [],
          isSelectionMode: false,
        }));
        ids.forEach(id => idbDeleteMessage(id).catch(() => {}));
        tryApi(() => api.messages.delete(state.vaultId, ids.map(String)));
      },
      starMessage: (id) => {
        set((state) => ({
          messages: state.messages.map((m) =>
            m.id === id ? { ...m, starred: true } : m
          ),
        }));
        const state = get();
        const msg = state.messages.find((m) => m.id === id);
        if (msg) {
          tryApi(() => api.messages.update(state.vaultId, String(id), { starred: true }));
        }
      },
      unstarMessage: (id) => {
        set((state) => ({
          messages: state.messages.map((m) =>
            m.id === id ? { ...m, starred: false } : m
          ),
        }));
        const state = get();
        tryApi(() => api.messages.update(state.vaultId, String(id), { starred: false }));
      },
      markLetterRead: (letterId) => {
        set((state) => ({
          letters: state.letters.map((l) =>
            l.id === letterId ? { ...l, read: true } : l
          ),
        }));
      },
      setAuthenticated: (val) => set({ isAuthenticated: val }),
      setLastSyncTimestamp: (ts) => set({ lastSyncTimestamp: ts }),
      setHasHydrated: (val: boolean) => set({ _hasHydrated: val }),
      resetApp: () => {
        const state = get();
        // Clear IndexedDB data
        idbClearMessages(state.vaultId).catch(() => {});
        set({
          setupComplete: false,
          vaultId: generateVaultId(),
          identity: 'Batman',
          currentTab: 'home',
          sanctuarySubTab: 'ai',
          messages: defaultMessages,
          sanctuaryChat: [],
          events: defaultEvents,
          letters: defaultLetters,
          memoryEntries: defaultMemoryEntries,
          moods: [],
          aiMemory: {
            chosenInteractions: [],
            userPreferences: [],
            chatStyleNotes: [],
            explicitMemories: [],
          },
          encryptionEnabled: false,
          encryptionKey: '',
          signals: [],
          chatMuted: false,
          chatOpen: false,
          replyingTo: null,
          selectedMessages: [],
          isSelectionMode: false,
          wsConnected: false,
          partnerTypingWS: false,
          partnerOnline: false,
          lastSyncTimestamp: '',
          daysTogether: 0,
          relationshipStartDate: new Date().toISOString(),
          batmanName: 'Me',
          princessName: 'My Love',
          batmanPhoto: '',
          princessPhoto: '',
          chatWallpaper: '',
          notificationSettings: { ...defaultNotificationSettings },
          autoSync: false,
          aiApiKey: '',
          isAuthenticated: false,
        });
      },

      // Load data from IndexedDB
      loadFromIDB: async () => {
        try {
          const state = get();
          const messages = await loadMessages(
            state.vaultId,
            state.encryptionEnabled ? state.encryptionKey : undefined
          );
          if (messages.length > 0) {
            set({ messages });
          }

          const aiChat = await loadAIChat(
            state.vaultId,
            state.encryptionEnabled ? state.encryptionKey : undefined
          );
          if (aiChat.length > 0) {
            set({ sanctuaryChat: aiChat });
          }
        } catch (err) {
          console.warn('[Store] Failed to load from IDB:', err);
        }
      },

      // Load data from server and merge with local — BATCH all updates into ONE set() call
      loadFromServer: async () => {
        try {
          const state = get();
          const vaultId = state.vaultId;
          const encKey = getEncryptionKey(vaultId, state.encryptionEnabled, state.encryptionKey);
          const batchUpdate: Partial<AppState> = {};

          // Try to get or create the vault
          try {
            const vaultData = await api.vault.get(vaultId);
            if (vaultData.vault) {
              const v = vaultData.vault;
              if (v.theme) batchUpdate.theme = v.theme as ThemeName;
              if (v.font) batchUpdate.font = v.font as FontStyle;
              if (v.startDate) {
                batchUpdate.relationshipStartDate = new Date(v.startDate).toISOString();
                const start = new Date(v.startDate);
                const now = new Date();
                batchUpdate.daysTogether = Math.max(0, Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
              }
              if (v.members) {
                const p1 = v.members.find((m: any) => m.role === 'partner1');
                const p2 = v.members.find((m: any) => m.role === 'partner2');
                if (p1) {
                  batchUpdate.batmanName = p1.name;
                  if (p1.photoUrl) batchUpdate.batmanPhoto = p1.photoUrl;
                }
                if (p2) {
                  batchUpdate.princessName = p2.name;
                  if (p2.photoUrl) batchUpdate.princessPhoto = p2.photoUrl;
                }
              }
            }
          } catch {
            try {
              await api.vault.create({
                name: 'Our Sanctuary',
                theme: state.theme,
                font: state.font,
                startDate: state.relationshipStartDate,
                members: [
                  { role: 'partner1', name: state.batmanName },
                  { role: 'partner2', name: state.princessName },
                ],
              });
            } catch {}
          }

          // Try to load messages from server — MERGE with local, don't overwrite
          try {
            const msgData = await api.messages.list(vaultId);
            if (msgData.messages && msgData.messages.length > 0) {
              const serverMessages: Message[] = msgData.messages.map((m: any) => ({
                id: parseInt(m.id.replace(/\D/g, '').slice(-10), 10) || Date.now(),
                type: m.sender?.role === 'partner1' ? 'sent' : 'received',
                senderId: m.sender?.role === 'partner1' ? 'Batman' : 'Princess',
                text: m.text && encKey ? decryptMessageText(m.text, encKey) : (m.text || undefined),
                image: m.imageUrl || undefined,
                audio: m.audioUrl || undefined,
                video: m.videoUrl || undefined,
                time: m.createdAt,
                status: m.status || 'sent',
                reactions: (() => { try { return JSON.parse(m.reactions || '[]'); } catch { return []; } })(),
                deleted: m.deleted || false,
                starred: m.starred || false,
                messageType: (m.messageType || 'text') as MessageType,
              }));
              if (serverMessages.length > 0) {
                const localMsgs = get().messages;
                const localIds = new Set(localMsgs.map(m => m.id));
                const merged = [
                  ...serverMessages,
                  ...localMsgs.filter(m => !localIds.has(m.id) || !serverMessages.find(s => s.id === m.id))
                ];
                const seen = new Set<number>();
                const unique = merged.filter(m => {
                  if (seen.has(m.id)) return false;
                  seen.add(m.id);
                  return true;
                });
                batchUpdate.messages = unique;
              }
            }
          } catch {}

          // Try to load moods
          try {
            const moodData = await api.moods.get(vaultId);
            if (moodData.members && moodData.members.length > 0) {
              batchUpdate.moods = moodData.members.map((m: any) => ({
                userId: m.role === 'partner1' ? 'Batman' : 'Princess',
                mood: m.mood || '😊',
                timestamp: m.moodUpdatedAt || new Date().toISOString(),
              }));
            }
          } catch {}

          // Try to load signals
          try {
            const signalData = await api.signals.list(vaultId);
            if (signalData.signals && signalData.signals.length > 0) {
              batchUpdate.signals = signalData.signals.map((s: any) => ({
                type: s.type,
                from: s.from === 'Batman' || s.from === 'Princess' ? s.from : 'Batman',
                timestamp: s.timestamp,
              }));
            }
          } catch {}

          // Try to load memories
          try {
            const memData = await api.memories.list(vaultId);
            if (memData.memories && memData.memories.length > 0) {
              batchUpdate.memoryEntries = memData.memories.map((m: any) => ({
                id: m.id,
                content: m.content,
                imageUrl: m.imageUrl || undefined,
                timestamp: m.createdAt,
                category: m.category || 'General',
                revealDate: m.revealDate || undefined,
              }));
            }
          } catch {}

          // SINGLE batch update — one set() call instead of 5+
          batchUpdate.lastSyncTimestamp = new Date().toISOString();
          if (Object.keys(batchUpdate).length > 1) {
            set(batchUpdate as any);
          }
        } catch (err) {
          console.warn('[Store] Failed to load from server:', err);
          set({ lastSyncTimestamp: new Date().toISOString() });
        }
      },
    }),
    {
      name: 'our-sanctuary-state',
      version: 2,
      // Use localStorage only for settings/small data — messages go to IndexedDB
      partialize: (state) => {
        const {
          wsConnected,
          partnerTypingWS,
          messages,        // Stored in IndexedDB now
          sanctuaryChat,   // Stored in IndexedDB now
          _hasHydrated,    // Never persist this
          ...persisted
        } = state;
        return persisted;
      },
      // NOTE: We do NOT use onRehydrateStorage here because it runs
      // during create() — referencing useAppStore inside it causes a
      // TDZ error ("Cannot access 'lb' before initialization" in prod).
      // Instead, hydration tracking is handled via store.subscribe() in
      // the app component, which runs after the store is fully created.
      // Migrate from old localStorage format (v1 had messages in localStorage)
      migrate: (persistedState: any, version: number) => {
        if (version === 0 || version === 1) {
          // Old format had messages and sanctuaryChat in localStorage
          // Migrate them to IndexedDB before they get dropped
          const oldMessages = persistedState.messages || [];
          const oldChat = persistedState.sanctuaryChat || [];
          const vaultId = persistedState.vaultId;
          const encKey = persistedState.encryptionEnabled ? persistedState.encryptionKey : undefined;

          if (oldMessages.length > 0 && vaultId) {
            // Fire-and-forget migration to IndexedDB
            migrateFromLocalStorage(vaultId, oldMessages, oldChat, encKey).catch((err) => {
              console.warn('[Store] Migration to IDB failed:', err);
            });
          }

          // Add new fields with defaults
          return {
            ...persistedState,
            encryptionKey: persistedState.encryptionKey || '',
            isAuthenticated: persistedState.isAuthenticated || persistedState.setupComplete || false,
          };
        }
        return persistedState;
      },
    }
  )
);
