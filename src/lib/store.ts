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

export type TabName = 'home' | 'chat' | 'memories' | 'settings' | 'sanctuary';

export interface AppState {
  vaultId: string;
  theme: ThemeName;
  font: FontStyle;
  identity: 'Batman' | 'Princess';
  currentTab: TabName;
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
  messages: Message[];
  sanctuaryChat: { role: 'user' | 'ai'; text: string }[];
  notificationSettings: NotificationSettings;
  autoSync: boolean;
  encryptionKey: string;

  // Actions
  setTab: (tab: TabName) => void;
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
  setMessages: (messages: Message[]) => void;
  addMessage: (msg: Message) => void;
  setSanctuaryChat: (chat: { role: 'user' | 'ai'; text: string }[]) => void;
  setNotificationSettings: (settings: NotificationSettings) => void;
  setAutoSync: (val: boolean) => void;
  setEncryptionKey: (key: string) => void;
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

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      vaultId: generateVaultId(),
      theme: 'Pinky' as ThemeName,
      font: 'Default' as FontStyle,
      identity: 'Batman' as 'Batman' | 'Princess',
      currentTab: 'home' as TabName,
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
      events: [],
      letters: [],
      aiMemory: {
        chosenInteractions: [],
        userPreferences: [],
        chatStyleNotes: [],
        explicitMemories: [],
      },
      messages: [],
      sanctuaryChat: [],
      notificationSettings: { ...defaultNotificationSettings },
      autoSync: false,
      encryptionKey: '',

      setTab: (tab) => set({ currentTab: tab }),
      setTheme: (theme) => set({ theme }),
      setFont: (font) => set({ font }),
      setIdentity: (identity) => set({ identity }),
      setRelationshipStartDate: (date) =>
        set({ relationshipStartDate: date }),
      setBatmanName: (name) => set({ batmanName: name }),
      setPrincessName: (name) => set({ princessName: name }),
      setBatmanPhoto: (url) => set({ batmanPhoto: url }),
      setPrincessPhoto: (url) => set({ princessPhoto: url }),
      setChatWallpaper: (url) => set({ chatWallpaper: url }),
      setMoods: (moods) => set({ moods }),
      setEvents: (events) => set({ events }),
      setLetters: (letters) => set({ letters }),
      setAiMemory: (aiMemory) => set({ aiMemory }),
      setMessages: (messages) => set({ messages }),
      addMessage: (msg) =>
        set((state) => ({ messages: [...state.messages, msg] })),
      setSanctuaryChat: (chat) => set({ sanctuaryChat: chat }),
      setNotificationSettings: (settings) =>
        set({ notificationSettings: settings }),
      setAutoSync: (val) => set({ autoSync: val }),
      setEncryptionKey: (key) => set({ encryptionKey: key }),
      resetApp: () =>
        set({
          vaultId: generateVaultId(),
          identity: 'Batman',
          currentTab: 'home',
          messages: [],
          sanctuaryChat: [],
          events: [],
          letters: [],
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
          encryptionKey: '',
        }),
    }),
    {
      name: 'our-sanctuary-state',
    }
  )
);
