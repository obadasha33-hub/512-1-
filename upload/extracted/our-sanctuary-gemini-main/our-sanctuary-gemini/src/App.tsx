/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, lazy, Suspense } from 'react';
import { doc, onSnapshot, getDoc, setDoc } from './lib/supabaseFirestoreCompat';
import { db } from './lib/supabaseFirestoreCompat';
import SetupScreen from './components/SetupScreen';
const HomeScreen = lazy(() => import('./screens/HomeScreen'));
const ChatScreen = lazy(() => import('./screens/ChatScreen'));
const MemoriesScreen = lazy(() => import('./screens/MemoriesScreen'));
const SanctuaryScreen = lazy(() => import('./screens/SanctuaryScreen'));
const SettingsScreen = lazy(() => import('./screens/SettingsScreen'));
import { THEMES, ThemeName, FontStyle, FONTS, AppState, Message, DEFAULT_NOTIFICATION_SETTINGS } from './types';
import { ASSETS } from './constants';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, Home, MessageCircle, Image as ImageIcon, Settings, Sparkles, ShieldCheck, Search, X } from 'lucide-react';
import { encryptData, decryptData } from './lib/encryption';
import { initFCM, requestFCMPermission, registerDeviceToken, onForegroundMessage } from './lib/fcm';
import { initNetworkDetection, onNetworkStatusChange } from './lib/networkDetection';
import { getQueue, dequeueMessage } from './lib/messageQueue';
import { dispatchNotification, requestNotificationPermission, setNotificationSettings, resetNotificationService } from './lib/notificationService';
import InAppToast from './components/InAppToast';
import { App as CapApp } from '@capacitor/app';
import ErrorBoundary from './components/ErrorBoundary';

