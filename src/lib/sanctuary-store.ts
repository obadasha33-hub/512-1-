import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ThemeName, FontStyle } from './themes';
import { api } from './api';

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
export type SanctuarySubTab = 'ai' | 'dark' | 'plan' | 'vault' | 'memory';

export interface AppState {
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
  aiApiKey: string;
  signals: Signal[];
  chatOpen: boolean;
  partnerOnline: boolean;
  partnerLastSeen: string;
  replyingTo: Message | null;
  selectedMessages: number[];
  isSelectionMode: boolean;

  // Actions
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
  deleteMessage: (id: number) => void;
  addReaction: (messageId: number, reaction: string) => void;
  setSanctuaryChat: (chat: { role: 'user' | 'ai'; text: string }[]) => void;
  addSanctuaryChatMessage: (msg: { role: 'user' | 'ai'; text: string }) => void;
  setNotificationSettings: (settings: NotificationSettings) => void;
  setAutoSync: (val: boolean) => void;
  setEncryptionEnabled: (val: boolean) => void;
  setAiApiKey: (key: string) => void;
  sendSignal: (type: Signal['type']) => void;
  setChatOpen: (open: boolean) => void;
  setPartnerOnline: (online: boolean) => void;
  setReplyingTo: (msg: Message | null) => void;
  toggleSelectMessage: (id: number) => void;
  setSelectedMessages: (ids: number[]) => void;
  setSelectionMode: (val: boolean) => void;
  exitSelectionMode: () => void;
  deleteSelectedMessages: () => void;
  starMessage: (id: number) => void;
  resetApp: () => void;
  loadFromServer: () => Promise<void>;
}

