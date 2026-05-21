import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ThemeName, FontStyle } from './themes';

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
  time: string;
  status?: 'sent' | 'received' | 'seen';
  reactions?: string[];
  replyTo?: {
    id: number;
    text?: string;
    sender: string;
  };
  deleted?: boolean;
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
  resetApp: () => void;
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

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
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

      setTab: (tab) => set({ currentTab: tab }),
      setSanctuarySubTab: (tab) => set({ sanctuarySubTab: tab }),
      setTheme: (theme) => set({ theme }),
      setFont: (font) => set({ font }),
      setIdentity: (identity) => set({ identity }),
      setRelationshipStartDate: (date) => {
        const start = new Date(date);
        const now = new Date();
        const days = Math.max(0, Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
        set({ relationshipStartDate: date, daysTogether: days });
      },
      setBatmanName: (name) => set({ batmanName: name }),
      setPrincessName: (name) => set({ princessName: name }),
      setBatmanPhoto: (url) => set({ batmanPhoto: url }),
      setPrincessPhoto: (url) => set({ princessPhoto: url }),
      setChatWallpaper: (url) => set({ chatWallpaper: url }),
      setMoods: (moods) => set({ moods }),
      setEvents: (events) => set({ events }),
      setLetters: (letters) => set({ letters }),
      setAiMemory: (aiMemory) => set({ aiMemory }),
      setMemoryEntries: (entries) => set({ memoryEntries: entries }),
      addMemoryEntry: (entry) =>
        set((state) => ({ memoryEntries: [entry, ...state.memoryEntries] })),
      setMessages: (messages) => set({ messages }),
      addMessage: (msg) =>
        set((state) => ({ messages: [...state.messages, msg] })),
      deleteMessage: (id) =>
        set((state) => ({
          messages: state.messages.map((m) =>
            m.id === id ? { ...m, deleted: true } : m
          ),
        })),
      addReaction: (messageId, reaction) =>
        set((state) => ({
          messages: state.messages.map((m) =>
            m.id === messageId
              ? { ...m, reactions: [...(m.reactions || []), reaction] }
              : m
          ),
        })),
      setSanctuaryChat: (chat) => set({ sanctuaryChat: chat }),
      addSanctuaryChatMessage: (msg) =>
        set((state) => ({ sanctuaryChat: [...state.sanctuaryChat, msg] })),
      setNotificationSettings: (settings) =>
        set({ notificationSettings: settings }),
      setAutoSync: (val) => set({ autoSync: val }),
      setEncryptionEnabled: (val) => set({ encryptionEnabled: val }),
      setAiApiKey: (key) => set({ aiApiKey: key }),
      sendSignal: (type) =>
        set((state) => ({
          signals: [
            ...state.signals,
            {
              type,
              from: state.identity,
              timestamp: new Date().toISOString(),
            },
          ],
        })),
      setChatOpen: (open) => set({ chatOpen: open }),
      setPartnerOnline: (online) => set({ partnerOnline: online }),
      setReplyingTo: (msg) => set({ replyingTo: msg }),
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
        }),
    }),
    {
      name: 'our-sanctuary-state',
    }
  )
);