export default function App() {
  const [isNavHidden, setIsNavHidden] = useState(false);
  const [lastMessageId, setLastMessageId] = useState<number | null>(null);
  const [lastSignalTime, setLastSignalTime] = useState<string | null>(null);
  const [lastMemoryId, setLastMemoryId] = useState<string | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const [state, setState] = useState<AppState>({
    theme: 'Pinky',
    font: 'Default',
    identity: null,
    currentTab: 'home',
    daysTogether: 512,
    relationshipStartDate: new Date(new Date().setDate(new Date().getDate() - 512)).toISOString(),
    batmanName: 'Obada',
    princessName: 'Lilia',
    moods: [],
    events: [],
    letters: [],
    aiMemory: {
      chosenInteractions: [],
      userPreferences: [],
      chatStyleNotes: [],
      explicitMemories: [],
    },
    sanctuaryChat: [],
    messages: [],
    notificationSettings: { ...DEFAULT_NOTIFICATION_SETTINGS },
    notificationHistory: [],
  });

  const stateRef = React.useRef<AppState>(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Hardware back button for Android
  const lastBackPress = React.useRef(0);
  useEffect(() => {
    const initBackButton = async () => {
      try {
        const listener = await CapApp.addListener('backButton', ({ canGoBack }) => {
          if (stateRef.current.currentTab !== 'home') {
             setState(s => ({ ...s, currentTab: 'home' }));
             setIsNavHidden(false); 
          } else {
             const now = Date.now();
             if (now - lastBackPress.current < 2000) {
               CapApp.exitApp();
             } else {
               lastBackPress.current = now;
             }
          }
        });
        return listener;
      } catch (e) {
        console.log("Not running in Capacitor or backButton not supported");
        return null;
      }
    };
    const listenerPromise = initBackButton();
    
    return () => {
      listenerPromise.then(listener => listener?.remove?.()).catch(() => {});
    };
  }, []);

  // AUTH & SESSION MANAGEMENT
  useEffect(() => {
    const checkAuth = async () => {
      setState(s => ({ ...s, isLoggedIn: true, userEmail: 'Anonymous' }));
      setIsAuthChecking(false);
    };
    checkAuth();
  }, []);

  // FCM INIT & NOTIFICATION PERMISSIONS
  useEffect(() => {
    initFCM()
    requestNotificationPermission()
    const saved = localStorage.getItem('after-dark-notification-settings')
    if (saved) {
      try { setNotificationSettings(JSON.parse(saved)) } catch {}
    }
  }, []);

  // NETWORK DETECTION & OFFLINE QUEUE RETRY
  useEffect(() => {
    initNetworkDetection();
    
    const unsubscribe = onNetworkStatusChange((isOnline) => {
      console.log(`[App] Network status: ${isOnline ? 'online' : 'offline'}`);
      
      // Retry queued messages when coming back online
      if (isOnline && state.vaultId) {
        const queue = getQueue();
        if (queue.length > 0) {
          console.log(`[App] Retrying ${queue.length} queued messages...`);
          // Messages will be retried automatically by ChatScreen's sync handler
        }
      }
    });
    
    return unsubscribe;
  }, [state.vaultId]);

  // FCM TOKEN REGISTRATION
  useEffect(() => {
    if (!state.isLoggedIn || !state.vaultId || !state.identity) return;
    let cancelled = false;
    const register = async () => {
      try {
        const token = await requestFCMPermission();
        if (token && !cancelled) {
          await registerDeviceToken(state.vaultId, state.identity, token);
        }
      } catch (e) {
        console.error('[FCM] Registration failed:', e);
      }
    };
    register();
    return () => { cancelled = true };
  }, [state.isLoggedIn, state.vaultId, state.identity]);

  // FCM FOREGROUND MESSAGES
  useEffect(() => {
    if (!state.isLoggedIn) return;
    const unsub = onForegroundMessage((payload) => {
      const { title, body } = payload.notification || {};
      if (title && body) {
        dispatchNotification('system', title, body, { skipRemote: true });
      }
    });
    return unsub;
  }, [state.isLoggedIn]);

  // LOCAL CACHE LOAD
  useEffect(() => {
    if (!state.isLoggedIn) return;
    const cached = localStorage.getItem('after-dark-vault-state');
    if (cached) {
      try {
        let parsed = JSON.parse(cached);
        if (parsed && typeof parsed === 'object') {
          if (parsed.isEncrypted && stateRef.current.encryptionKey) {
            const decrypted = decryptData(parsed.encryptedPayload, stateRef.current.encryptionKey);
            if (decrypted) parsed = decrypted;
          }
          setState(prev => ({ ...prev, ...parsed, currentTab: prev.currentTab })); 
          if (parsed.messages && Array.isArray(parsed.messages) && parsed.messages.length > 0) {
            setLastMessageId(parsed.messages[parsed.messages.length - 1].id);
          }
        }
      } catch (e) {
        console.error("Local cache load failed:", e);
      }
    }
    // Load locally-stored secrets that are never synced to cloud
    const savedApiKey = localStorage.getItem('after-dark-gemini-api-key');
    if (savedApiKey) setState(s => ({ ...s, geminiApiKey: savedApiKey }));
    const savedEncKey = localStorage.getItem('after-dark-encryption-key');
    if (savedEncKey) setState(s => ({ ...s, encryptionKey: savedEncKey }));
  }, [state.isLoggedIn]);

  // PERSIST STATE LOCALLY (debounced)
  useEffect(() => {
    if (!state.identity || !state.vaultId) return;
    const timer = setTimeout(() => {
      let storageData: any = state;
      if (state.encryptionKey) {
        storageData = {
          ...state,
          messages: [],
          isEncrypted: true,
          encryptedPayload: encryptData({ ...state, messages: [] }, state.encryptionKey)
        };
      }
      localStorage.setItem('after-dark-vault-state', JSON.stringify(storageData));
    }, 500);
    return () => clearTimeout(timer);
  }, [state]);

  // REAL-TIME SYNC
  useEffect(() => {
    if (!state.isLoggedIn || !state.vaultId) return;

    console.log("[Sync] Starting listener for vault:", state.vaultId);
    const unsub = onSnapshot(doc(db, "couples", state.vaultId), (snapshot) => {
      console.log("[Sync] Snapshot received", snapshot.exists() ? "with data" : "empty");
      if (snapshot.exists()) {
        let data = snapshot.data();
        
        // Decrypt if necessary
        if (data.isEncrypted && stateRef.current.encryptionKey) {
          const decrypted = decryptData(data.encryptedPayload, stateRef.current.encryptionKey);
          if (decrypted) data = { ...decrypted, ...data };
        }

        setState(prev => {
          const cloudMessages = (data.messages && Array.isArray(data.messages)) ? data.messages : [];
          const localMessages = prev.messages || [];
          
          const messageMap = new Map();
          localMessages.forEach((m: any) => messageMap.set(m.id, m));
          cloudMessages.forEach((m: any) => messageMap.set(m.id, m));
          
          const newMessages = Array.from(messageMap.values())
            .sort((a: any, b: any) => (a.id || 0) - (b.id || 0));

          const newMoods = data.moods || prev.moods || [];
          const newExplicitMemories = data.aiMemory?.explicitMemories || prev.aiMemory.explicitMemories || [];

          return {
            ...prev,
            ...data,
            theme: prev.theme, // preserve local theme override
            font: prev.font,   // preserve local font override
            messages: newMessages,
            moods: newMoods,
            batmanName: data.batmanName || prev.batmanName,
            princessName: data.princessName || prev.princessName,
            aiMemory: {
              ...prev.aiMemory,
              ...(data.aiMemory || {}),
              explicitMemories: newExplicitMemories,
              userPreferences: data.aiMemory?.userPreferences || prev.aiMemory.userPreferences || [],
              chatStyleNotes: data.aiMemory?.chatStyleNotes || prev.aiMemory.chatStyleNotes || [],
              chosenInteractions: data.aiMemory?.chosenInteractions || prev.aiMemory.chosenInteractions || [],
            }
          };
        });
      }
    }, (error) => {
      console.error("[Sync] Snapshot error:", error);
    });

    return () => unsub();
  }, [state.isLoggedIn, state.vaultId]);


  // Watch for Notifications & Signals
  useEffect(() => {
    if (!state.identity || !state.vaultId) return;

    // 1. Message Notifications
    const lastMsg = state.messages[state.messages.length - 1];
    if (lastMsg && lastMsg.id !== lastMessageId) {
      setLastMessageId(lastMsg.id);

      if (lastMsg.senderId !== state.identity && state.currentTab !== 'chat') {
        const partnerName = state.identity === 'Batman' ? state.princessName : state.batmanName;
        const partnerPhoto = state.identity === 'Batman' ? state.princessPhoto : state.batmanPhoto;
        const body = lastMsg.text || (lastMsg.image ? '📷 Image' : lastMsg.audio ? '🎤 Voice message' : lastMsg.video ? '🎥 Video' : '📎 Media');

        dispatchNotification('message', partnerName, body, {
          imageUrl: partnerPhoto,
          data: { messageId: String(lastMsg.id) },
          vaultId: state.vaultId,
          senderId: state.identity,
          partnerPhoto,
        });
      }
    }

    // 2. Signals
    if (state.activeSignal && state.activeSignal.timestamp !== lastSignalTime) {
      setLastSignalTime(state.activeSignal.timestamp);

      if (state.activeSignal.senderId !== state.identity) {
        const senderName = state.activeSignal.senderId === 'Batman' ? state.batmanName : state.princessName;
        const senderPhoto = state.activeSignal.senderId === 'Batman' ? state.batmanPhoto : state.princessPhoto;
        const signalMessages: Record<string, string> = {
          miss: `${senderName} misses you 💕`,
          hug: `${senderName} needs a hug 🤗`,
          kiss: `${senderName} needs a fucking kiss 💋`,
        };
        const body = signalMessages[state.activeSignal.type] || 'Sent a signal';

        dispatchNotification('signal', senderName, body, {
          imageUrl: senderPhoto,
          data: { signalType: state.activeSignal.type },
          vaultId: state.vaultId,
          senderId: state.identity,
          partnerPhoto: senderPhoto,
        });
      }
    }

    // 3. Memories
    const memories = state.aiMemory?.explicitMemories || [];
    const lastMemory = memories[0];
    if (lastMemory && lastMemory.id !== lastMemoryId) {
      setLastMemoryId(lastMemory.id);

      if (state.currentTab !== 'memories') {
        const partnerName = state.identity === 'Batman' ? state.princessName : state.batmanName;
        const body = `Added a new memory: ${lastMemory.content.slice(0, 30)}...`;

        dispatchNotification('memory', partnerName, body, {
          vaultId: state.vaultId,
          senderId: state.identity,
        });
      }
    }
  }, [state.messages, state.activeSignal, state.aiMemory, state.identity, state.currentTab, state.vaultId, lastSignalTime, lastMemoryId, lastMessageId]);

  // PRESENCE SYNC
  useEffect(() => {
    if (!state.isLoggedIn || !state.identity) return;

    const updatePresence = async (isOnline: boolean) => {
      const currentVaultId = stateRef.current.vaultId;
      const currentIdentity = stateRef.current.identity;
      if (!currentVaultId || !currentIdentity) return;

      try {
        const { doc, setDoc } = await import('./lib/supabaseFirestoreCompat');
        const { db } = await import('./lib/supabaseFirestoreCompat');
        const presenceData = stateRef.current.presenceStatus || [];
        const myIndex = presenceData.findIndex(p => p.userId === currentIdentity);
        let newPresenceData = [...presenceData];
        const entry = { userId: currentIdentity as 'Batman'|'Princess', isOnline, lastSeen: new Date().toISOString() };
        if (myIndex > -1) {
          if (newPresenceData[myIndex].isOnline === isOnline && 
              new Date().getTime() - new Date(newPresenceData[myIndex].lastSeen).getTime() < 60000) {
            return; // Throttle presence updates if no change and recent
          }
          newPresenceData[myIndex] = entry;
        } else {
          newPresenceData.push(entry);
        }

        await setDoc(doc(db, "couples", currentVaultId), {
          presenceStatus: newPresenceData
        }, { merge: true });
        
        setState(s => ({ ...s, presenceStatus: newPresenceData }));
      } catch (e) {
        console.error("Presence update failed:", e);
      }
    };

    updatePresence(true);
    let interval: any = null;
    let isAppActive = true;

    const startHeartbeat = () => {
      if (interval) clearInterval(interval);
      interval = setInterval(() => {
        if (isAppActive) updatePresence(true);
      }, 30000);
    };
    startHeartbeat();

    const handleVisibilityChange = () => {
      const visible = document.visibilityState === 'visible';
      isAppActive = visible;
      updatePresence(visible);
      if (visible) startHeartbeat();
      else if (interval) clearInterval(interval);
    };

    const handleBeforeUnload = () => {
      isAppActive = false;
      updatePresence(false);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);

    const initAppState = async () => {
      try {
        const { App: CapApp } = await import('@capacitor/app');
        const appStateListener = await CapApp.addListener('appStateChange', ({ isActive }) => {
          isAppActive = isActive;
          updatePresence(isActive);
          if (isActive) startHeartbeat();
          else if (interval) clearInterval(interval);
        });
        return appStateListener;
      } catch (e) {
        console.log("Not running in Capacitor");
        return null;
      }
    };

    const appStatePromise = initAppState();

    return () => {
      if (interval) clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      appStatePromise.then(l => l?.remove?.()).catch(() => {});
      updatePresence(false);
    }
  }, [state.isLoggedIn, state.identity]);

  const themeVars = useMemo(() => {
    const colors = THEMES[state.theme] || THEMES.Pinky;
    return {
      '--color-primary': colors.primary,
      '--color-on-primary': colors.onPrimary,
      '--color-primary-container': colors.primaryContainer,
      '--color-on-primary-container': colors.onPrimaryContainer,
      '--color-background': colors.background,
      '--color-on-background': colors.onBackground,
      '--color-surface': colors.surface,
      '--color-on-surface': colors.onSurface,
      '--color-surface-container': colors.surfaceContainer,
      '--color-accent': colors.accent,
      '--color-text-main': colors.textMain,
      '--color-text-sub': colors.textSub,
    } as React.CSSProperties;
  }, [state.theme]);

  if (isAuthChecking || (!state.isLoggedIn && !state.identity)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FFF0F6]">
        <div className="animate-bounce text-4xl">💖</div>
      </div>
    );
  }

  if (!state.identity || !state.vaultId) {
    return <SetupScreen onComplete={async (data) => {
      const updates = { identity: data.identity, vaultId: data.vaultId };
      
      try {
        const { doc, getDoc, setDoc } = await import('./lib/supabaseFirestoreCompat');
        const { db } = await import('./lib/supabaseFirestoreCompat');
        const docRef = doc(db, "couples", data.vaultId);
        
        console.log("[Setup] Initializing vault:", data.vaultId);
        
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
          console.log("[Setup] Creating new vault on Supabase");
          const { identity, currentTab, isLoggedIn, userEmail, ...backupData } = state;
          const finalData = { ...backupData, vaultId: data.vaultId };
          const safeData = Object.fromEntries(
            Object.entries(finalData).filter(([_, v]) => v !== undefined)
          );

          await setDoc(docRef, {
             ...safeData,
             lastUpdated: new Date().toISOString(),
          }, { merge: true });
          
          setState(s => ({ ...s, ...updates }));
        } else {
           console.log("[Setup] Vault found, pulling data");
           const dataSnap = docSnap.data();
           setState({ ...state, ...dataSnap, ...updates, isLoggedIn: true });
        }
      } catch (e: any) {
        console.error("Vault initialization failed:", e);
        setState(s => ({ 
          ...s, 
          ...updates, 
          isLoggedIn: true,
          syncError: e.message || "Failed to reach cloud. Playing locally." 
        }));
      }
    }} />;
  }

  const handleRefresh = async () => {
    if (!state.vaultId) return;
    try {
      const { doc, getDoc } = await import('./lib/supabaseFirestoreCompat');
      const { db } = await import('./lib/supabaseFirestoreCompat');
      const snap = await getDoc(doc(db, "couples", state.vaultId));
      if (snap.exists()) {
        const data = snap.data();
        const cloudMessages = (data.messages && Array.isArray(data.messages)) ? data.messages : [];
        const localMessages = state.messages || [];
        const messageMap = new Map();
        localMessages.forEach((m: any) => messageMap.set(m.id, m));
        cloudMessages.forEach((m: any) => messageMap.set(m.id, m));
        const mergedMessages = Array.from(messageMap.values()).sort((a: any, b: any) => (a.id || 0) - (b.id || 0));
        setState(s => ({ ...s, ...data, messages: mergedMessages, lastSyncedAt: new Date().toISOString() }));
      }
    } catch (e) {
      console.error("Refresh failed:", e);
    }
  };

  const renderTab = () => {
    switch (state.currentTab) {
      case 'home': return <Suspense fallback={<LoadingScreen />}><HomeScreen state={state} setState={setState} onRefresh={handleRefresh} /></Suspense>;
      case 'chat': return <Suspense fallback={<LoadingScreen />}><ChatScreen state={state} setState={setState} setIsNavHidden={setIsNavHidden} /></Suspense>;
      case 'memories': return <Suspense fallback={<LoadingScreen />}><MemoriesScreen state={state} setState={setState} onRefresh={handleRefresh} /></Suspense>;
      case 'sanctuary': return <Suspense fallback={<LoadingScreen />}><SanctuaryScreen state={state} setState={setState} onRefresh={handleRefresh} /></Suspense>;
      case 'settings': return <Suspense fallback={<LoadingScreen />}><SettingsScreen state={state} setState={setState} deferredPrompt={deferredPrompt} setDeferredPrompt={setDeferredPrompt} /></Suspense>;
      default: return null;
    }
  };

  const LoadingScreen = () => (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="w-8 h-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <ErrorBoundary>
    <div 
      className="app-container transition-colors duration-300"
      style={{ 
        ...themeVars, 
        backgroundColor: 'var(--color-background)',
        color: 'var(--color-on-background)',
        fontFamily: FONTS[state.font] || FONTS.Default,
      }}
    >
      {/* Main Content */}
      <main className="pt-2 pb-20 px-3 max-w-2xl mx-auto">
        <InAppToast />
        {state.syncError && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] bg-amber-50 border border-amber-200 px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
            <span className="text-[10px] font-bold text-amber-700 uppercase tracking-widest">{state.syncError}</span>
            <button onClick={() => setState(s => ({ ...s, syncError: undefined }))} className="text-amber-400 hover:text-amber-600">✕</button>
          </div>
        )}
        <AnimatePresence mode="wait">
          <motion.div
            key={state.currentTab}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
          >
            {renderTab()}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Bottom Nav */}
      <AnimatePresence>
        {!isNavHidden && (
          <motion.nav 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-4 left-2 right-2 mx-auto max-w-lg bg-white/80 backdrop-blur-xl z-50 rounded-[2rem] shadow-2xl border border-white/20 p-2 ps-[10px] flex justify-around items-center"
          >
            <NavButton 
              active={state.currentTab === 'home'} 
              onClick={() => setState(s => ({ ...s, currentTab: 'home' }))}
              icon={<Home size={22} />}
              label="Home"
              theme={THEMES[state.theme]}
              ariaLabel="Home"
            />
            <NavButton 
              active={state.currentTab === 'chat'} 
              onClick={() => setState(s => ({ ...s, currentTab: 'chat' }))}
              icon={<MessageCircle size={22} />}
              label="Chat"
              theme={THEMES[state.theme]}
              ariaLabel="Chat"
            />
            <NavButton 
              active={state.currentTab === 'memories'} 
              onClick={() => setState(s => ({ ...s, currentTab: 'memories' }))}
              icon={<ImageIcon size={22} />}
              label="Memories"
              theme={THEMES[state.theme]}
              ariaLabel="Memories"
            />
            <NavButton 
              active={state.currentTab === 'sanctuary'} 
              onClick={() => setState(s => ({ ...s, currentTab: 'sanctuary' }))}
              icon={<Sparkles size={22} />}
              label="Sanctuary"
              theme={THEMES[state.theme]}
              ariaLabel="Sanctuary"
            />
            <NavButton 
              active={state.currentTab === 'settings'} 
              onClick={() => setState(s => ({ ...s, currentTab: 'settings' }))}
              icon={<Settings size={22} />}
              label="Settings"
              theme={THEMES[state.theme]}
              ariaLabel="Settings"
            />
            <div className="flex items-center gap-0">
              <button
                onClick={() => setSearchOpen(true)}
                aria-label="Search"
                className="flex flex-col items-center justify-center py-2 px-1 flex-1 shrink-0 rounded-2xl text-gray-500 hover:text-gray-900"
              >
                <div className="shrink-0 flex items-center justify-center h-6">
                  <Search size={22} />
                </div>
                <span className="text-[10px] font-semibold mt-1">Search</span>
              </button>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>

      {/* Search Modal */}
      <AnimatePresence>
        {searchOpen && (
          <SearchModal
            state={state}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            onClose={() => { setSearchOpen(false); setSearchQuery(''); }}
          />
        )}
      </AnimatePresence>
    </div>
    </ErrorBoundary>
  );
}