function generateVaultId(): string {
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

const defaultMessages: Message[] = [
  {
    id: 1,
    type: 'received',
    senderId: 'Princess',
    text: 'Hey babe, missing you so much right now 💕',
    time: new Date(Date.now() - 3600000).toISOString(),
    status: 'seen',
    reactions: ['❤️'],
  },
  {
    id: 2,
    type: 'sent',
    senderId: 'Batman',
    text: 'I miss you too! Can\'t wait to see you tonight 🥰',
    time: new Date(Date.now() - 3500000).toISOString(),
    status: 'seen',
  },
  {
    id: 3,
    type: 'received',
    senderId: 'Princess',
    text: 'What should we do for our anniversary? 💭',
    time: new Date(Date.now() - 1800000).toISOString(),
    status: 'seen',
    reactions: ['🎀'],
  },
  {
    id: 4,
    type: 'sent',
    senderId: 'Batman',
    text: 'I was thinking a cozy dinner and maybe stargazing? ✨',
    time: new Date(Date.now() - 1700000).toISOString(),
    status: 'seen',
  },
  {
    id: 5,
    type: 'received',
    senderId: 'Princess',
    text: 'That sounds absolutely perfect! You always know just what I need 🌙',
    time: new Date(Date.now() - 600000).toISOString(),
    status: 'seen',
    reactions: ['❤️', '🔥'],
  },
];

const defaultMemoryEntries: MemoryEntry[] = [
  {
    id: 'mem1',
    content: 'Our first date at the little café downtown ☕',
    timestamp: new Date(Date.now() - 86400000 * 30).toISOString(),
    category: 'Date',
  },
  {
    id: 'mem2',
    content: 'That sunset we watched together at the beach 🌅',
    timestamp: new Date(Date.now() - 86400000 * 15).toISOString(),
    category: 'Favorite',
  },
  {
    id: 'mem3',
    content: 'Dancing in the rain after dinner 🌧️💃',
    timestamp: new Date(Date.now() - 86400000 * 5).toISOString(),
    category: 'Important',
  },
];

const defaultEvents: SanctuaryEvent[] = [
  {
    id: 'evt1',
    title: 'Anniversary Dinner',
    date: new Date(Date.now() + 86400000 * 14).toISOString(),
    type: 'Anniversary',
  },
  {
    id: 'evt2',
    title: 'Cook Together Night',
    date: new Date(Date.now() + 86400000 * 3).toISOString(),
    type: 'Date',
  },
];

const defaultLetters: LoveLetter[] = [
  {
    id: 'let1',
    from: 'You',
    to: 'Partner',
    content: 'Every moment with you feels like coming home. You make my world brighter just by being in it. I love you more than words can say. 💕',
    timestamp: new Date(Date.now() - 86400000 * 7).toISOString(),
  },
];

// Helper: Try API call, don't block on failure
function tryApi(fn: () => Promise<any>) {
  fn().catch((err) => {
    console.warn('[Store] API call failed (using local fallback):', err);
  });
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      vaultId: generateVaultId(),
      theme: 'Pinky' as ThemeName,
      font: 'Default' as FontStyle,
      identity: 'Batman' as 'Batman' | 'Princess',
      currentTab: 'home' as TabName,
      sanctuarySubTab: 'ai' as SanctuarySubTab,
      daysTogether: 512,
      relationshipStartDate: defaultStartDate,
      batmanName: 'You',
      princessName: 'Partner',
      batmanPhoto: '',
      princessPhoto: '',
      chatWallpaper: '',
      moods: [
        { userId: 'Batman', mood: '😊', timestamp: new Date().toISOString() },
        { userId: 'Princess', mood: '💖', timestamp: new Date().toISOString() },
      ],
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
      aiApiKey: '',
      signals: [],
      chatOpen: false,
      partnerOnline: true,
      partnerLastSeen: new Date().toISOString(),
      replyingTo: null,
      selectedMessages: [],
      isSelectionMode: false,

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
      },
      setPrincessPhoto: (url) => {
        set({ princessPhoto: url });
        const state = get();
        tryApi(() => api.vault.update(state.vaultId, { princessPhoto: url }));
      },
      setChatWallpaper: (url) => set({ chatWallpaper: url }),
      setMoods: (moods) => {
        set({ moods });
        // Try to sync mood update to server
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
        // Try to send to server
        if (msg.type === 'sent') {
          tryApi(() => api.messages.send(state.vaultId, {
            senderId: msg.senderId || state.identity,
            text: msg.text,
            imageUrl: msg.image,
            audioUrl: msg.audio,
          }));
        }
      },
      deleteMessage: (id) => {
        set((state) => ({
          messages: state.messages.map((m) =>
            m.id === id ? { ...m, deleted: true } : m
          ),
        }));
        const state = get();
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
      addSanctuaryChatMessage: (msg) =>
        set((state) => ({ sanctuaryChat: [...state.sanctuaryChat, msg] })),
      setNotificationSettings: (settings) =>
        set({ notificationSettings: settings }),
      setAutoSync: (val) => set({ autoSync: val }),
      setEncryptionEnabled: (val) => set({ encryptionEnabled: val }),
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
      setChatOpen: (open) => set({ chatOpen: open }),
      setPartnerOnline: (online) => set({ partnerOnline: online }),
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
        tryApi(() => api.messages.delete(state.vaultId, ids.map(String)));
      },
      starMessage: (id) => {
        set((state) => ({
          messages: state.messages.map((m) =>
            m.id === id ? { ...m, starred: !m.starred } : m
          ),
        }));
        // Note: starred is local-only (no DB column) - no API sync
      },
      resetApp: () =>
        set({
          vaultId: generateVaultId(),
          identity: 'Batman',
          currentTab: 'home',
          sanctuarySubTab: 'ai',
          messages: defaultMessages,
          sanctuaryChat: [],
          events: defaultEvents,
          letters: defaultLetters,
          memoryEntries: defaultMemoryEntries,
          moods: [
            {
              userId: 'Batman',
              mood: '😊',
              timestamp: new Date().toISOString(),
            },
            {
              userId: 'Princess',
              mood: '💖',
              timestamp: new Date().toISOString(),
            },
          ],
          aiMemory: {
            chosenInteractions: [],
            userPreferences: [],
            chatStyleNotes: [],
            explicitMemories: [],
          },
          encryptionEnabled: false,
          signals: [],
          chatOpen: false,
          replyingTo: null,
          selectedMessages: [],
          isSelectionMode: false,
        }),

      // Load data from server and merge with local
      loadFromServer: async () => {
        try {
          const state = get();
          const vaultId = state.vaultId;

          // Try to get or create the vault
          try {
            const vaultData = await api.vault.get(vaultId);
            if (vaultData.vault) {
              const v = vaultData.vault;
              const update: Partial<AppState> = {};
              if (v.theme) update.theme = v.theme as ThemeName;
              if (v.font) update.font = v.font as FontStyle;
              if (v.startDate) {
                update.relationshipStartDate = new Date(v.startDate).toISOString();
                const start = new Date(v.startDate);
                const now = new Date();
                update.daysTogether = Math.max(0, Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
              }
              if (v.members) {
                const p1 = v.members.find((m: any) => m.role === 'partner1');
                const p2 = v.members.find((m: any) => m.role === 'partner2');
                if (p1) {
                  update.batmanName = p1.name;
                  if (p1.photoUrl) update.batmanPhoto = p1.photoUrl;
                }
                if (p2) {
                  update.princessName = p2.name;
                  if (p2.photoUrl) update.princessPhoto = p2.photoUrl;
                }
              }
              set(update as any);
            }
          } catch {
            // Vault doesn't exist, create it
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

          // Try to load messages
          try {
            const msgData = await api.messages.list(vaultId);
            if (msgData.messages && msgData.messages.length > 0) {
              const serverMessages: Message[] = msgData.messages.map((m: any) => ({
                id: parseInt(m.id.replace(/\D/g, '').slice(-10), 10) || Date.now(),
                type: m.sender?.role === 'partner1' ? 'sent' : 'received',
                senderId: m.sender?.role === 'partner1' ? 'Batman' : 'Princess',
                text: m.text || undefined,
                image: m.imageUrl || undefined,
                audio: m.audioUrl || undefined,
                time: m.createdAt,
                status: m.status || 'sent',
                reactions: (() => { try { return JSON.parse(m.reactions || '[]'); } catch { return []; } })(),
                deleted: m.deleted || false,
                starred: m.starred || false,
              }));
              if (serverMessages.length > 0) {
                set({ messages: serverMessages });
              }
            }
          } catch {}

          // Try to load moods
          try {
            const moodData = await api.moods.get(vaultId);
            if (moodData.members && moodData.members.length > 0) {
              const moods: MoodEntry[] = moodData.members.map((m: any) => ({
                userId: m.role === 'partner1' ? 'Batman' : 'Princess',
                mood: m.mood || '😊',
                timestamp: m.moodUpdatedAt || new Date().toISOString(),
              }));
              set({ moods });
            }
          } catch {}

          // Try to load signals
          try {
            const signalData = await api.signals.list(vaultId);
            if (signalData.signals && signalData.signals.length > 0) {
              const signals: Signal[] = signalData.signals.map((s: any) => ({
                type: s.type,
                from: s.from === 'Batman' || s.from === 'Princess' ? s.from : 'Batman',
                timestamp: s.timestamp,
              }));
              set({ signals });
            }
          } catch {}

          // Try to load memories
          try {
            const memData = await api.memories.list(vaultId);
            if (memData.memories && memData.memories.length > 0) {
              const memories: MemoryEntry[] = memData.memories.map((m: any) => ({
                id: m.id,
                content: m.content,
                imageUrl: m.imageUrl || undefined,
                timestamp: m.createdAt,
                category: m.category || 'General',
                revealDate: m.revealDate || undefined,
              }));
              set({ memoryEntries: memories });
            }
          } catch {}
        } catch (err) {
          console.warn('[Store] Failed to load from server:', err);
        }
      },
    }),
    {
      name: 'our-sanctuary-state',
    }
  )
);