function SearchModal({ 
  state, 
  searchQuery, 
  setSearchQuery, 
  onClose 
}: { 
  state: AppState; 
  searchQuery: string; 
  setSearchQuery: (v: string) => void; 
  onClose: () => void;
}) {
  const results = useMemo(() => {
    if (!searchQuery.trim()) return { messages: [], memories: [], letters: [] };
    const q = searchQuery.toLowerCase();
    
    const messages = state.messages
      .filter(m => !m.deleted && m.text?.toLowerCase().includes(q))
      .slice(-20);
    
    const memories = state.aiMemory.explicitMemories
      .filter(m => m.content.toLowerCase().includes(q))
      .slice(-10);
    
    const letters = state.letters
      .filter(l => l.content.toLowerCase().includes(q))
      .slice(-10);
    
    return { messages, memories, letters };
  }, [searchQuery, state.messages, state.aiMemory.explicitMemories, state.letters]);

  const totalResults = results.messages.length + results.memories.length + results.letters.length;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -20, opacity: 0 }}
        className="w-full max-w-lg mx-auto mt-4 p-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center gap-3">
            <div className="flex-1 relative">
              <Search size={18} className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search messages, memories, letters..."
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 rounded-full border-0 focus:ring-2 focus:ring-[var(--color-primary)] text-sm"
                autoFocus
              />
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
              <X size={20} className="text-gray-500" />
            </button>
          </div>
          
          <div className="max-h-[60vh] overflow-y-auto">
            {!searchQuery.trim() ? (
              <div className="p-8 text-center text-gray-400 text-sm">
                Type to search across your sanctuary
              </div>
            ) : totalResults === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">
                No results found for "{searchQuery}"
              </div>
            ) : (
              <div className="p-2">
                {results.messages.length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-3 py-2">Messages</h3>
                    {results.messages.map(m => (
                      <div key={m.id} className="px-3 py-2 hover:bg-gray-50 rounded-lg cursor-pointer">
                        <p className="text-sm text-gray-700 line-clamp-2">{m.text}</p>
                        <span className="text-[10px] text-gray-400">{m.time}</span>
                      </div>
                    ))}
                  </div>
                )}
                {results.memories.length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-3 py-2">Memories</h3>
                    {results.memories.map(m => (
                      <div key={m.id} className="px-3 py-2 hover:bg-gray-50 rounded-lg cursor-pointer">
                        <p className="text-sm text-gray-700 line-clamp-2">{m.content}</p>
                      </div>
                    ))}
                  </div>
                )}
                {results.letters.length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-3 py-2">Letters</h3>
                    {results.letters.map(l => (
                      <div key={l.id} className="px-3 py-2 hover:bg-gray-50 rounded-lg cursor-pointer">
                        <p className="text-sm text-gray-700 line-clamp-2">{l.content}</p>
                        <span className="text-[10px] text-gray-400">From: {l.from}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function NavButton({ 
  active, 
  onClick, 
  icon, 
  label,
  theme,
  ariaLabel,
  className = ""
}: { 
  active: boolean; 
  onClick: () => void; 
  icon: React.ReactNode; 
  label: string;
  theme: any;
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel || label}
      className={`
        flex flex-col items-center justify-center py-2 px-1 flex-1 shrink-0 rounded-2xl transition-all duration-300
        ${active ? 'bg-[var(--color-primary-container)] text-[var(--color-on-primary-container)]' : 'text-gray-500 hover:text-gray-900'}
        ${className}
      `}
    >
      <div className="shrink-0 flex items-center justify-center h-6">
        {icon}
      </div>
      <span className="text-[10px] font-semibold mt-1 whitespace-nowrap">{label}</span>
    </button>
  );
}
