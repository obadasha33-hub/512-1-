'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import {
  Home, MessageCircle, Image as ImageIcon, Settings, Heart, Sparkles,
  Moon, Calendar, Lock, Brain, Plus, Send,
  ChevronLeft, Mic, Paperclip, Smile, ArrowDown, Copy,
  Trash2, X, Check, CheckCheck, Clock, Eye, Edit3,
  Camera, BookOpen, Dice1, Target, Gift, Shield,
  Volume2, Vibrate, Bell, Cloud, RefreshCw, Key,
  Download, Globe, Type, Palette, User, Users,
  Flame, Wine, Zap, Star, PenTool, Reply,
  Play, Pause, MoreVertical, CheckCircle2, Circle,
  Share, Bookmark, MessageSquare, Search, FileText, Video,
  Maximize2, Gamepad2, Timer, Trophy, BellOff, ShieldCheck
} from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { useAppStore, type TabName, type SanctuarySubTab, type Message } from '@/lib/sanctuary-store';
import { THEMES, type ThemeName, type FontStyle } from '@/lib/themes';
import { getStorageEstimate, getStorageStats, clearOldMessages, clearMediaCache, saveOfflineMessage, loadOfflineQueue, clearOfflineQueue } from '@/lib/idb-storage';

/* ─── Theme Helper ────────────────────────────────────── */
function applyThemeCSS(themeName: ThemeName) {
  const t = THEMES[themeName];
  const root = document.documentElement;
  root.style.setProperty('--theme-primary', t.primary);
  root.style.setProperty('--theme-on-primary', t.onPrimary);
  root.style.setProperty('--theme-primary-container', t.primaryContainer);
  root.style.setProperty('--theme-on-primary-container', t.onPrimaryContainer);
  root.style.setProperty('--theme-bg', t.background);
  root.style.setProperty('--theme-on-bg', t.onBackground);
  root.style.setProperty('--theme-surface', t.surface);
  root.style.setProperty('--theme-on-surface', t.onSurface);
  root.style.setProperty('--theme-surface-container', t.surfaceContainer);
  root.style.setProperty('--theme-accent', t.accent);
  root.style.setProperty('--theme-text-main', t.textMain);
  root.style.setProperty('--theme-text-sub', t.textSub);
}

function useThemeCSS() {
  const theme = useAppStore((s) => s.theme);
  useEffect(() => { applyThemeCSS(theme); }, [theme]);
}

/* ─── Upload with Progress ─────────────────────────────── */
function uploadWithProgress(file: File, onProgress: (pct: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append('file', file);
    xhr.open('POST', '/api/upload');
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status === 200) {
        const data = JSON.parse(xhr.responseText);
        resolve(data.url || data.fileUrl || data.path);
      } else {
        reject(new Error('Upload failed'));
      }
    };
    xhr.onerror = () => reject(new Error('Upload failed'));
    xhr.send(formData);
  });
}

/* ─── Time helpers ────────────────────────────────────── */
function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}
function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

/* ─── Gradient placeholders ───────────────────────────── */
const GRADIENTS = [
  'linear-gradient(135deg, #FF6B9D 0%, #C44569 100%)',
  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
  'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
  'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
];

function getGradient(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length];
}

/* ─── Animation Variants ──────────────────────────────── */
const pageVariants = {
  enter: { opacity: 0, y: 20 },
  center: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
};

const modalVariants = {
  hidden: { y: '100%' },
  visible: { y: 0 },
  exit: { y: '100%' },
};

const fadeVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

/* ─── Sub-components ──────────────────────────────────── */
function Modal({ open, onClose, children, title, fullHeight }: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  fullHeight?: boolean;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center"
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          <motion.div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            variants={fadeVariants}
            onClick={onClose}
          />
          <motion.div
            className="relative w-full max-w-lg rounded-t-3xl overflow-hidden"
            style={{
              maxHeight: fullHeight ? '95vh' : '85vh',
              backgroundColor: 'var(--theme-surface)',
              color: 'var(--theme-on-surface)',
            }}
            variants={modalVariants}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          >
            <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--theme-primary-container)' }}>
              <div className="w-10 h-1 rounded-full mx-auto absolute left-1/2 -translate-x-1/2 top-2" style={{ backgroundColor: 'var(--theme-primary-container)' }} />
              <h3 className="font-semibold text-lg" style={{ color: 'var(--theme-text-main)' }}>{title}</h3>
              <button onClick={onClose} className="p-2 rounded-full hover:opacity-70" style={{ color: 'var(--theme-text-sub)' }}>
                <X size={20} />
              </button>
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: fullHeight ? 'calc(95vh - 60px)' : 'calc(85vh - 60px)' }}>
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ActionButton({ icon: Icon, label, color, onClick }: {
  icon: React.ElementType;
  label: string;
  color: string;
  onClick: (e: React.MouseEvent) => void;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.92 }}
      whileHover={{ scale: 1.02 }}
      className="flex flex-col items-center gap-1.5 px-3 py-2 rounded-2xl min-w-[72px]"
      style={{ backgroundColor: color + '18', color }}
      onClick={(e: React.MouseEvent<HTMLButtonElement>) => onClick(e)}
    >
      <div className="w-11 h-11 rounded-full flex items-center justify-center" style={{ backgroundColor: color + '25' }}>
        <Icon size={20} />
      </div>
      <span className="text-[11px] font-medium">{label}</span>
    </motion.button>
  );
}

function ProfileAvatar({ name, photo, size = 64 }: { name: string; photo: string; size?: number }) {
  return (
    <div
      className="rounded-full flex items-center justify-center shrink-0 text-white font-bold shadow-lg"
      style={{
        width: size,
        height: size,
        background: photo ? undefined : getGradient(name),
        fontSize: size * 0.36,
      }}
    >
      {photo ? (
        <img src={photo} alt={name} className="w-full h-full rounded-full object-cover" />
      ) : (
        name.charAt(0).toUpperCase()
      )}
    </div>
  );
}

/* ─── Profile Photo Picker (Avatar + camera overlay + upload) ─── */
function ProfilePhotoPicker({ name, photo, size, onPhotoChange }: { name: string; photo: string; size: number; onPhotoChange: (url: string) => void }) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    // Validate it's an image
    if (!file.type.startsWith('image/')) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      if (res.ok) {
        const data = await res.json();
        const url = data.url || data.fileUrl || data.path;
        onPhotoChange(url);
      }
    } catch (err) {
      console.error('Photo upload failed:', err);
    }
    setUploading(false);
  };

  return (
    <div className="relative group" style={{ width: size, height: size }}>
      <ProfileAvatar name={name} photo={photo} size={size} />
      {/* Camera overlay */}
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => fileInputRef.current?.click()}
        className="absolute inset-0 rounded-full flex items-center justify-center bg-black/0 group-hover:bg-black/40 active:bg-black/50 transition-colors"
        disabled={uploading}
      >
        {uploading ? (
          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin opacity-0 group-hover:opacity-100 transition-opacity" />
        ) : (
          <Camera size={size * 0.22} className="text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
        )}
      </motion.button>
      {/* Always-visible small camera badge */}
      <div
        className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full flex items-center justify-center shadow-md border-2 border-white"
        style={{ backgroundColor: 'var(--theme-primary)' }}
        onClick={() => fileInputRef.current?.click()}
      >
        <Camera size={11} style={{ color: 'var(--theme-on-primary)' }} />
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}

function SectionCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-3xl p-4 shadow-sm ${className}`}
      style={{ backgroundColor: 'var(--theme-surface)', color: 'var(--theme-on-surface)' }}
    >
      {children}
    </div>
  );
}

/* ─── Notification Helper ──────────────────────────────── */
function showSystemNotification(title: string, body: string, tag?: string) {
  if (typeof window === 'undefined') return;
  if (Notification.permission !== 'granted') return;
  try {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'SHOW_NOTIFICATION',
        payload: { title, body, tag: tag || 'sanctuary-message', data: { openTab: 'chat' } },
      });
    }
    // Also show via Notification API directly as fallback
    new Notification(title, {
      body,
      icon: '/logo.svg',
      badge: '/logo.svg',
      tag: tag || 'sanctuary-message',
      renotify: true,
      vibrate: [100, 50, 100],
      data: { openTab: 'chat' },
    });
  } catch (e) {
    console.warn('[Notification] Failed:', e);
  }
}

async function requestNotificationPermission() {
  if (typeof window === 'undefined') return false;
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

function registerServiceWorker() {
  if (typeof window === 'undefined') return;
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
}

/* ─── Socket.IO Hook ──────────────────────────────────── */
function getSocketUrl(): string {
  if (typeof window === 'undefined') return '';
  const host = window.location.hostname;
  // In production, Caddy proxies; in dev, use port 3003
  if (host === 'localhost' || host === '127.0.0.1') {
    return `http://${host}:3003`;
  }
  // Production: same origin, Caddy proxies /socket.io/
  return `http://${host}:3003`;
}

function useSocketIO() {
  const socketRef = useRef<Socket | null>(null);
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  // Use a selector to subscribe only to setupComplete — avoids re-render on every store change
  const setupComplete = useAppStore((s) => s.setupComplete);

  // Stable refs for store actions so callbacks never need store in deps
  const storeActionsRef = useRef(useAppStore.getState());
  // Keep the ref updated on every render (cheap — no subscription)
  storeActionsRef.current = useAppStore.getState();

  const connect = useCallback(() => {
    if (socketRef.current?.connected) return;
    const url = getSocketUrl();
    if (!url) return;

    const socket = io(url, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socket.on('connect', () => {
      console.log('[Socket.IO] Connected');
      useAppStore.getState().setWsConnected(true);

      // Join the vault room
      const state = useAppStore.getState();
      const myName = state.identity === 'Batman' ? state.batmanName : state.princessName;
      socket.emit('join-vault', {
        vaultId: state.vaultId,
        identity: state.identity,
        name: myName,
      });

      // Sync missed messages on reconnect
      useAppStore.getState().loadFromServer().catch(() => {});

      // Enhancement 3: Auto-send queued offline messages on reconnect
      (async () => {
        try {
          const s = useAppStore.getState();
          const queue = await loadOfflineQueue(s.vaultId);
          if (queue.length > 0 && socketRef.current?.connected) {
            for (const item of queue) {
              socketRef.current.emit('send-message', {
                vaultId: item.vaultId,
                message: {
                  id: String(item.message.id),
                  senderId: item.message.senderId,
                  text: item.message.text,
                  image: item.message.image,
                  audio: item.message.audio,
                  video: item.message.video,
                  audioDuration: item.message.audioDuration,
                  time: item.message.time,
                  messageType: item.message.messageType,
                  fileName: item.message.fileName,
                  fileSize: item.message.fileSize,
                  documentUrl: item.message.documentUrl,
                  replyTo: item.message.replyTo,
                },
              });
            }
            await clearOfflineQueue(s.vaultId);
          }
        } catch (err) {
          console.warn('[Socket.IO] Failed to flush offline queue:', err);
        }
      })();

      // Start heartbeat
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      heartbeatRef.current = setInterval(() => {
        const s = useAppStore.getState();
        if (s.setupComplete) {
          socket.emit('presence', { vaultId: s.vaultId, identity: s.identity });
        }
      }, 30000);
    });

    socket.on('disconnect', () => {
      console.log('[Socket.IO] Disconnected');
      useAppStore.getState().setWsConnected(false);
    });

    socket.on('vault-presence', (data: Record<string, { online: boolean; name: string; mood?: string; lastSeen: number }>) => {
      const state = useAppStore.getState();
      const partnerIdentity = state.identity === 'Batman' ? 'Princess' : 'Batman';
      const partner = data[partnerIdentity];
      if (partner) {
        state.setPartnerOnline(partner.online);
        if (!partner.online && partner.lastSeen) {
          state.setPartnerLastSeen(new Date(partner.lastSeen).toISOString());
        }
      }
    });

    socket.on('partner-online', (data: { identity: string; name: string }) => {
      const state = useAppStore.getState();
      if (data.identity !== state.identity) {
        state.setPartnerOnline(true);
      }
    });

    socket.on('partner-offline', (data: { identity: string; lastSeen: number }) => {
      const state = useAppStore.getState();
      if (data.identity !== state.identity) {
        state.setPartnerOnline(false);
        state.setPartnerLastSeen(new Date(data.lastSeen).toISOString());
      }
    });

    socket.on('receive-message', (data: { vaultId: string; message: any }) => {
      const msg = data.message;
      const state = useAppStore.getState();
      const partnerIdentity = state.identity === 'Batman' ? 'Princess' : 'Batman';
      const partnerName = state.identity === 'Batman' ? state.princessName : state.batmanName;

      const receivedMsg: Message = {
        id: parseInt(String(msg.id).replace(/\D/g, '').slice(-10), 10) || Date.now(),
        type: 'received',
        senderId: partnerIdentity,
        text: msg.text || undefined,
        image: msg.image || undefined,
        audio: msg.audio || undefined,
        video: msg.video || undefined,
        audioDuration: msg.audioDuration,
        time: msg.time || new Date().toISOString(),
        status: 'sent',
        messageType: msg.messageType || (msg.text ? 'text' : msg.image ? 'image' : msg.audio ? 'audio' : msg.video ? 'video' : 'text'),
        fileName: msg.fileName,
        fileSize: msg.fileSize,
        documentUrl: msg.documentUrl,
        replyTo: msg.replyTo ? { id: msg.replyTo.id, text: msg.replyTo.text, sender: msg.replyTo.sender } : undefined,
      };

      state.addReceivedMessage(receivedMsg);

      // Send 'received' status back
      socket.emit('message-status', {
        vaultId: state.vaultId,
        messageId: String(msg.id),
        status: 'received',
      });

      // After a short delay, send 'seen' status
      setTimeout(() => {
        socket.emit('message-status', {
          vaultId: useAppStore.getState().vaultId,
          messageId: String(msg.id),
          status: 'seen',
        });
      }, 1000);

      // Show notification if app is not focused
      if (document.hidden || !document.hasFocus()) {
        // Enhancement 7: Skip notification if chat is muted
        const isMuted = useAppStore.getState().chatMuted;
        if (!isMuted) {
          const preview = msg.text || (msg.audio ? 'Voice message' : msg.image ? 'Photo' : msg.video ? 'Video' : 'Message');
          showSystemNotification(partnerName, preview, 'chat-message');
          if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
        }
      }
    });

    socket.on('partner-typing', (data: { vaultId: string; identity: string }) => {
      const state = useAppStore.getState();
      if (data.identity !== state.identity) {
        state.setPartnerTypingWS(true);
      }
    });

    socket.on('partner-stop-typing', (data: { vaultId: string; identity: string }) => {
      const state = useAppStore.getState();
      if (data.identity !== state.identity) {
        state.setPartnerTypingWS(false);
      }
    });

    socket.on('message-status-update', (data: { vaultId: string; messageId: string; status: string }) => {
      const msgId = parseInt(data.messageId.replace(/\D/g, '').slice(-10), 10);
      if (msgId) {
        useAppStore.getState().updateMessageStatus(msgId, data.status as 'sent' | 'received' | 'seen');
      }
    });

    socket.on('receive-signal', (data: { vaultId: string; type: string; from: string }) => {
      const state = useAppStore.getState();
      const partnerName = state.identity === 'Batman' ? state.princessName : state.batmanName;
      const signalLabels: Record<string, string> = { miss: 'Miss You', hug: 'Hug', kiss: 'Kiss' };
      state.sendSignal(data.type as 'miss' | 'hug' | 'kiss');
      if (document.hidden) {
        showSystemNotification(partnerName, `Sent you a ${signalLabels[data.type] || 'signal'}`, 'signal');
      }
    });

    socket.on('partner-mood-update', (data: { vaultId: string; identity: string; mood: string }) => {
      const state = useAppStore.getState();
      if (data.identity !== state.identity) {
        state.setMoods(state.moods.map((m) =>
          m.userId !== state.identity ? { ...m, mood: data.mood, timestamp: new Date().toISOString() } : m
        ));
        const partnerName = state.identity === 'Batman' ? state.princessName : state.batmanName;
        if (document.hidden) {
          showSystemNotification(partnerName, `Changed mood to ${data.mood}`, 'mood');
        }
      }
    });

    // ── New events for Features 1, 2, 8, 10 ──

    // Feature 1: Reaction sync
    socket.on('partner-reaction', (data: { vaultId: string; messageId: string; reaction: string; from: string }) => {
      const state = useAppStore.getState();
      const msgId = parseInt(data.messageId.replace(/\D/g, '').slice(-10), 10);
      if (msgId) {
        state.addReaction(msgId, data.reaction);
      }
    });

    // Feature 2: Star message sync
    socket.on('partner-star-message', (data: { vaultId: string; messageId: string; from: string }) => {
      const state = useAppStore.getState();
      const msgId = parseInt(data.messageId.replace(/\D/g, '').slice(-10), 10);
      if (msgId) {
        state.starMessage(msgId);
      }
    });

    socket.on('partner-unstar-message', (data: { vaultId: string; messageId: string; from: string }) => {
      const state = useAppStore.getState();
      const msgId = parseInt(data.messageId.replace(/\D/g, '').slice(-10), 10);
      if (msgId) {
        state.unstarMessage(msgId);
      }
    });

    // Feature 8: Letter read sync
    socket.on('partner-letter-read', (data: { vaultId: string; letterId: string; from: string }) => {
      const state = useAppStore.getState();
      state.markLetterRead(data.letterId);
    });

    // Feature 10: Profile photo sync
    socket.on('partner-photo-update', (data: { vaultId: string; identity: string; photoUrl: string }) => {
      const state = useAppStore.getState();
      if (data.identity !== state.identity) {
        // Update the partner's photo
        if (data.identity === 'Batman') {
          state.setBatmanPhoto(data.photoUrl);
        } else {
          state.setPrincessPhoto(data.photoUrl);
        }
      }
    });

    // ── Game events (real-time multiplayer) ──

    // When the other partner starts a game, we receive the same question order
    socket.on('game-started', (data: { from: string; questionIndex: number; questionOrder: number[] }) => {
      const state = useAppStore.getState();
      if (data.from !== state.identity) {
        // Dispatch custom event that GameTab listens to
        window.dispatchEvent(new CustomEvent('sanctuary-game-started', {
          detail: { questionOrder: data.questionOrder, questionIndex: data.questionIndex }
        }));
      }
    });

    // When partner answers a question
    socket.on('partner-game-answer', (data: { questionIndex: number; answer: number; from: string }) => {
      window.dispatchEvent(new CustomEvent('sanctuary-game-answer', {
        detail: { questionIndex: data.questionIndex, answer: data.answer, from: data.from }
      }));
    });

    // When moving to next question
    socket.on('game-next-question', (data: { questionIndex: number }) => {
      window.dispatchEvent(new CustomEvent('sanctuary-game-next', {
        detail: { questionIndex: data.questionIndex }
      }));
    });

    // When game ends
    socket.on('game-ended', (data: { scores: { Batman: number; Princess: number } }) => {
      window.dispatchEvent(new CustomEvent('sanctuary-game-ended', {
        detail: { scores: data.scores }
      }));
    });

    // Game question result (both answered)
    socket.on('game-question-result', (data: { questionIndex: number; answers: Record<string, number | null>; bothAnswered: boolean }) => {
      window.dispatchEvent(new CustomEvent('sanctuary-game-result', {
        detail: { questionIndex: data.questionIndex, answers: data.answers, bothAnswered: data.bothAnswered }
      }));
    });

    socketRef.current = socket;
  }, []); // No store dependency — uses useAppStore.getState() directly

  const disconnect = useCallback(() => {
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    useAppStore.getState().setWsConnected(false);
  }, []); // No store dependency — uses useAppStore.getState() directly

  const emitMessage = useCallback((msg: Message) => {
    if (!socketRef.current?.connected) return;
    const state = useAppStore.getState();
    socketRef.current.emit('send-message', {
      vaultId: state.vaultId,
      message: {
        id: String(msg.id),
        senderId: msg.senderId,
        text: msg.text,
        image: msg.image,
        audio: msg.audio,
        video: msg.video,
        audioDuration: msg.audioDuration,
        time: msg.time,
        messageType: msg.messageType,
        fileName: msg.fileName,
        fileSize: msg.fileSize,
        documentUrl: msg.documentUrl,
        replyTo: msg.replyTo,
      },
    });
  }, []);

  const emitTyping = useCallback(() => {
    if (!socketRef.current?.connected) return;
    const state = useAppStore.getState();
    socketRef.current.emit('typing', { vaultId: state.vaultId, identity: state.identity });
  }, []);

  const emitStopTyping = useCallback(() => {
    if (!socketRef.current?.connected) return;
    const state = useAppStore.getState();
    socketRef.current.emit('stop-typing', { vaultId: state.vaultId, identity: state.identity });
  }, []);

  const emitSignal = useCallback((type: string) => {
    if (!socketRef.current?.connected) return;
    const state = useAppStore.getState();
    socketRef.current.emit('signal', { vaultId: state.vaultId, type, from: state.identity });
  }, []);

  const emitMoodUpdate = useCallback((mood: string) => {
    if (!socketRef.current?.connected) return;
    const state = useAppStore.getState();
    socketRef.current.emit('mood-update', { vaultId: state.vaultId, identity: state.identity, mood });
  }, []);

  // Feature 1: Emit reaction add
  const emitReaction = useCallback((messageId: string, reaction: string) => {
    if (!socketRef.current?.connected) return;
    const state = useAppStore.getState();
    socketRef.current.emit('reaction-add', { vaultId: state.vaultId, messageId, reaction, from: state.identity });
  }, []);

  // Feature 2: Emit star/unstar
  const emitStarMessage = useCallback((messageId: string) => {
    if (!socketRef.current?.connected) return;
    const state = useAppStore.getState();
    socketRef.current.emit('star-message', { vaultId: state.vaultId, messageId, from: state.identity });
  }, []);

  const emitUnstarMessage = useCallback((messageId: string) => {
    if (!socketRef.current?.connected) return;
    const state = useAppStore.getState();
    socketRef.current.emit('unstar-message', { vaultId: state.vaultId, messageId, from: state.identity });
  }, []);

  // Feature 10: Emit profile photo update
  const emitProfilePhotoUpdate = useCallback((identity: 'Batman' | 'Princess', photoUrl: string) => {
    if (!socketRef.current?.connected) return;
    const state = useAppStore.getState();
    socketRef.current.emit('profile-photo-update', { vaultId: state.vaultId, identity, photoUrl });
  }, []);

  // Feature 8: Emit letter read
  const emitLetterRead = useCallback((letterId: string) => {
    if (!socketRef.current?.connected) return;
    const state = useAppStore.getState();
    socketRef.current.emit('letter-read', { vaultId: state.vaultId, letterId, from: state.identity });
  }, []);

  // Feature 13: Game events
  const emitGameStart = useCallback(() => {
    if (!socketRef.current?.connected) return;
    const state = useAppStore.getState();
    socketRef.current.emit('game-start', { vaultId: state.vaultId, from: state.identity });
  }, []);

  const emitGameAnswer = useCallback((questionIndex: number, answer: number) => {
    if (!socketRef.current?.connected) return;
    const state = useAppStore.getState();
    socketRef.current.emit('game-answer', { vaultId: state.vaultId, questionIndex, answer, from: state.identity });
  }, []);

  const emitGameNext = useCallback((questionIndex: number) => {
    if (!socketRef.current?.connected) return;
    const state = useAppStore.getState();
    socketRef.current.emit('game-next', { vaultId: state.vaultId, questionIndex });
  }, []);

  const emitGameEnd = useCallback(() => {
    if (!socketRef.current?.connected) return;
    const state = useAppStore.getState();
    socketRef.current.emit('game-end', { vaultId: state.vaultId });
  }, []);

  // Connect on mount, disconnect on unmount
  // Only re-run when setupComplete changes (boolean — stable)
  useEffect(() => {
    if (setupComplete) {
      connect();
    }
    return () => { disconnect(); };
  }, [setupComplete]); // Only depend on the boolean primitive

  return { socket: socketRef, connect, disconnect, emitMessage, emitTyping, emitStopTyping, emitSignal, emitMoodUpdate, emitReaction, emitStarMessage, emitUnstarMessage, emitProfilePhotoUpdate, emitLetterRead, emitGameStart, emitGameAnswer, emitGameNext, emitGameEnd };
}

/* ═══════════════════════════════════════════════════════
   SETUP / SIGN-IN SCREEN
   ═══════════════════════════════════════════════════════ */
function SetupScreen() {
  const completeSetup = useAppStore((s) => s.completeSetup);
  const [step, setStep] = useState<'identity' | 'details' | 'join'>('identity');
  const [selectedIdentity, setSelectedIdentity] = useState<'Batman' | 'Princess'>('Batman');
  const [myName, setMyName] = useState('');
  const [partnerNameInput, setPartnerNameInput] = useState('');
  const [vaultCode, setVaultCode] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [error, setError] = useState('');

  const handleContinue = () => {
    if (step === 'identity') {
      setStep('details');
      setError('');
    } else if (step === 'details') {
      if (!myName.trim()) { setError('Please enter your name'); return; }
      if (!partnerNameInput.trim()) { setError('Please enter your partner\'s name'); return; }
      setStep('join');
      setError('');
    }
  };

  const handleJoinOrCreate = (createNew: boolean) => {
    const finalVaultId = createNew ? 'vault-' + Math.random().toString(36).substring(2, 8) + '-' + Date.now().toString(36) : vaultCode.trim();
    if (!finalVaultId) { setError('Please enter a vault code or create a new vault'); return; }

    completeSetup({
      myName: myName.trim(),
      partnerName: partnerNameInput.trim(),
      vaultCode: finalVaultId,
      identity: selectedIdentity,
      relationshipStartDate: new Date(startDate).toISOString(),
    });

    // Request notifications
    requestNotificationPermission();
    registerServiceWorker();
  };

  return (
    <div className="fixed inset-0 flex flex-col" style={{ background: 'linear-gradient(135deg, #FF6B9D 0%, #C44569 50%, #8E2D5B 100%)' }}>
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        {/* Logo */}
        <div className="mb-6 setup-logo">
          <div className="w-24 h-24 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
            <span className="text-5xl">💕</span>
          </div>
        </div>

        <h1 className="text-3xl font-bold text-white mb-2 setup-fade-up-1">
          Our Sanctuary
        </h1>
        <p className="text-white/70 text-sm mb-8 text-center setup-fade-up-2">
          A private space for you and your loved one
        </p>

        <div className="w-full max-w-sm space-y-4 setup-slide-in">
          {step === 'identity' && (
            <div key="identity" className="space-y-4">
              <p className="text-white/80 text-sm text-center mb-4">Who are you in this relationship?</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setSelectedIdentity('Batman')}
                  className={`rounded-3xl p-5 flex flex-col items-center gap-3 transition-all active:scale-95 ${selectedIdentity === 'Batman' ? 'bg-white shadow-xl scale-105' : 'bg-white/20 backdrop-blur-sm'}`}
                >
                  <span className="text-3xl">🦸</span>
                  <span className={`font-semibold text-sm ${selectedIdentity === 'Batman' ? 'text-pink-600' : 'text-white'}`}>Partner 1</span>
                  <span className={`text-[10px] ${selectedIdentity === 'Batman' ? 'text-pink-400' : 'text-white/60'}`}>I am the one who...</span>
                </button>
                <button
                  onClick={() => setSelectedIdentity('Princess')}
                  className={`rounded-3xl p-5 flex flex-col items-center gap-3 transition-all active:scale-95 ${selectedIdentity === 'Princess' ? 'bg-white shadow-xl scale-105' : 'bg-white/20 backdrop-blur-sm'}`}
                >
                  <span className="text-3xl">👸</span>
                  <span className={`font-semibold text-sm ${selectedIdentity === 'Princess' ? 'text-pink-600' : 'text-white'}`}>Partner 2</span>
                  <span className={`text-[10px] ${selectedIdentity === 'Princess' ? 'text-pink-400' : 'text-white/60'}`}>I am the one who...</span>
                </button>
              </div>

              <button
                onClick={handleContinue}
                className="w-full py-4 rounded-2xl bg-white text-pink-600 font-bold text-base shadow-lg mt-4 active:scale-95 transition-transform"
              >
                Continue
              </button>
            </div>
          )}

          {step === 'details' && (
            <div key="details" className="space-y-3">
              <div>
                <label className="text-white/80 text-xs font-medium mb-1 block">Your Name</label>
                <input
                  value={myName}
                  onChange={(e) => setMyName(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full p-3.5 rounded-2xl bg-white/20 text-white placeholder:text-white/40 border border-white/20 outline-none focus:border-white/50 text-sm backdrop-blur-sm"
                />
              </div>
              <div>
                <label className="text-white/80 text-xs font-medium mb-1 block">Your Partner&apos;s Name</label>
                <input
                  value={partnerNameInput}
                  onChange={(e) => setPartnerNameInput(e.target.value)}
                  placeholder="Enter your partner's name"
                  className="w-full p-3.5 rounded-2xl bg-white/20 text-white placeholder:text-white/40 border border-white/20 outline-none focus:border-white/50 text-sm backdrop-blur-sm"
                />
              </div>
              <div>
                <label className="text-white/80 text-xs font-medium mb-1 block">When did your relationship start?</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full p-3.5 rounded-2xl bg-white/20 text-white border border-white/20 outline-none focus:border-white/50 text-sm backdrop-blur-sm"
                />
              </div>
              {error && <p className="text-red-200 text-xs text-center">{error}</p>}
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => { setStep('identity'); setError(''); }}
                  className="flex-1 py-3.5 rounded-2xl bg-white/20 text-white font-semibold text-sm backdrop-blur-sm active:scale-95 transition-transform"
                >
                  Back
                </button>
                <button
                  onClick={handleContinue}
                  className="flex-1 py-3.5 rounded-2xl bg-white text-pink-600 font-bold text-sm shadow-lg active:scale-95 transition-transform"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {step === 'join' && (
            <div key="join" className="space-y-4">
              <div className="rounded-3xl bg-white/15 backdrop-blur-sm p-5 space-y-3">
                <p className="text-white font-semibold text-sm text-center">Create or Join a Vault</p>
                <p className="text-white/60 text-xs text-center">Share your vault code with your partner so they can join the same room</p>
                <div>
                  <label className="text-white/80 text-xs font-medium mb-1 block">Vault Code (to join existing)</label>
                  <input
                    value={vaultCode}
                    onChange={(e) => setVaultCode(e.target.value)}
                    placeholder="Enter vault code from your partner"
                    className="w-full p-3.5 rounded-2xl bg-white/20 text-white placeholder:text-white/40 border border-white/20 outline-none focus:border-white/50 text-sm backdrop-blur-sm font-mono"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-white/20" />
                  <span className="text-white/40 text-xs">OR</span>
                  <div className="flex-1 h-px bg-white/20" />
                </div>
              </div>

              {error && <p className="text-red-200 text-xs text-center">{error}</p>}

              <div className="flex gap-2">
                <button
                  onClick={() => { setStep('details'); setError(''); }}
                  className="flex-1 py-3.5 rounded-2xl bg-white/20 text-white font-semibold text-sm backdrop-blur-sm active:scale-95 transition-transform"
                >
                  Back
                </button>
                <button
                  onClick={() => handleJoinOrCreate(!!vaultCode.trim())}
                  className="flex-1 py-3.5 rounded-2xl bg-white text-pink-600 font-bold text-sm shadow-lg active:scale-95 transition-transform"
                  disabled={!vaultCode.trim()}
                >
                  Join Vault
                </button>
              </div>
              <button
                onClick={() => handleJoinOrCreate(true)}
                className="w-full py-4 rounded-2xl bg-white/30 text-white font-bold text-sm backdrop-blur-sm border border-white/30 active:scale-95 transition-transform"
              >
                ✨ Create New Vault
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   HOME SCREEN
   ═══════════════════════════════════════════════════════ */
function HomeScreen() {
  // Selective subscriptions to avoid re-render on every store change
  const identity = useAppStore((s) => s.identity);
  const batmanName = useAppStore((s) => s.batmanName);
  const princessName = useAppStore((s) => s.princessName);
  const batmanPhoto = useAppStore((s) => s.batmanPhoto);
  const princessPhoto = useAppStore((s) => s.princessPhoto);
  const moods = useAppStore((s) => s.moods);
  const signals = useAppStore((s) => s.signals);
  const daysTogether = useAppStore((s) => s.daysTogether);
  const relationshipStartDate = useAppStore((s) => s.relationshipStartDate);
  const memoryEntries = useAppStore((s) => s.memoryEntries);
  const theme = useAppStore((s) => s.theme);
  const setMoods = useAppStore((s) => s.setMoods);
  const sendSignal = useAppStore((s) => s.sendSignal);
  const setRelationshipStartDate = useAppStore((s) => s.setRelationshipStartDate);
  const setBatmanPhoto = useAppStore((s) => s.setBatmanPhoto);
  const setPrincessPhoto = useAppStore((s) => s.setPrincessPhoto);
  const [editingDate, setEditingDate] = useState(false);
  const [dateValue, setDateValue] = useState(relationshipStartDate.split('T')[0]);
  const [activeSignal, setActiveSignal] = useState<{ type: string; x: number; y: number } | null>(null);

  const myName = identity === 'Batman' ? batmanName : princessName;
  const partnerName = identity === 'Batman' ? princessName : batmanName;
  const myPhoto = identity === 'Batman' ? batmanPhoto : princessPhoto;
  const partnerPhoto = identity === 'Batman' ? princessPhoto : batmanPhoto;
  const myMood = moods.find((m) => m.userId === identity);
  const partnerMood = moods.find((m) => m.userId !== identity);

  const moodEmojis = ['😊', '💖', '😴', '🥺', '😈'];

  const handleSignal = (type: 'miss' | 'hug' | 'kiss', e: React.MouseEvent) => {
    sendSignal(type);
    setActiveSignal({ type, x: e.clientX, y: e.clientY });
    setTimeout(() => setActiveSignal(null), 800);
  };

  const handleDateSave = () => {
    setRelationshipStartDate(new Date(dateValue).toISOString());
    setEditingDate(false);
  };

  const revealedMemories = memoryEntries.filter(
    (m) => m.revealDate && new Date(m.revealDate) <= new Date()
  );

  // Feature 9: Time Capsule reminders — check for newly revealed memories
  const [newlyRevealedCapsule, setNewlyRevealedCapsule] = useState<string | null>(null);
  const newlyRevealedTimerRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    // Check for memories whose revealDate is today
    const today = new Date().toDateString();
    const freshCapsules = memoryEntries.filter(
      (m) => m.revealDate && new Date(m.revealDate).toDateString() === today
    );
    if (freshCapsules.length > 0) {
      // Use setTimeout callback to avoid setting state synchronously in effect
      if (newlyRevealedTimerRef.current) clearTimeout(newlyRevealedTimerRef.current);
      queueMicrotask(() => {
        setNewlyRevealedCapsule(freshCapsules[0].content.slice(0, 50));
        newlyRevealedTimerRef.current = setTimeout(() => setNewlyRevealedCapsule(null), 10000);
      });
    }
  }, [memoryEntries]);

  // Feature 9: Periodic check every 60 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      const today = new Date().toDateString();
      const freshCapsules = memoryEntries.filter(
        (m) => m.revealDate && new Date(m.revealDate).toDateString() === today
      );
      if (freshCapsules.length > 0) {
        setNewlyRevealedCapsule(freshCapsules[0].content.slice(0, 50));
      }
    }, 3600000); // 60 minutes
    return () => clearInterval(interval);
  }, [memoryEntries]);

  const signalLabels = { miss: 'Miss You 💕', hug: 'Send a Hug 🤗', kiss: 'Blow a Kiss 💋' };
  const signalEmojis = { miss: '💕', hug: '🤗', kiss: '💋' };

  return (
    <div className="px-4 pb-4 space-y-4">
      {/* Days Together Counter */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="text-center py-6"
      >
        <motion.div
          className="text-6xl font-bold tracking-tight"
          style={{ color: 'var(--theme-primary)' }}
          key={daysTogether}
          initial={{ scale: 1.2 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200 }}
        >
          {daysTogether}
        </motion.div>
        <div className="text-sm font-medium mt-1" style={{ color: 'var(--theme-text-sub)' }}>
          Days Together
        </div>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => { setDateValue(relationshipStartDate.split('T')[0]); setEditingDate(true); }}
          className="mt-2 inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-full"
          style={{ backgroundColor: 'var(--theme-primary-container)', color: 'var(--theme-on-primary-container)' }}
        >
          <Edit3 size={12} /> Edit Start Date
        </motion.button>
      </motion.div>

      {/* Profile Cards */}
      <SectionCard>
        <div className="flex items-center justify-center gap-6 py-2">
          <div className="flex flex-col items-center gap-2">
            <ProfilePhotoPicker
              name={myName}
              photo={myPhoto}
              size={72}
              onPhotoChange={(url) => identity === 'Batman' ? setBatmanPhoto(url) : setPrincessPhoto(url)}
            />
            <span className="text-sm font-semibold" style={{ color: 'var(--theme-text-main)' }}>{myName}</span>
          </div>
          <motion.div
            className="animate-pulse-heart text-3xl"
            style={{ color: 'var(--theme-primary)' }}
          >
            ❤️
          </motion.div>
          <div className="flex flex-col items-center gap-2">
            <ProfilePhotoPicker
              name={partnerName}
              photo={partnerPhoto}
              size={72}
              onPhotoChange={(url) => identity === 'Batman' ? setPrincessPhoto(url) : setBatmanPhoto(url)}
            />
            <span className="text-sm font-semibold" style={{ color: 'var(--theme-text-main)' }}>{partnerName}</span>
          </div>
        </div>
      </SectionCard>

      {/* Mood Tracker */}
      <SectionCard>
        <div className="flex gap-3">
          <div className="flex-1 rounded-2xl p-3" style={{ backgroundColor: 'var(--theme-primary-container)' }}>
            <div className="text-xs font-medium mb-2" style={{ color: 'var(--theme-on-primary-container)' }}>My Mood</div>
            <div className="text-3xl mb-2">{myMood?.mood || '😊'}</div>
            <div className="flex gap-1.5 flex-wrap">
              {moodEmojis.map((m) => (
                <motion.button
                  key={m}
                  whileTap={{ scale: 0.85 }}
                  className={`text-lg p-1 rounded-lg ${myMood?.mood === m ? 'ring-2' : ''}`}
                  style={myMood?.mood === m ? { outline: '2px solid var(--theme-primary)' } : {}}
                  onClick={() => {
                    setMoods(
                      moods.map((entry) =>
                        entry.userId === identity ? { ...entry, mood: m, timestamp: new Date().toISOString() } : entry
                      )
                    );
                  }}
                >
                  {m}
                </motion.button>
              ))}
            </div>
          </div>
          <div className="flex-1 rounded-2xl p-3" style={{ backgroundColor: 'var(--theme-surface-container)' }}>
            <div className="text-xs font-medium mb-2" style={{ color: 'var(--theme-text-sub)' }}>Partner&apos;s Mood</div>
            <div className="text-3xl mb-2">{partnerMood?.mood || '😊'}</div>
            <div className="text-xs" style={{ color: 'var(--theme-text-sub)' }}>
              Updated {partnerMood ? timeAgo(partnerMood.timestamp) : 'never'}
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Signal Panel */}
      <SectionCard>
        <div className="text-xs font-medium mb-3" style={{ color: 'var(--theme-text-sub)' }}>
          Send a Signal
        </div>
        <div className="flex justify-center gap-3">
          <ActionButton icon={Heart} label="Miss You" color="var(--theme-primary)" onClick={(e) => handleSignal('miss', e)} />
          <ActionButton icon={Users} label="Send Hug" color="#FF6B9D" onClick={(e) => handleSignal('hug', e)} />
          <ActionButton icon={Zap} label="Blow Kiss" color="#E84393" onClick={(e) => handleSignal('kiss', e)} />
        </div>
        {signals.length > 0 && (
          <div className="mt-3 space-y-1.5 max-h-24 overflow-y-auto">
            {signals.slice(-3).map((s, i) => (
              <div key={i} className="text-xs flex items-center gap-2 px-2 py-1 rounded-xl" style={{ backgroundColor: 'var(--theme-primary-container)', color: 'var(--theme-on-primary-container)' }}>
                <span>{signalEmojis[s.type]}</span>
                <span className="font-medium">{s.from === identity ? myName : partnerName}</span>
                <span>sent &quot;{signalLabels[s.type]}&quot;</span>
                <span className="ml-auto opacity-60">{timeAgo(s.timestamp)}</span>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Time Capsule Banner (Feature 9 enhanced) */}
      <AnimatePresence>
        {newlyRevealedCapsule && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="rounded-3xl p-4 shadow-lg text-white"
            style={{ background: `linear-gradient(135deg, var(--theme-primary), ${THEMES[theme].accent})` }}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">🎉</span>
              <span className="font-semibold text-sm">New Time Capsule Revealed!</span>
            </div>
            <p className="text-xs opacity-90">{newlyRevealedCapsule}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Existing revealed memories banner */}
      <AnimatePresence>
        {revealedMemories.length > 0 && !newlyRevealedCapsule && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="rounded-3xl p-4 shadow-lg text-white"
            style={{ background: `linear-gradient(135deg, var(--theme-primary), ${THEMES[theme].accent})` }}
          >
            <div className="flex items-center gap-2 mb-1">
              <Star size={16} />
              <span className="font-semibold text-sm">Time Capsule Revealed!</span>
            </div>
            <p className="text-xs opacity-90">{revealedMemories[revealedMemories.length - 1].content}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Date Modal */}
      <Modal open={editingDate} onClose={() => setEditingDate(false)} title="Start Date">
        <div className="p-4 space-y-4">
          <input
            type="date"
            value={dateValue}
            onChange={(e) => setDateValue(e.target.value)}
            className="w-full p-3 rounded-2xl border text-base"
            style={{ borderColor: 'var(--theme-primary-container)', color: 'var(--theme-text-main)', backgroundColor: 'var(--theme-surface-container)' }}
          />
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleDateSave}
            className="w-full py-3 rounded-2xl font-semibold text-white"
            style={{ backgroundColor: 'var(--theme-primary)' }}
          >
            Save
          </motion.button>
        </div>
      </Modal>

      {/* Signal animation overlay */}
      <AnimatePresence>
        {activeSignal && (
          <motion.div
            className="fixed inset-0 z-[60] pointer-events-none flex items-center justify-center"
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
          >
            <motion.span
              className="text-7xl"
              initial={{ scale: 0.5, y: 0 }}
              animate={{ scale: 2, y: -100 }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            >
              {signalEmojis[activeSignal.type as keyof typeof signalEmojis]}
            </motion.span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Enhancement 6: Time Capsule Revealed Popup */}
      <AnimatePresence>
        {newlyRevealedCapsule && (
          <motion.div
            className="fixed inset-0 z-[70] flex items-center justify-center px-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setNewlyRevealedCapsule(null)} />
            <motion.div
              className="relative w-full max-w-sm rounded-3xl p-6 text-center shadow-2xl overflow-hidden"
              style={{ backgroundColor: 'var(--theme-surface)', color: 'var(--theme-on-surface)' }}
              initial={{ scale: 0.5, opacity: 0, y: 40 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.5, opacity: 0, y: 40 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            >
              {/* Confetti-style decorations */}
              <div className="absolute top-2 left-4 text-2xl animate-bounce" style={{ animationDelay: '0.1s' }}>🎉</div>
              <div className="absolute top-4 right-6 text-xl animate-bounce" style={{ animationDelay: '0.3s' }}>✨</div>
              <div className="absolute bottom-4 left-6 text-lg animate-bounce" style={{ animationDelay: '0.5s' }}>🌟</div>
              <div className="absolute bottom-3 right-4 text-xl animate-bounce" style={{ animationDelay: '0.2s' }}>🎊</div>
              <motion.div
                className="text-5xl mb-3"
                animate={{ scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              >
                🎁
              </motion.div>
              <h3 className="text-lg font-bold mb-1" style={{ color: 'var(--theme-text-main)' }}>
                Time Capsule Revealed!
              </h3>
              <p className="text-sm mb-4" style={{ color: 'var(--theme-text-sub)' }}>
                A memory from the past has just been unlocked
              </p>
              <div className="rounded-2xl p-3 mb-4" style={{ backgroundColor: 'var(--theme-primary-container)', color: 'var(--theme-on-primary-container)' }}>
                <p className="text-sm line-clamp-3">"{newlyRevealedCapsule}"</p>
              </div>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setNewlyRevealedCapsule(null)}
                className="px-8 py-2.5 rounded-full text-sm font-semibold text-white"
                style={{ backgroundColor: 'var(--theme-primary)' }}
              >
                Dismiss ✨
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   CHAT SCREEN
   ═══════════════════════════════════════════════════════ */

/* ─── Voice Message Playback Component ────────────── */
function VoiceMessageBubble({ url, duration, isSent, waveform }: { url: string; duration?: number; isSent: boolean; waveform?: number[] }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(duration || 0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [dragProgress, setDragProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animFrameRef = useRef<number>(0);
  const waveContainerRef = useRef<HTMLDivElement>(null);

  const formatDur = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const progress = isDragging ? dragProgress : (totalDuration > 0 ? playbackTime / totalDuration : 0);

  // Generate waveform bars from the audio file using Web Audio API (Feature 3)
  const WAVE_BARS = 32;
  const [waveformBars, setWaveformBars] = useState<number[] | null>(null);
  const barHeights = useRef(Array.from({ length: WAVE_BARS }, (_, i) => {
    // Fallback: deterministic pattern
    const seed = (i * 7 + 13) % 17;
    return 0.25 + (seed / 17) * 0.75;
  }));

  // Enhancement 8: Use stored waveform data if available, otherwise decode from audio
  useEffect(() => {
    // If waveform data is provided in the message, use it directly
    if (waveform && waveform.length > 0) {
      // Normalize stored waveform to WAVE_BARS count
      const normalized: number[] = [];
      const step = waveform.length / WAVE_BARS;
      for (let i = 0; i < WAVE_BARS; i++) {
        const idx = Math.floor(i * step);
        normalized.push(Math.max(0.15, Math.min(1.0, waveform[idx] || 0.25)));
      }
      barHeights.current = normalized;
      // Use microtask to avoid calling setState directly in effect
      queueMicrotask(() => setWaveformBars(normalized));
      return;
    }

    // Otherwise decode from audio file
    let cancelled = false;
    const decodeAudio = async () => {
      try {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        if (cancelled) { audioCtx.close(); return; }

        const channelData = audioBuffer.getChannelData(0);
        const samples = WAVE_BARS;
        const blockSize = Math.floor(channelData.length / samples);
        const bars: number[] = [];

        for (let i = 0; i < samples; i++) {
          let sum = 0;
          for (let j = 0; j < blockSize; j++) {
            sum += Math.abs(channelData[i * blockSize + j]);
          }
          const avg = sum / blockSize;
          // Normalize to 0.15-1.0 range for visual appeal
          bars.push(Math.max(0.15, Math.min(1.0, avg * 4)));
        }

        if (!cancelled) {
          barHeights.current = bars;
          setWaveformBars(bars);
        }
        audioCtx.close();
      } catch {
        // Fallback: keep the deterministic bars
        if (!cancelled) setWaveformBars(barHeights.current);
      }
    };

    if (url) decodeAudio();
    return () => { cancelled = true; };
  }, [url, waveform]);

  const startPlaybackTick = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current);
    const tick = () => {
      if (audioRef.current && !audioRef.current.paused) {
        setPlaybackTime(audioRef.current.currentTime);
        animFrameRef.current = requestAnimationFrame(tick);
      }
    };
    tick();
  }, []);

  const togglePlay = useCallback(() => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      cancelAnimationFrame(animFrameRef.current);
    } else {
      // Reset to start if finished
      if (audioRef.current.ended || audioRef.current.currentTime >= audioRef.current.duration) {
        audioRef.current.currentTime = 0;
      }
      audioRef.current.play().catch(() => {});
      setIsPlaying(true);
      startPlaybackTick();
    }
  }, [isPlaying, startPlaybackTick]);

  // Handle seeking via waveform click/drag
  const handleWaveInteraction = useCallback((clientX: number) => {
    if (!waveContainerRef.current || !audioRef.current) return;
    const rect = waveContainerRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    if (audioRef.current.duration && isFinite(audioRef.current.duration)) {
      audioRef.current.currentTime = pct * audioRef.current.duration;
    }
    setPlaybackTime(pct * (totalDuration || 0));
    setDragProgress(pct);
  }, [totalDuration]);

  const handleWaveMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    handleWaveInteraction(e.clientX);
  }, [handleWaveInteraction]);

  const handleWaveTouchStart = useCallback((e: React.TouchEvent) => {
    setIsDragging(true);
    handleWaveInteraction(e.touches[0].clientX);
  }, [handleWaveInteraction]);

  // Global mouse/touch move and up handlers for dragging
  useEffect(() => {
    if (!isDragging) return;
    const onMove = (clientX: number) => handleWaveInteraction(clientX);
    const onMouseMove = (e: MouseEvent) => onMove(e.clientX);
    const onTouchMove = (e: TouchEvent) => onMove(e.touches[0].clientX);
    const onEnd = () => setIsDragging(false);

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('touchmove', onTouchMove);
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchend', onEnd);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchend', onEnd);
    };
  }, [isDragging, handleWaveInteraction]);

  // Cycle playback speed: 1x → 1.5x → 2x → 1x
  const cycleSpeed = useCallback(() => {
    if (!audioRef.current) return;
    const rates = [1, 1.5, 2];
    const idx = rates.indexOf(playbackRate);
    const next = rates[(idx + 1) % rates.length];
    audioRef.current.playbackRate = next;
    setPlaybackRate(next);
  }, [playbackRate]);

  // Pause all other voice bubbles when one starts playing
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as string;
      if (detail !== url && audioRef.current && isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
        cancelAnimationFrame(animFrameRef.current);
      }
    };
    window.addEventListener('voice-play', handler);
    return () => window.removeEventListener('voice-play', handler);
  }, [url, isPlaying]);

  const emitPlayEvent = useCallback(() => {
    window.dispatchEvent(new CustomEvent('voice-play', { detail: url }));
  }, [url]);

  const handlePlay = useCallback(() => {
    emitPlayEvent();
    togglePlay();
  }, [emitPlayEvent, togglePlay]);

  return (
    <div className="flex items-center gap-2.5 py-1 min-w-[200px] max-w-[260px]">
      <motion.button
        whileTap={{ scale: 0.85 }}
        onClick={handlePlay}
        className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-sm"
        style={{ backgroundColor: isSent ? 'rgba(255,255,255,0.2)' : 'var(--theme-primary)', color: isSent ? 'white' : 'var(--theme-on-primary)' }}
      >
        {isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" className="ml-0.5" />}
      </motion.button>
      <div className="flex-1 flex flex-col gap-1.5">
        {/* Interactive waveform seek bar */}
        <div
          ref={waveContainerRef}
          className="flex items-end gap-[2px] h-7 cursor-pointer select-none touch-none"
          onMouseDown={handleWaveMouseDown}
          onTouchStart={handleWaveTouchStart}
        >
          {(waveformBars ?? Array.from({ length: WAVE_BARS }, (_, i) => 0.25 + ((i * 7 + 13) % 17) / 17 * 0.75)).map((h, i) => {
            const filled = i / WAVE_BARS <= progress;
            const isCurrentBar = Math.floor(progress * WAVE_BARS) === i;
            return (
              <div
                key={i}
                className="w-[3px] rounded-full transition-colors duration-100"
                style={{
                  height: `${h * 100}%`,
                  backgroundColor: filled
                    ? (isSent ? 'rgba(255,255,255,0.9)' : 'var(--theme-primary)')
                    : (isSent ? 'rgba(255,255,255,0.25)' : 'var(--theme-primary-container)'),
                  transform: isCurrentBar && isPlaying ? 'scaleY(1.15)' : 'scaleY(1)',
                }}
              />
            );
          })}
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[10px] opacity-60 font-medium font-mono">
            {formatDur(isPlaying || isDragging ? playbackTime : (totalDuration || 0))}
          </span>
          <button
            onClick={cycleSpeed}
            className="text-[9px] font-bold opacity-50 hover:opacity-90 px-1.5 py-0.5 rounded-full transition-opacity"
            style={{ backgroundColor: isSent ? 'rgba(255,255,255,0.15)' : 'var(--theme-primary-container)' }}
          >
            {playbackRate}x
          </button>
        </div>
      </div>
      <audio
        ref={audioRef}
        src={url}
        preload="metadata"
        onLoadedMetadata={(e) => {
          const dur = e.currentTarget.duration;
          if (isFinite(dur) && dur > 0) setTotalDuration(dur);
        }}
        onEnded={() => { setIsPlaying(false); setPlaybackTime(0); cancelAnimationFrame(animFrameRef.current); }}
        onError={() => { setIsPlaying(false); }}
        className="hidden"
      />
    </div>
  );
}

/* ─── Advanced Media Player / Lightbox ────────────── */
function MediaPlayer({
  item,
  onClose,
}: {
  item: { type: 'image' | 'video'; url: string; allMedia: { type: 'image' | 'video'; url: string }[] };
  onClose: () => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(() => {
    return item.allMedia.findIndex((m) => m.url === item.url && m.type === item.type);
  });
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [videoMuted, setVideoMuted] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsTimerRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const touchMoved = useRef(false);

  const mediaList = item.allMedia;
  const current = mediaList[currentIndex] || item;

  const formatVideoTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  // Auto-hide controls for video
  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = setTimeout(() => {
      if (videoPlaying) setShowControls(false);
    }, 3000);
  }, [videoPlaying]);

  useEffect(() => {
    queueMicrotask(() => resetControlsTimer());
    return () => { if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current); };
  }, [resetControlsTimer]);

  // Zoom controls
  const handleZoomIn = () => {
    const newZoom = Math.min(zoom + 0.5, 4);
    setZoom(newZoom);
    if (newZoom <= 1) { setPanX(0); setPanY(0); }
  };
  const handleZoomOut = () => {
    const newZoom = Math.max(zoom - 0.5, 1);
    setZoom(newZoom);
    if (newZoom <= 1) { setPanX(0); setPanY(0); }
  };
  const handleResetZoom = () => { setZoom(1); setPanX(0); setPanY(0); };

  // Double-tap zoom
  const lastTapRef = useRef(0);
  const handleDoubleTap = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      if (zoom > 1) {
        handleResetZoom();
      } else {
        setZoom(2.5);
      }
    }
    lastTapRef.current = now;
  };

  // Pan handlers
  const handlePanStart = (clientX: number, clientY: number) => {
    if (zoom <= 1) return;
    setIsDragging(true);
    dragStart.current = { x: clientX, y: clientY, panX, panY };
  };
  const handlePanMove = (clientX: number, clientY: number) => {
    if (!isDragging || zoom <= 1) return;
    setPanX(dragStart.current.panX + (clientX - dragStart.current.x));
    setPanY(dragStart.current.panY + (clientY - dragStart.current.y));
  };
  const handlePanEnd = () => { setIsDragging(false); };

  // Swipe between media
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    touchMoved.current = false;
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = e.touches[0].clientY - touchStartY.current;
    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) touchMoved.current = true;
    if (zoom > 1) handlePanMove(e.touches[0].clientX, e.touches[0].clientY);
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    handlePanEnd();
    if (zoom > 1 || touchMoved.current) return;
    // Swipe navigation
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0 && currentIndex < mediaList.length - 1) {
        setCurrentIndex(currentIndex + 1);
        setZoom(1); setPanX(0); setPanY(0);
      } else if (dx > 0 && currentIndex > 0) {
        setCurrentIndex(currentIndex - 1);
        setZoom(1); setPanX(0); setPanY(0);
      }
    }
  };

  // Video controls
  const toggleVideoPlay = () => {
    if (!videoRef.current) return;
    if (videoPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play().catch(() => {});
    }
    setVideoPlaying(!videoPlaying);
    resetControlsTimer();
  };

  const handleVideoSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current || !videoDuration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    videoRef.current.currentTime = pct * videoDuration;
  };

  const handleVideoTimeUpdate = () => {
    if (!videoRef.current) return;
    setVideoProgress(videoRef.current.currentTime);
    if (videoRef.current.duration && isFinite(videoRef.current.duration)) {
      setVideoDuration(videoRef.current.duration);
    }
  };

  // Save image/video
  const handleSave = async () => {
    try {
      const response = await fetch(current.url);
      const blob = await response.blob();
      const ext = current.type === 'video' ? 'mp4' : 'png';
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `sanctuary_${Date.now()}.${ext}`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch { /* ignore */ }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft' && currentIndex > 0) { setCurrentIndex(currentIndex - 1); setZoom(1); setPanX(0); setPanY(0); }
      else if (e.key === 'ArrowRight' && currentIndex < mediaList.length - 1) { setCurrentIndex(currentIndex + 1); setZoom(1); setPanX(0); setPanY(0); }
      else if (e.key === '+' || e.key === '=') handleZoomIn();
      else if (e.key === '-') handleZoomOut();
      else if (e.key === '0') handleResetZoom();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  });

  // Reset zoom when changing media
  useEffect(() => {
    queueMicrotask(() => { setZoom(1); setPanX(0); setPanY(0); setVideoPlaying(false); setVideoProgress(0); });
    if (videoRef.current) { videoRef.current.pause(); videoRef.current.currentTime = 0; }
  }, [currentIndex]);

  return (
    <motion.div
      className="fixed inset-0 z-[100] bg-black/95 flex flex-col"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0 z-10">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white"
        >
          <X size={20} />
        </motion.button>
        <div className="text-white/70 text-sm font-medium">
          {currentIndex + 1} / {mediaList.length}
        </div>
        <div className="flex items-center gap-2">
          {current.type === 'image' && (
            <>
              <motion.button whileTap={{ scale: 0.9 }} onClick={handleZoomOut}
                className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white disabled:opacity-30"
                disabled={zoom <= 1}
              >
                <span className="text-lg font-bold leading-none">−</span>
              </motion.button>
              <motion.button whileTap={{ scale: 0.9 }} onClick={handleZoomIn}
                className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white"
              >
                <span className="text-lg font-bold leading-none">+</span>
              </motion.button>
              {zoom > 1 && (
                <motion.button whileTap={{ scale: 0.9 }} onClick={handleResetZoom}
                  initial={{ scale: 0 }} animate={{ scale: 1 }}
                  className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white"
                >
                  <span className="text-xs font-bold">1:1</span>
                </motion.button>
              )}
            </>
          )}
          <motion.button whileTap={{ scale: 0.9 }} onClick={handleSave}
            className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white"
          >
            <Download size={16} />
          </motion.button>
        </div>
      </div>

      {/* Media area */}
      <div
        className="flex-1 flex items-center justify-center relative overflow-hidden select-none"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={(e) => { if (zoom > 1) handlePanStart(e.clientX, e.clientY); }}
        onMouseMove={(e) => handlePanMove(e.clientX, e.clientY)}
        onMouseUp={handlePanEnd}
        onMouseLeave={handlePanEnd}
        onClick={(e) => {
          if (zoom <= 1) handleDoubleTap();
        }}
      >
        {/* Left/Right navigation arrows (desktop) */}
        {currentIndex > 0 && (
          <button
            onClick={(e) => { e.stopPropagation(); setCurrentIndex(currentIndex - 1); setZoom(1); setPanX(0); setPanY(0); }}
            className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white z-10 transition-colors hidden md:flex"
          >
            <ChevronLeft size={20} />
          </button>
        )}
        {currentIndex < mediaList.length - 1 && (
          <button
            onClick={(e) => { e.stopPropagation(); setCurrentIndex(currentIndex + 1); setZoom(1); setPanX(0); setPanY(0); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white z-10 transition-colors hidden md:flex"
          >
            <ChevronLeft size={20} className="rotate-180" />
          </button>
        )}

        {current.type === 'image' ? (
          <motion.img
            key={current.url}
            src={current.url}
            alt="Full size"
            className="max-w-full max-h-full object-contain select-none"
            style={{
              transform: `scale(${zoom}) translate(${panX / zoom}px, ${panY / zoom}px)`,
              cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in',
              transition: isDragging ? 'none' : 'transform 0.2s ease-out',
            }}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.25 }}
            draggable={false}
          />
        ) : (
          <div className="relative w-full h-full flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
            <video
              ref={videoRef}
              src={current.url}
              className="max-w-full max-h-full object-contain"
              onTimeUpdate={handleVideoTimeUpdate}
              onLoadedMetadata={() => {
                if (videoRef.current?.duration && isFinite(videoRef.current.duration)) {
                  setVideoDuration(videoRef.current.duration);
                }
              }}
              onEnded={() => { setVideoPlaying(false); setShowControls(true); }}
              onClick={toggleVideoPlay}
              playsInline
              muted={videoMuted}
            />
            {/* Video play overlay */}
            <AnimatePresence>
              {!videoPlaying && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.5 }}
                  onClick={toggleVideoPlay}
                  className="absolute inset-0 flex items-center justify-center z-10"
                >
                  <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                    <Play size={28} fill="white" className="text-white ml-1" />
                  </div>
                </motion.button>
              )}
            </AnimatePresence>

            {/* Custom video controls overlay */}
            <AnimatePresence>
              {showControls && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-4 pb-4 pt-16"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Progress bar */}
                  <div
                    className="w-full h-1 bg-white/20 rounded-full mb-3 cursor-pointer group"
                    onClick={handleVideoSeek}
                  >
                    <div
                      className="h-full bg-white rounded-full relative group:h-1.5 transition-all"
                      style={{ width: `${videoDuration > 0 ? (videoProgress / videoDuration) * 100 : 0}%` }}
                    >
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={toggleVideoPlay} className="text-white">
                      {videoPlaying ? <Pause size={20} fill="white" /> : <Play size={20} fill="white" className="ml-0.5" />}
                    </button>
                    <span className="text-white/70 text-xs font-mono">
                      {formatVideoTime(videoProgress)} / {formatVideoTime(videoDuration)}
                    </span>
                    <div className="flex-1" />
                    <button onClick={() => setVideoMuted(!videoMuted)} className="text-white/70">
                      {videoMuted ? <Volume2 size={18} className="opacity-40" /> : <Volume2 size={18} />}
                    </button>
                    <button
                      onClick={() => {
                        if (videoRef.current) {
                          if (videoRef.current.requestFullscreen) videoRef.current.requestFullscreen();
                          else if ((videoRef.current as any).webkitRequestFullscreen) (videoRef.current as any).webkitRequestFullscreen();
                        }
                      }}
                      className="text-white/70"
                    >
                      <Maximize2 size={18} />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Tap to show controls */}
            {!showControls && (
              <div
                className="absolute inset-0 z-5"
                onClick={(e) => { e.stopPropagation(); resetControlsTimer(); }}
              />
            )}
          </div>
        )}
      </div>

      {/* Thumbnail strip at bottom */}
      {mediaList.length > 1 && (
        <div className="shrink-0 py-2 px-4 flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {mediaList.map((m, i) => (
            <button
              key={i}
              onClick={() => { setCurrentIndex(i); setZoom(1); setPanX(0); setPanY(0); }}
              className={`shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-all ${
                i === currentIndex ? 'border-white scale-105' : 'border-transparent opacity-50 hover:opacity-80'
              }`}
            >
              {m.type === 'image' ? (
                <img src={m.url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-white/10 flex items-center justify-center">
                  <Play size={14} fill="white" className="text-white" />
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </motion.div>
  );
}

function ChatScreen({ socketIO }: { socketIO: ReturnType<typeof useSocketIO> }) {
  // Selective subscriptions — avoid subscribing to entire store
  const identity = useAppStore((s) => s.identity);
  const batmanName = useAppStore((s) => s.batmanName);
  const princessName = useAppStore((s) => s.princessName);
  const batmanPhoto = useAppStore((s) => s.batmanPhoto);
  const princessPhoto = useAppStore((s) => s.princessPhoto);
  const messages = useAppStore((s) => s.messages);
  const wsConnected = useAppStore((s) => s.wsConnected);
  const partnerTypingWS = useAppStore((s) => s.partnerTypingWS);
  const isSelectionMode = useAppStore((s) => s.isSelectionMode);
  const selectedMessages = useAppStore((s) => s.selectedMessages);
  const replyingTo = useAppStore((s) => s.replyingTo);
  const vaultId = useAppStore((s) => s.vaultId);
  const addMessage = useAppStore((s) => s.addMessage);
  const deleteMessage = useAppStore((s) => s.deleteMessage);
  const addReaction = useAppStore((s) => s.addReaction);
  const setReplyingTo = useAppStore((s) => s.setReplyingTo);
  const toggleSelectMessage = useAppStore((s) => s.toggleSelectMessage);
  const exitSelectionMode = useAppStore((s) => s.exitSelectionMode);
  const deleteSelectedMessages = useAppStore((s) => s.deleteSelectedMessages);
  const starMessage = useAppStore((s) => s.starMessage);
  const setSelectedMessages = useAppStore((s) => s.setSelectedMessages);
  const setSelectionMode = useAppStore((s) => s.setSelectionMode);
  const encryptionEnabled = useAppStore((s) => s.encryptionEnabled);
  const encryptionKey = useAppStore((s) => s.encryptionKey);
  const setChatOpen = useAppStore((s) => s.setChatOpen);
  const chatOpen = useAppStore((s) => s.chatOpen);
  const chatWallpaper = useAppStore((s) => s.chatWallpaper);
  const partnerOnline = useAppStore((s) => s.partnerOnline);
  const partnerLastSeen = useAppStore((s) => s.partnerLastSeen);
  const setMessages = useAppStore((s) => s.setMessages);
  const updateMessageStatus = useAppStore((s) => s.updateMessageStatus);
  const chatMuted = useAppStore((s) => s.chatMuted);
  const setChatMuted = useAppStore((s) => s.setChatMuted);
  const [input, setInput] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [showReactions, setShowReactions] = useState<number | null>(null);
  const [showAttach, setShowAttach] = useState(false);
  const [showChatMenu, setShowChatMenu] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [swipingId, setSwipingId] = useState<number | null>(null);
  const [swipeX, setSwipeX] = useState(0);
  const touchStartX = useRef(0);
  const [showStarred, setShowStarred] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [mediaViewerItem, setMediaViewerItem] = useState<{ type: 'image' | 'video'; url: string; allMedia: { type: 'image' | 'video'; url: string }[] } | null>(null);

  // ─── Voice Recording State ───────────────────────────
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordingWaveform, setRecordingWaveform] = useState<number[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const waveformIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // ─── Message Selection State ─────────────────────────
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const longPressFiredRef = useRef(false);
  const longPressResetRef = useRef(false);

  // ─── Media Upload State ──────────────────────────────
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const documentInputRef = useRef<HTMLInputElement | null>(null);
  const wallpaperInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadFileName, setUploadFileName] = useState('');

  // ─── Typing indicator ────────────────────────────────
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // ─── Offline Queue (Feature 5) ─────────────────────────
  const [offlineQueueCount, setOfflineQueueCount] = useState(0);

  // Load offline queue count on mount
  useEffect(() => {
    const loadCount = async () => {
      try {
        const queue = await loadOfflineQueue(vaultId);
        setOfflineQueueCount(queue.length);
      } catch {}
    };
    loadCount();
  }, [vaultId]);

  const myName = identity === 'Batman' ? batmanName : princessName;
  const partnerName = identity === 'Batman' ? princessName : batmanName;
  const myPhoto = identity === 'Batman' ? batmanPhoto : princessPhoto;
  const partnerPhoto = identity === 'Batman' ? princessPhoto : batmanPhoto;

  // Use WS typing indicator if connected, else local
  const partnerTyping = wsConnected ? partnerTypingWS : false;

  const activeMessages = messages.filter((m) => !m.deleted);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleScroll = () => {
    if (!chatContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    setShowScrollBtn(scrollHeight - scrollTop - clientHeight > 100);
  };

  const scrollToBottom = () => {
    chatContainerRef.current?.scrollTo({ top: chatContainerRef.current.scrollHeight, behavior: 'smooth' });
  };

  // ─── Voice Recording ─────────────────────────────────
  const startVoiceRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.start(200); // collect data every 200ms
      setIsRecording(true);
      setRecordingTime(0);
      setRecordingWaveform([]);

      // Real audio waveform using Web Audio API AnalyserNode
      try {
        const audioCtx = new AudioContext();
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        source.connect(analyser);
        audioContextRef.current = audioCtx;
        analyserRef.current = analyser;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        waveformIntervalRef.current = setInterval(() => {
          if (analyserRef.current) {
            analyserRef.current.getByteFrequencyData(dataArray);
            // Compute RMS amplitude from frequency data for a smooth waveform bar
            const sum = dataArray.reduce((acc, v) => acc + v, 0);
            const avg = sum / dataArray.length / 255; // normalize 0-1
            const newBar = Math.max(0.08, avg);
            setRecordingWaveform((prev) => {
              const next = [...prev, newBar];
              return next.length > 50 ? next.slice(-50) : next;
            });
          }
        }, 100);
      } catch {
        // Fallback: simulated waveform if AudioContext not available
        waveformIntervalRef.current = setInterval(() => {
          setRecordingWaveform((prev) => {
            const newBar = 0.15 + Math.random() * 0.85;
            const next = [...prev, newBar];
            return next.length > 50 ? next.slice(-50) : next;
          });
        }, 100);
      }

      // Timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Recording start failed:', err);
      setIsRecording(false);
    }
  }, []);

  const stopVoiceRecording = useCallback(async (send: boolean) => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
      setIsRecording(false);
      // Clean up stream just in case
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
      }
      return;
    }

    const mr = mediaRecorderRef.current;
    const finalRecordingTime = recordingTime;
    const finalWaveform = [...recordingWaveform];
    const currentReplyingTo = replyingTo;
    const currentIdentity = identity;
    const currentMyName = myName;
    const currentPartnerName = partnerName;

    // Stop waveform analysis
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
      analyserRef.current = null;
    }

    if (send) {
      mr.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mr.mimeType || 'audio/webm' });

        // Upload audio to server so partner can access it
        let audioUrl: string;
        try {
          const formData = new FormData();
          formData.append('file', audioBlob, `voice_${Date.now()}.webm`);
          const res = await fetch('/api/upload', { method: 'POST', body: formData });
          if (res.ok) {
            const data = await res.json();
            audioUrl = data.url || data.fileUrl || data.path;
          } else {
            // Fallback to blob URL (only works locally)
            audioUrl = URL.createObjectURL(audioBlob);
          }
        } catch {
          // Fallback to blob URL
          audioUrl = URL.createObjectURL(audioBlob);
        }

        const msg: Message = {
          id: Date.now(),
          type: 'sent',
          senderId: currentIdentity,
          audio: audioUrl,
          audioDuration: finalRecordingTime,
          waveform: finalWaveform.length > 0 ? finalWaveform : undefined,
          messageType: 'audio',
          time: new Date().toISOString(),
          status: 'sent',
          replyTo: currentReplyingTo ? {
            id: currentReplyingTo.id,
            text: currentReplyingTo.text?.slice(0, 50),
            sender: currentReplyingTo.senderId === currentIdentity ? currentMyName : currentPartnerName,
          } : undefined,
        };
        addMessage(msg);
        socketIO.emitMessage(msg);
        setReplyingTo(null);

        // Stop the microphone stream
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((track) => track.stop());
          mediaStreamRef.current = null;
        }
      };
      mr.stop();
    } else {
      mr.onstop = () => {
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((track) => track.stop());
          mediaStreamRef.current = null;
        }
      };
      mr.stop();
    }

    setIsRecording(false);
    setRecordingTime(0);
    setRecordingWaveform([]);
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    if (waveformIntervalRef.current) clearInterval(waveformIntervalRef.current);
  }, [recordingTime, myName, partnerName, socketIO]);

  const cancelVoiceRecording = useCallback(() => {
    stopVoiceRecording(false);
  }, [stopVoiceRecording]);

  // ─── Send Message ────────────────────────────────────
  const sendMessage = () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    const msgId = Date.now();
    const msg: Message = {
      id: msgId,
      type: 'sent',
      senderId: identity,
      text: trimmed,
      time: new Date().toISOString(),
      status: 'sent',
      replyTo: replyingTo ? {
        id: replyingTo.id,
        text: replyingTo.text?.slice(0, 50),
        sender: replyingTo.senderId === identity ? myName : partnerName,
      } : undefined,
    };
    addMessage(msg);

    // Feature 5: If not connected, queue to offline storage
    if (!wsConnected || !socketIO.socket.current?.connected) {
      saveOfflineMessage({
        id: `offline-${msgId}`,
        vaultId,
        message: msg,
        timestamp: Date.now(),
      }).then(() => {
        loadOfflineQueue(vaultId).then(q => setOfflineQueueCount(q.length));
      }).catch(() => {});
    } else {
      socketIO.emitMessage(msg);
    }

    setInput('');
    setReplyingTo(null);
    setShowEmoji(false);

    // Stop typing
    socketIO.emitStopTyping();
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);

    // Feature 4: No more fake read receipts — real ones come via Socket.IO
  };

  // ─── Handle Input Change with Typing Indicator ───────
  const handleInputChange = (val: string) => {
    setInput(val);
    if (val.trim() && wsConnected) {
      socketIO.emitTyping();
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        socketIO.emitStopTyping();
      }, 2000);
    }
  };

  // ─── Media Upload Handler ────────────────────────────
  const handleFileUpload = async (file: File, type: 'image' | 'video' | 'audio' | 'document') => {
    setUploading(true);
    setUploadProgress(0);
    setUploadFileName(file.name);
    try {
      const fileUrl = await uploadWithProgress(file, (pct) => setUploadProgress(pct));

      const msgId = Date.now();
      const msg: Message = {
        id: msgId,
        type: 'sent',
        senderId: identity,
        time: new Date().toISOString(),
        status: 'sent',
        messageType: type,
        replyTo: replyingTo ? {
          id: replyingTo.id,
          text: replyingTo.text?.slice(0, 50),
          sender: replyingTo.senderId === identity ? myName : partnerName,
        } : undefined,
        ...(type === 'image' ? { image: fileUrl, text: undefined } : {}),
        ...(type === 'video' ? { video: fileUrl, text: undefined } : {}),
        ...(type === 'audio' ? { audio: fileUrl, audioDuration: 0, text: undefined } : {}),
        ...(type === 'document' ? { documentUrl: fileUrl, fileName: file.name, fileSize: file.size, text: undefined } : {}),
      };
      addMessage(msg);
      socketIO.emitMessage(msg);
      setReplyingTo(null);
    } catch (err) {
      console.error('Upload failed:', err);
    }
    setUploading(false);
    setUploadProgress(0);
    setUploadFileName('');
  };

  // ─── Message Touch Handlers ──────────────────────────
  const handleTouchStart = (msgId: number, e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    longPressFiredRef.current = false;
    longPressResetRef.current = false;
    setSwipingId(msgId);

    // Long press to enter selection mode
    if (!isSelectionMode) {
      longPressTimerRef.current = setTimeout(() => {
        longPressFiredRef.current = true;
        longPressResetRef.current = true;
        toggleSelectMessage(msgId);
        if (navigator.vibrate) navigator.vibrate(30);
      }, 500);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!swipingId) return;
    const diff = e.touches[0].clientX - touchStartX.current;
    if (Math.abs(diff) > 10 && longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (diff > 0 && !isSelectionMode) setSwipeX(Math.min(diff, 80));
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (!longPressFiredRef.current && swipeX > 50 && swipingId && !isSelectionMode) {
      const msg = messages.find((m) => m.id === swipingId);
      if (msg) setReplyingTo(msg);
    }
    setSwipingId(null);
    setSwipeX(0);
    // Delayed reset to prevent click handler re-triggering
    if (longPressResetRef.current) {
      setTimeout(() => {
        longPressFiredRef.current = false;
        longPressResetRef.current = false;
      }, 100);
    }
  };

  // ─── Mouse-based Long Press (Desktop Support) ─────────
  const mouseStartX = useRef(0);
  const mouseSwipingId = useRef<number | null>(null);
  const mouseLongPressFired = useRef(false);
  const mouseLongPressReset = useRef(false);
  const mouseLongPressTimer = useRef<NodeJS.Timeout | null>(null);

  const handleMouseDown = (msgId: number, e: React.MouseEvent) => {
    // Only handle left mouse button
    if (e.button !== 0) return;
    mouseStartX.current = e.clientX;
    mouseSwipingId.current = msgId;
    mouseLongPressFired.current = false;
    mouseLongPressReset.current = false;
    setSwipingId(msgId);

    if (!isSelectionMode) {
      mouseLongPressTimer.current = setTimeout(() => {
        mouseLongPressFired.current = true;
        longPressFiredRef.current = true;
        mouseLongPressReset.current = true;
        toggleSelectMessage(msgId);
        if (navigator.vibrate) navigator.vibrate(30);
      }, 500);
    }
  };

  const handleMouseUp = () => {
    if (mouseLongPressTimer.current) {
      clearTimeout(mouseLongPressTimer.current);
      mouseLongPressTimer.current = null;
    }
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    // If not a long press and we were swiping, check for reply gesture
    if (!longPressFiredRef.current && !mouseLongPressFired.current && swipeX > 50 && swipingId && !isSelectionMode) {
      const msg = messages.find((m) => m.id === swipingId);
      if (msg) setReplyingTo(msg);
    }
    setSwipingId(null);
    setSwipeX(0);
    mouseSwipingId.current = null;
    // Delayed reset to prevent click handler re-triggering
    if (mouseLongPressReset.current) {
      setTimeout(() => {
        longPressFiredRef.current = false;
        mouseLongPressFired.current = false;
        mouseLongPressReset.current = false;
      }, 100);
    }
  };

  const handleMouseLeave = () => {
    if (mouseLongPressTimer.current) {
      clearTimeout(mouseLongPressTimer.current);
      mouseLongPressTimer.current = null;
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!mouseSwipingId.current) return;
    const diff = e.clientX - mouseStartX.current;
    if (Math.abs(diff) > 10 && mouseLongPressTimer.current) {
      clearTimeout(mouseLongPressTimer.current);
      mouseLongPressTimer.current = null;
    }
    if (diff > 0 && !isSelectionMode) setSwipeX(Math.min(diff, 80));
  };

  // ─── Message Click Handler ───────────────────────────
  const handleMessageClick = (msgId: number) => {
    // If long press was just fired, ignore the click
    if (longPressFiredRef.current || mouseLongPressFired.current) {
      return;
    }
    if (isSelectionMode) {
      toggleSelectMessage(msgId);
    }
  };

  // ─── Context Menu Actions ────────────────────────────
  const handleCopySelected = () => {
    const texts = messages
      .filter((m) => selectedMessages.includes(m.id) && m.text)
      .map((m) => m.text);
    if (texts.length > 0) {
      navigator.clipboard.writeText(texts.join('\n')).catch(() => {});
    }
    exitSelectionMode();
  };

  const handleReplyToSelected = () => {
    if (selectedMessages.length === 1) {
      const msg = messages.find((m) => m.id === selectedMessages[0]);
      if (msg) setReplyingTo(msg);
    }
    exitSelectionMode();
  };

  const handleStarSelected = () => {
    selectedMessages.forEach((id) => {
      starMessage(id);
      socketIO.emitStarMessage(String(id));
    });
    exitSelectionMode();
  };

  const handleDeleteSelected = () => {
    deleteSelectedMessages();
  };

  const statusIcon = (status?: string) => {
    if (status === 'sent') return <Check size={14} className="opacity-50" />;
    if (status === 'received') return <CheckCheck size={14} className="opacity-50" />;
    if (status === 'seen') return <CheckCheck size={14} style={{ color: 'var(--theme-primary)' }} />;
    return null;
  };

  const reactionEmojis = ['❤️', '👍', '😂', '😮', '🔥', '🎀'];

  const formatRecTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // ─── Chat List View ──────────────────────────────────
  if (!chatOpen) {
    return (
      <div className="px-4 pb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold" style={{ color: 'var(--theme-text-main)' }}>Messages</h2>
        </div>
        <motion.div
          whileTap={{ scale: 0.98 }}
          onClick={() => setChatOpen(true)}
          className="rounded-3xl p-4 shadow-sm cursor-pointer"
          style={{ backgroundColor: 'var(--theme-surface)' }}
        >
          <div className="flex items-center gap-3">
            <div className="relative">
              <ProfileAvatar name={partnerName} photo={partnerPhoto} size={52} />
              {partnerOnline && (
                <div className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-white bg-green-500" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="font-semibold" style={{ color: 'var(--theme-text-main)' }}>{partnerName}</span>
                <span className="text-xs" style={{ color: 'var(--theme-text-sub)' }}>
                  {partnerOnline ? 'Online' : timeAgo(partnerLastSeen)}
                </span>
              </div>
              {activeMessages.length > 0 && (
                <p className="text-sm truncate mt-0.5" style={{ color: 'var(--theme-text-sub)' }}>
                  {activeMessages[activeMessages.length - 1].text || (activeMessages[activeMessages.length - 1].audio ? '🎤 Voice message' : '📎 Media')}
                </p>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // ─── Full Chat View ──────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      {/* ─── Chat Header / Selection Action Bar ─────────── */}
      <AnimatePresence mode="wait">
        {isSelectionMode ? (
          <motion.div
            key="selection-bar"
            initial={{ y: -60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -60, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="flex items-center gap-2 px-3 py-2.5 shrink-0 shadow-md"
            style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-on-primary)' }}
          >
            <motion.button whileTap={{ scale: 0.9 }} onClick={() => exitSelectionMode()} className="p-1.5">
              <X size={22} />
            </motion.button>
            <span className="font-semibold text-sm flex-1">
              {selectedMessages.length} selected
            </span>
            <motion.button whileTap={{ scale: 0.85 }} onClick={handleReplyToSelected} className="p-2 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
              <Reply size={18} />
            </motion.button>
            <motion.button whileTap={{ scale: 0.85 }} onClick={handleStarSelected} className="p-2 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
              <Star size={18} />
            </motion.button>
            <motion.button whileTap={{ scale: 0.85 }} onClick={handleCopySelected} className="p-2 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
              <Copy size={18} />
            </motion.button>
            <motion.button whileTap={{ scale: 0.85 }} onClick={handleDeleteSelected} className="p-2 rounded-full" style={{ backgroundColor: 'rgba(239,68,68,0.3)' }}>
              <Trash2 size={18} />
            </motion.button>
          </motion.div>
        ) : (
          <motion.div
            key="chat-header"
            initial={{ y: -60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -60, opacity: 0 }}
            className="flex items-center gap-3 px-4 py-3 shrink-0"
            style={{ backgroundColor: 'var(--theme-surface)', borderBottom: '1px solid var(--theme-primary-container)' }}
          >
            <motion.button whileTap={{ scale: 0.9 }} onClick={() => setChatOpen(false)}>
              <ChevronLeft size={24} style={{ color: 'var(--theme-primary)' }} />
            </motion.button>
            <div className="relative">
              <ProfileAvatar name={partnerName} photo={partnerPhoto} size={40} />
              {partnerOnline && (
                <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 bg-green-500" style={{ borderColor: 'var(--theme-surface)' }} />
              )}
            </div>
            <div className="flex-1">
              <div className="font-semibold text-sm flex items-center gap-1" style={{ color: 'var(--theme-text-main)' }}>{partnerName} {chatMuted && <BellOff size={14} style={{ color: 'var(--theme-text-sub)' }} />}</div>
              <div className="text-xs" style={{ color: 'var(--theme-text-sub)' }}>
                {partnerOnline ? 'Online now' : `Last seen ${timeAgo(partnerLastSeen)}`}
              </div>
            </div>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => { setShowSearch(true); setSearchQuery(''); }}
              className="p-2 rounded-full"
              style={{ color: 'var(--theme-text-sub)' }}
            >
              <Search size={20} />
            </motion.button>
            <div className="relative">
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => setShowChatMenu(!showChatMenu)}
                className="p-2 rounded-full"
                style={{ color: 'var(--theme-text-sub)' }}
              >
                <MoreVertical size={20} />
              </motion.button>
              {/* Chat Menu Dropdown */}
              <AnimatePresence>
                {showChatMenu && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: -5 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: -5 }}
                    className="absolute right-0 top-full mt-1 rounded-2xl shadow-xl border overflow-hidden z-50 min-w-[180px]"
                    style={{ backgroundColor: 'var(--theme-surface)', borderColor: 'var(--theme-primary-container)' }}
                  >
                    <button
                      onClick={() => { setSelectionMode(true); setShowChatMenu(false); }}
                      className="flex items-center gap-3 px-4 py-3 w-full text-left text-sm hover:bg-black/5 transition-colors"
                      style={{ color: 'var(--theme-on-surface)' }}
                    >
                      <CheckCircle2 size={16} style={{ color: 'var(--theme-primary)' }} /> Select Messages
                    </button>
                    <button
                      onClick={() => { setShowStarred(true); setShowChatMenu(false); }}
                      className="flex items-center gap-3 px-4 py-3 w-full text-left text-sm hover:bg-black/5 transition-colors"
                      style={{ color: 'var(--theme-on-surface)' }}
                    >
                      <Bookmark size={16} style={{ color: 'var(--theme-primary)' }} /> Starred Messages
                    </button>
                    <button
                      onClick={() => { setShowSearch(true); setSearchQuery(''); setShowChatMenu(false); }}
                      className="flex items-center gap-3 px-4 py-3 w-full text-left text-sm hover:bg-black/5 transition-colors"
                      style={{ color: 'var(--theme-on-surface)' }}
                    >
                      <Search size={16} style={{ color: 'var(--theme-primary)' }} /> Search in Chat
                    </button>
                    <button
                      onClick={() => { setChatMuted(!chatMuted); setShowChatMenu(false); }}
                      className="flex items-center gap-3 px-4 py-3 w-full text-left text-sm hover:bg-black/5 transition-colors"
                      style={{ color: 'var(--theme-on-surface)' }}
                    >
                      {chatMuted ? <Bell size={16} style={{ color: 'var(--theme-primary)' }} /> : <BellOff size={16} style={{ color: 'var(--theme-primary)' }} />}
                      {chatMuted ? 'Unmute Notifications' : 'Mute Notifications'}
                    </button>
                    <button
                      onClick={() => {
                        setShowChatMenu(false);
                        wallpaperInputRef.current?.click();
                      }}
                      className="flex items-center gap-3 px-4 py-3 w-full text-left text-sm hover:bg-black/5 transition-colors"
                      style={{ color: 'var(--theme-on-surface)' }}
                    >
                      <Palette size={16} style={{ color: 'var(--theme-primary)' }} /> Wallpaper
                    </button>
                    <div className="border-t" style={{ borderColor: 'var(--theme-primary-container)' }} />
                    <button
                      onClick={() => {
                        setMessages(messages.map((m) => ({ ...m, deleted: true })));
                        setShowChatMenu(false);
                      }}
                      className="flex items-center gap-3 px-4 py-3 w-full text-left text-sm hover:bg-red-50 transition-colors text-red-500"
                    >
                      <Trash2 size={16} /> Clear Chat
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Close menu when clicking outside */}
      {showChatMenu && (
        <div className="fixed inset-0 z-40" onClick={() => setShowChatMenu(false)} />
      )}

      {/* ─── Messages Area ──────────────────────────────── */}
      <div
        ref={chatContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-3 py-3 space-y-1 relative"
        style={{
          background: chatWallpaper ? `url(${chatWallpaper}) center/cover` : 'var(--theme-bg)',
        }}
      >
        {/* Feature 7: Semi-transparent overlay for readability when wallpaper is set */}
        {chatWallpaper && <div className="absolute inset-0 bg-black/20 pointer-events-none" />}

        {/* Feature 12: End-to-end encrypted banner */}
        {encryptionEnabled && (
          <div className="relative flex items-center justify-center gap-1.5 py-1.5 mb-2 rounded-full text-xs font-medium" style={{ backgroundColor: 'var(--theme-surface)', color: 'var(--theme-text-sub)' }}>
            <Lock size={12} /> End-to-end encrypted
          </div>
        )}

        {/* Feature 5: Offline queue indicator */}
        {offlineQueueCount > 0 && (
          <div className="relative flex items-center justify-center gap-1.5 py-1.5 mb-2 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
            <Clock size={12} /> {offlineQueueCount} unsent message{offlineQueueCount !== 1 ? 's' : ''}
          </div>
        )}

        {/* Typing indicator */}
        {partnerTyping && (
          <div className="flex items-center gap-2 mb-2">
            <ProfileAvatar name={partnerName} photo={partnerPhoto} size={24} />
            <div
              className="rounded-2xl rounded-bl-sm px-4 py-2.5"
              style={{ backgroundColor: 'var(--theme-surface)' }}
            >
              <div className="flex gap-1">
                <span className="typing-dot-1 w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--theme-text-sub)' }} />
                <span className="typing-dot-2 w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--theme-text-sub)' }} />
                <span className="typing-dot-3 w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--theme-text-sub)' }} />
              </div>
            </div>
          </div>
        )}

        {activeMessages.map((msg) => {
          const isSent = msg.type === 'sent';
          const isSelected = selectedMessages.includes(msg.id);
          const isSwiping = swipingId === msg.id;
          return (
            <div
              key={msg.id}
              className="relative select-none"
              onTouchStart={(e) => handleTouchStart(msg.id, e)}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onMouseDown={(e) => handleMouseDown(msg.id, e)}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseLeave}
              onMouseMove={handleMouseMove}
              onContextMenu={(e) => {
                e.preventDefault();
                if (!isSelectionMode) setShowReactions(msg.id);
              }}
              onClick={() => handleMessageClick(msg.id)}
            >
              {/* Animated reply slide - whole message shifts right */}
              <motion.div
                className="flex items-center"
                animate={{ x: isSwiping && !isSelectionMode ? swipeX * 0.6 : 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              >
                {/* Reply icon appearing from left during swipe */}
                <motion.div
                  className="flex items-center justify-center shrink-0"
                  animate={{
                    width: isSwiping && swipeX > 20 && !isSelectionMode ? 40 : 0,
                    opacity: isSwiping && swipeX > 20 && !isSelectionMode ? 1 : 0,
                  }}
                  transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                >
                  <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: swipeX > 50 ? 'var(--theme-primary)' : 'var(--theme-primary-container)' }}>
                    <Reply size={14} style={{ color: swipeX > 50 ? 'var(--theme-on-primary)' : 'var(--theme-primary)' }} />
                  </div>
                </motion.div>

                <div className={`flex ${isSent ? 'justify-end' : 'justify-start'} items-end gap-1.5 mb-1 flex-1`}>
                  {/* Selection checkbox */}
                  {isSelectionMode && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="flex items-center self-center mr-1"
                    >
                      {isSelected ? (
                        <CheckCircle2 size={22} style={{ color: 'var(--theme-primary)' }} className="fill-current" />
                      ) : (
                        <Circle size={22} style={{ color: 'var(--theme-text-sub)' }} />
                      )}
                    </motion.div>
                  )}

                  {!isSent && !isSelectionMode && <ProfileAvatar name={partnerName} photo={partnerPhoto} size={24} />}

                  <div className={`max-w-[75%] ${isSent ? 'order-1' : ''}`}>
                    {/* Reply preview */}
                    {msg.replyTo && (
                      <motion.div
                        initial={{ opacity: 0, x: -10, height: 0 }}
                        animate={{ opacity: 1, x: 0, height: 'auto' }}
                        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                        className="text-xs px-3 py-1.5 rounded-t-2xl mb-0.5"
                        style={{
                          backgroundColor: isSent ? 'var(--theme-primary-container)' : 'var(--theme-surface-container)',
                          color: 'var(--theme-on-primary-container)',
                          borderLeft: `3px solid var(--theme-primary)`,
                        }}
                      >
                        <div className="font-semibold" style={{ color: 'var(--theme-primary)' }}>{msg.replyTo.sender}</div>
                        <div className="truncate opacity-70">{msg.replyTo.text || (msg.audio ? 'Voice message' : 'Media')}</div>
                      </motion.div>
                    )}

                    <div
                      className={`rounded-2xl px-3.5 py-2.5 text-sm ${isSent ? 'rounded-br-sm' : 'rounded-bl-sm'} transition-all duration-150 ${isSelected ? 'ring-2 scale-[1.02]' : ''}`}
                      style={{
                        backgroundColor: isSent ? 'var(--theme-primary)' : 'var(--theme-surface)',
                        color: isSent ? 'var(--theme-on-primary)' : 'var(--theme-on-surface)',
                        ringColor: isSelected ? 'var(--theme-primary)' : 'transparent',
                      }}
                      onDoubleClick={() => { if (!isSelectionMode) { addReaction(msg.id, '❤️'); socketIO.emitReaction(String(msg.id), '❤️'); } }}
                    >
                      {/* Image message */}
                      {msg.image && (
                        <img
                          src={msg.image}
                          alt="Photo"
                          className="chat-image rounded-xl mb-1 cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            const allMedia = activeMessages
                              .filter((m) => !m.deleted && (m.image || m.video))
                              .map((m) => m.image ? { type: 'image' as const, url: m.image } : { type: 'video' as const, url: m.video! });
                            setMediaViewerItem({ type: 'image', url: msg.image!, allMedia });
                          }}
                        />
                      )}
                      {/* Video message */}
                      {msg.video && (
                        <div
                          className="relative cursor-pointer group"
                          onClick={(e) => {
                            e.stopPropagation();
                            const allMedia = activeMessages
                              .filter((m) => !m.deleted && (m.image || m.video))
                              .map((m) => m.image ? { type: 'image' as const, url: m.image } : { type: 'video' as const, url: m.video! });
                            setMediaViewerItem({ type: 'video', url: msg.video!, allMedia });
                          }}
                        >
                          <video
                            src={msg.video}
                            className="chat-video rounded-xl mb-1"
                            playsInline
                            muted
                            onClick={(e) => e.stopPropagation()}
                          />
                          <div className="absolute inset-0 rounded-xl flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity mb-1">
                            <div className="w-10 h-10 rounded-full bg-white/30 backdrop-blur-sm flex items-center justify-center">
                              <Play size={18} fill="white" className="text-white ml-0.5" />
                            </div>
                          </div>
                        </div>
                      )}
                      {/* Voice message */}
                      {msg.audio && (
                        <VoiceMessageBubble url={msg.audio} duration={msg.audioDuration} isSent={isSent} waveform={msg.waveform} />
                      )}
                      {/* Document message */}
                      {msg.documentUrl && (
                        <div className="chat-document mb-1" onClick={(e) => e.stopPropagation()}>
                          <FileText size={24} className="shrink-0" style={{ color: isSent ? 'rgba(255,255,255,0.7)' : 'var(--theme-primary)' }} />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium truncate">{msg.fileName || 'Document'}</div>
                            {msg.fileSize && <div className="text-[10px] opacity-60">{(msg.fileSize / 1024).toFixed(1)} KB</div>}
                          </div>
                          <a href={msg.documentUrl} download className="shrink-0" onClick={(e) => e.stopPropagation()}>
                            <Download size={16} style={{ color: isSent ? 'rgba(255,255,255,0.7)' : 'var(--theme-primary)' }} />
                          </a>
                        </div>
                      )}
                      {/* Text message */}
                      {msg.text && <span>{msg.text}</span>}
                      <div className={`flex items-center gap-1 mt-1 ${isSent ? 'justify-end' : ''}`}>
                        {/* Feature 12: Encryption indicator */}
                        {encryptionEnabled && <Lock size={10} className="opacity-40" />}
                        <span className="text-[10px] opacity-60">{formatTime(msg.time)}</span>
                        {isSent && statusIcon(msg.status)}
                      </div>
                    </div>

                    {/* Star indicator */}
                    {msg.starred && (
                      <div className="flex justify-end mt-0.5">
                        <Star size={12} fill="var(--theme-accent)" style={{ color: 'var(--theme-accent)' }} />
                      </div>
                    )}

                    {/* Reactions */}
                    {msg.reactions && msg.reactions.length > 0 && (
                      <div className="flex gap-0.5 mt-0.5 flex-wrap">
                        {msg.reactions.map((r, i) => (
                          <span key={i} className="text-sm bg-white/80 rounded-full px-1.5 py-0.5 shadow-sm">{r}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            </div>
          );
        })}
        <div ref={chatEndRef} />
      </div>

      {/* Scroll to bottom FAB */}
      <AnimatePresence>
        {showScrollBtn && (
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            whileTap={{ scale: 0.9 }}
            onClick={scrollToBottom}
            className="absolute right-4 bottom-24 w-10 h-10 rounded-full shadow-lg flex items-center justify-center z-10"
            style={{ backgroundColor: 'var(--theme-surface)', color: 'var(--theme-primary)' }}
          >
            <ArrowDown size={18} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* ─── Reply Preview Bar ──────────────────────────── */}
      <AnimatePresence>
        {replyingTo && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-4 py-2 flex items-center gap-2 shrink-0"
            style={{ backgroundColor: 'var(--theme-surface-container)', borderLeft: `3px solid var(--theme-primary)` }}
          >
            <Reply size={14} style={{ color: 'var(--theme-primary)' }} />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold" style={{ color: 'var(--theme-primary)' }}>
                {replyingTo.senderId === identity ? myName : partnerName}
              </div>
              <div className="text-xs truncate" style={{ color: 'var(--theme-text-sub)' }}>
                {replyingTo.text || (replyingTo.audio ? '🎤 Voice message' : '📎 Media')}
              </div>
            </div>
            <button onClick={() => setReplyingTo(null)}>
              <X size={16} style={{ color: 'var(--theme-text-sub)' }} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Emoji Picker ───────────────────────────────── */}
      <AnimatePresence>
        {showEmoji && !isRecording && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 200 }}
            exit={{ height: 0 }}
            className="overflow-hidden shrink-0"
            style={{ backgroundColor: 'var(--theme-surface-container)' }}
          >
            <div className="grid grid-cols-8 gap-2 p-3 overflow-y-auto max-h-48">
              {['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','😊','😇','🥰','😍','🤩','😘','😗','😚','😙','🥲','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🫢','🤫','🤔','🫡','🤐','🤨','😐','😑','😶','🫥','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🥵','🥶','🥴','😵','🤯','🤠','🥳','🥸','😎','🤓','🧐','😕','🫤','😟','🙁','😮','😯','😲','😳','🥺','🥹','😦','😧','😨','😰','😥','😢','😭','😱','😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬','😈','👿','💀','☠️','💩','🤡','👹','👺','👻','👽','👾','🤖','😺','😸','😹','😻','😼','😽','🙀','😿','😾','💋','❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❤️‍🔥','💕','💞','💓','💗','💖','💘','💝','⭐','🌟','✨','💫','🔥','🌸','🌺','🌹','🥀','💐','🍄','🌙','☀️','🌈','🦋','🐱','🐶','🐰','🐻','🦊','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🐔','🐧','🐦','🦄','🐝','🐛','🐌','🐞','🐜','🪲'].map((emoji) => (
                <button
                  key={emoji}
                  className="text-2xl p-1 rounded-lg hover:bg-black/5 active:scale-90 transition-transform"
                  onClick={() => { setInput((prev) => prev + emoji); }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Input Bar / Voice Recording Bar ────────────── */}
      {!isSelectionMode && (
        <div className="shrink-0 px-3 py-2 safe-bottom" style={{ backgroundColor: 'var(--theme-surface)' }}>
          <AnimatePresence mode="wait">
            {isRecording ? (
              /* ─── Voice Recording UI ───────────────────── */
              <motion.div
                key="recording-bar"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="flex items-center gap-3"
              >
                {/* Cancel button */}
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={cancelVoiceRecording}
                  className="p-2.5 rounded-full shrink-0"
                  style={{ color: '#EF4444' }}
                >
                  <X size={22} />
                </motion.button>

                {/* Waveform + Timer */}
                <div className="flex-1 flex flex-col gap-1.5">
                  {/* Live waveform */}
                  <div className="flex items-end gap-[2px] h-8 px-1">
                    {recordingWaveform.length > 0 ? (
                      recordingWaveform.map((h, i) => (
                        <motion.div
                          key={i}
                          className="w-[3px] rounded-full"
                          style={{ backgroundColor: '#EF4444' }}
                          initial={{ height: 4 }}
                          animate={{ height: Math.max(4, h * 32) }}
                          transition={{ duration: 0.1 }}
                        />
                      ))
                    ) : (
                      // Static bars when just starting
                      Array.from({ length: 20 }).map((_, i) => (
                        <div
                          key={i}
                          className="w-[3px] rounded-full bg-red-300"
                          style={{ height: 4 + Math.random() * 12 }}
                        />
                      ))
                    )}
                  </div>
                  {/* Timer + indicator */}
                  <div className="flex items-center gap-2">
                    <motion.div
                      animate={{ opacity: [1, 0.3, 1] }}
                      transition={{ duration: 1, repeat: Infinity }}
                      className="w-2 h-2 rounded-full bg-red-500"
                    />
                    <span className="text-sm font-mono font-semibold" style={{ color: '#EF4444' }}>
                      {formatRecTime(recordingTime)}
                    </span>
                    <span className="text-xs opacity-50">Recording...</span>
                  </div>
                </div>

                {/* Send button */}
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => stopVoiceRecording(true)}
                  className="p-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-on-primary)' }}
                >
                  <Send size={18} />
                </motion.button>
              </motion.div>
            ) : (
              /* ─── Normal Input Bar ────────────────────── */
              <motion.div
                key="input-bar"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="flex items-end gap-2"
              >
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setShowAttach(!showAttach)}
                  className="p-2.5 rounded-full shrink-0"
                  style={{ color: 'var(--theme-primary)' }}
                >
                  <Paperclip size={20} />
                </motion.button>

                <div
                  className="flex-1 rounded-3xl px-4 py-2.5 text-sm flex items-center"
                  style={{ backgroundColor: 'var(--theme-surface-container)', color: 'var(--theme-text-main)', minHeight: 44 }}
                >
                  <input
                    value={input}
                    onChange={(e) => handleInputChange(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                    placeholder="Type a message..."
                    className="flex-1 bg-transparent outline-none text-sm"
                    style={{ color: 'var(--theme-text-main)' }}
                  />
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setShowEmoji(!showEmoji)}
                    className="ml-2 shrink-0"
                    style={{ color: 'var(--theme-text-sub)' }}
                  >
                    <Smile size={20} />
                  </motion.button>
                </div>

                {input.trim() ? (
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={sendMessage}
                    className="p-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-on-primary)' }}
                  >
                    <Send size={18} />
                  </motion.button>
                ) : (
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={startVoiceRecording}
                    className="p-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-on-primary)' }}
                  >
                    <Mic size={18} />
                  </motion.button>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Attach menu */}
          <AnimatePresence>
            {showAttach && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="flex gap-3 pt-2 pb-1">
                  <ActionButton icon={Camera} label="Photo" color="var(--theme-primary)" onClick={() => { setShowAttach(false); cameraInputRef.current?.click(); }} />
                  <ActionButton icon={ImageIcon} label="Gallery" color="#9B59B6" onClick={() => { setShowAttach(false); galleryInputRef.current?.click(); }} />
                  <ActionButton icon={Video} label="Video" color="#E67E22" onClick={() => { setShowAttach(false); galleryInputRef.current?.click(); }} />
                  <ActionButton icon={FileText} label="File" color="#3498DB" onClick={() => { setShowAttach(false); documentInputRef.current?.click(); }} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Hidden file inputs for media upload */}
          <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f, 'image'); e.target.value = ''; }} />
          <input ref={galleryInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f, f.type.startsWith('video') ? 'video' : 'image'); e.target.value = ''; }} />
          <input ref={audioInputRef} type="file" accept="audio/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f, 'audio'); e.target.value = ''; }} />
          <input ref={documentInputRef} type="file" accept="*/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f, 'document'); e.target.value = ''; }} />
          <input ref={wallpaperInputRef} type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; e.target.value = ''; try { const formData = new FormData(); formData.append('file', f); const res = await fetch('/api/upload', { method: 'POST', body: formData }); if (res.ok) { const data = await res.json(); setChatWallpaper(data.url || data.fileUrl || data.path); } } catch (err) { console.error('Wallpaper upload failed:', err); } }} />

          {/* Upload indicator with progress */}
          {uploading && (
            <div className="pt-1 pb-1 space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--theme-primary)', borderTopColor: 'transparent' }} />
                <span className="text-xs" style={{ color: 'var(--theme-text-sub)' }}>
                  Uploading{uploadFileName ? ` ${uploadFileName}` : ''}... {uploadProgress}%
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--theme-surface-container)' }}>
                <motion.div
                  className="h-full rounded-full"
                  style={{ backgroundColor: 'var(--theme-primary)' }}
                  initial={{ width: '0%' }}
                  animate={{ width: `${uploadProgress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Reaction Picker ────────────────────────────── */}
      <AnimatePresence>
        {showReactions !== null && (
          <motion.div
            className="fixed inset-0 z-50"
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={() => setShowReactions(null)}
          >
            <motion.div className="absolute inset-0 bg-black/20" variants={fadeVariants} />
            <motion.div
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex gap-2 rounded-full px-4 py-2.5 shadow-xl"
              style={{ backgroundColor: 'var(--theme-surface)' }}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
            >
              {reactionEmojis.map((emoji) => (
                <motion.button
                  key={emoji}
                  whileTap={{ scale: 0.8 }}
                  className="text-2xl p-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    addReaction(showReactions, emoji);
                    socketIO.emitReaction(String(showReactions), emoji);
                    setShowReactions(null);
                  }}
                >
                  {emoji}
                </motion.button>
              ))}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Starred Messages Modal ─────────────────────── */}
      <Modal open={showStarred} onClose={() => setShowStarred(false)} title="Starred Messages">
        <div className="p-4">
          {messages.filter((m) => m.starred && !m.deleted).length === 0 ? (
            <div className="text-center py-8">
              <Star size={32} className="mx-auto mb-2 opacity-30" style={{ color: 'var(--theme-text-sub)' }} />
              <p className="text-sm" style={{ color: 'var(--theme-text-sub)' }}>No starred messages yet</p>
              <p className="text-xs mt-1" style={{ color: 'var(--theme-text-sub)' }}>Long-press a message and tap ⭐ to star it</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {messages.filter((m) => m.starred && !m.deleted).map((msg) => (
                <div
                  key={msg.id}
                  className="rounded-2xl px-3.5 py-2.5 text-sm"
                  style={{
                    backgroundColor: msg.type === 'sent' ? 'var(--theme-primary)' : 'var(--theme-surface)',
                    color: msg.type === 'sent' ? 'var(--theme-on-primary)' : 'var(--theme-on-surface)',
                  }}
                >
                  {msg.text && <span>{msg.text}</span>}
                  <div className="flex items-center gap-1 mt-1 justify-end">
                    <span className="text-[10px] opacity-60">{formatTime(msg.time)}</span>
                    <Star size={10} fill="currentColor" className="opacity-60" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* ─── Search in Chat Modal ───────────────────────── */}
      <Modal open={showSearch} onClose={() => setShowSearch(false)} title="Search in Chat">
        <div className="p-4">
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search messages..."
            className="w-full p-3 rounded-2xl border text-sm mb-3"
            style={{ borderColor: 'var(--theme-primary-container)', color: 'var(--theme-text-main)', backgroundColor: 'var(--theme-surface-container)' }}
            autoFocus
          />
          {searchQuery.trim() ? (
            <>
              {(() => {
                const results = activeMessages.filter((m) => m.text?.toLowerCase().includes(searchQuery.toLowerCase()));
                return (
                  <>
                    <div className="text-xs mb-2 font-medium" style={{ color: 'var(--theme-text-sub)' }}>
                      {results.length} result{results.length !== 1 ? 's' : ''} found
                    </div>
                    <div className="space-y-2 max-h-72 overflow-y-auto">
                      {results.map((msg) => {
                        // Highlight matching text
                        const highlightText = (text: string) => {
                          if (!searchQuery.trim()) return text;
                          const escaped = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                          const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
                          return parts.map((part, i) => {
                            const isMatch = part.toLowerCase() === searchQuery.toLowerCase();
                            return isMatch ? (
                              <mark key={i} className="rounded px-0.5" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-on-primary)' }}>{part}</mark>
                            ) : (
                              <span key={i}>{part}</span>
                            );
                          });
                        };
                        return (
                          <div
                            key={msg.id}
                            className="rounded-2xl px-3.5 py-2.5 text-sm"
                            style={{
                              backgroundColor: msg.type === 'sent' ? 'var(--theme-primary)' : 'var(--theme-surface)',
                              color: msg.type === 'sent' ? 'var(--theme-on-primary)' : 'var(--theme-on-surface)',
                            }}
                          >
                            {msg.text && <span>{highlightText(msg.text)}</span>}
                            <div className="text-[10px] opacity-60 mt-1">{formatTime(msg.time)}</div>
                          </div>
                        );
                      })}
                      {results.length === 0 && (
                        <p className="text-center text-sm py-4" style={{ color: 'var(--theme-text-sub)' }}>No messages found</p>
                      )}
                    </div>
                  </>
                );
              })()}
            </>
          ) : (
            <p className="text-center text-sm py-4" style={{ color: 'var(--theme-text-sub)' }}>Type to search messages</p>
          )}
        </div>
      </Modal>

      {/* ─── Advanced Media Player ────────────────────────── */}
      <AnimatePresence>
        {mediaViewerItem && (
          <MediaPlayer
            item={mediaViewerItem}
            onClose={() => setMediaViewerItem(null)}
          />
        )}
      </AnimatePresence>

      {/* ─── Connection Status Indicator ─────────────────── */}
      {!wsConnected && (
        <div className="fixed top-0 left-0 right-0 z-50 py-1 text-center text-[10px] font-medium text-white" style={{ backgroundColor: '#F59E0B' }}>
          Connecting to partner...
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   MEMORIES SCREEN
   ═══════════════════════════════════════════════════════ */
function MemoriesScreen() {
  const identity = useAppStore((s) => s.identity);
  const batmanName = useAppStore((s) => s.batmanName);
  const princessName = useAppStore((s) => s.princessName);
  const memoryEntries = useAppStore((s) => s.memoryEntries);
  const setMemoryEntries = useAppStore((s) => s.setMemoryEntries);
  const addMemoryEntry = useAppStore((s) => s.addMemoryEntry);
  const vaultId = useAppStore((s) => s.vaultId);
  const letters = useAppStore((s) => s.letters);
  const setLetters = useAppStore((s) => s.setLetters);
  const encryptionEnabled = useAppStore((s) => s.encryptionEnabled);
  const encryptionKey = useAppStore((s) => s.encryptionKey);
  const events = useAppStore((s) => s.events);
  const setEvents = useAppStore((s) => s.setEvents);
  const [showAdd, setShowAdd] = useState(false);
  const [viewMemory, setViewMemory] = useState<string | null>(null);
  const [newText, setNewText] = useState('');
  const [newCategory, setNewCategory] = useState<'General' | 'Joke' | 'Favorite' | 'Date' | 'Important'>('General');
  const [newReminder, setNewReminder] = useState<'none' | '1M' | '1Y'>('none');
  const [newRevealDate, setNewRevealDate] = useState('');

  const addMemory = () => {
    if (!newText.trim()) return;
    addMemoryEntry({
      id: `mem-${Date.now()}`,
      content: newText,
      timestamp: new Date().toISOString(),
      category: newCategory,
      reminder: newReminder,
      revealDate: newRevealDate || undefined,
    });
    setNewText('');
    setNewCategory('General');
    setNewReminder('none');
    setNewRevealDate('');
    setShowAdd(false);
  };

  const viewingMemory = memoryEntries.find((m) => m.id === viewMemory);

  return (
    <div className="px-4 pb-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold" style={{ color: 'var(--theme-text-main)' }}>Memories</h2>
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => setShowAdd(true)}
          className="w-10 h-10 rounded-full flex items-center justify-center shadow-md"
          style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-on-primary)' }}
        >
          <Plus size={20} />
        </motion.button>
      </div>

      {memoryEntries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <ImageIcon size={48} style={{ color: 'var(--theme-text-sub)' }} className="opacity-40 mb-4" />
          <p className="text-sm" style={{ color: 'var(--theme-text-sub)' }}>No memories yet</p>
          <p className="text-xs mt-1" style={{ color: 'var(--theme-text-sub)' }}>Start capturing your special moments!</p>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowAdd(true)}
            className="mt-4 px-5 py-2.5 rounded-full text-sm font-semibold text-white"
            style={{ backgroundColor: 'var(--theme-primary)' }}
          >
            Add First Memory
          </motion.button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {memoryEntries.map((mem, i) => (
            <motion.div
              key={mem.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setViewMemory(mem.id)}
              className="rounded-3xl overflow-hidden shadow-sm cursor-pointer"
              style={{ backgroundColor: 'var(--theme-surface)' }}
            >
              <div
                className="aspect-square relative"
                style={{ background: getGradient(mem.id + mem.content) }}
              >
                <div className="absolute inset-0 flex items-end p-3" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.6), transparent)' }}>
                  <div className="text-white">
                    <p className="text-xs font-medium line-clamp-2">{mem.content}</p>
                    <p className="text-[10px] opacity-70 mt-1">{formatDate(mem.timestamp)}</p>
                  </div>
                </div>
                {mem.category && (
                  <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/90" style={{ color: 'var(--theme-primary)' }}>
                    {mem.category}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Add Memory Modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="New Memory">
        <div className="p-4 space-y-4">
          {/* Photo upload area */}
          <div
            className="aspect-video rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer"
            style={{ backgroundColor: 'var(--theme-surface-container)', border: `2px dashed var(--theme-primary-container)` }}
          >
            <Camera size={32} style={{ color: 'var(--theme-text-sub)' }} />
            <span className="text-xs" style={{ color: 'var(--theme-text-sub)' }}>Tap to add a photo</span>
          </div>

          <textarea
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder="What makes this memory special?"
            className="w-full p-3 rounded-2xl border text-sm resize-none h-24"
            style={{ borderColor: 'var(--theme-primary-container)', color: 'var(--theme-text-main)', backgroundColor: 'var(--theme-surface-container)' }}
          />

          <div>
            <label className="text-xs font-medium mb-2 block" style={{ color: 'var(--theme-text-sub)' }}>Category</label>
            <div className="flex gap-2 flex-wrap">
              {(['General', 'Joke', 'Favorite', 'Date', 'Important'] as const).map((cat) => (
                <motion.button
                  key={cat}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setNewCategory(cat)}
                  className="px-3 py-1.5 rounded-full text-xs font-medium"
                  style={{
                    backgroundColor: newCategory === cat ? 'var(--theme-primary)' : 'var(--theme-surface-container)',
                    color: newCategory === cat ? 'var(--theme-on-primary)' : 'var(--theme-text-sub)',
                  }}
                >
                  {cat}
                </motion.button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium mb-2 block" style={{ color: 'var(--theme-text-sub)' }}>Reminder</label>
            <div className="flex gap-2">
              {(['none', '1M', '1Y'] as const).map((r) => (
                <motion.button
                  key={r}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setNewReminder(r)}
                  className="px-3 py-1.5 rounded-full text-xs font-medium"
                  style={{
                    backgroundColor: newReminder === r ? 'var(--theme-primary)' : 'var(--theme-surface-container)',
                    color: newReminder === r ? 'var(--theme-on-primary)' : 'var(--theme-text-sub)',
                  }}
                >
                  {r === 'none' ? 'None' : r === '1M' ? '1 Month' : '1 Year'}
                </motion.button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium mb-2 block" style={{ color: 'var(--theme-text-sub)' }}>Reveal Date (Time Capsule)</label>
            <input
              type="date"
              value={newRevealDate}
              onChange={(e) => setNewRevealDate(e.target.value)}
              className="w-full p-3 rounded-2xl border text-sm"
              style={{ borderColor: 'var(--theme-primary-container)', color: 'var(--theme-text-main)', backgroundColor: 'var(--theme-surface-container)' }}
            />
          </div>

          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={addMemory}
            className="w-full py-3 rounded-2xl font-semibold text-white"
            style={{ backgroundColor: 'var(--theme-primary)' }}
          >
            Save Memory
          </motion.button>
        </div>
      </Modal>

      {/* Photo Viewer Modal */}
      <Modal open={!!viewMemory} onClose={() => setViewMemory(null)} title="Memory" fullHeight>
        {viewingMemory && (
          <div className="p-4 space-y-4">
            <div
              className="aspect-video rounded-2xl"
              style={{ background: getGradient(viewingMemory.id + viewingMemory.content) }}
            />
            <div>
              <p className="text-sm" style={{ color: 'var(--theme-text-main)' }}>{viewingMemory.content}</p>
              <p className="text-xs mt-2" style={{ color: 'var(--theme-text-sub)' }}>{formatDate(viewingMemory.timestamp)}</p>
              {viewingMemory.category && (
                <span className="inline-block mt-2 px-2 py-0.5 rounded-full text-xs" style={{ backgroundColor: 'var(--theme-primary-container)', color: 'var(--theme-on-primary-container)' }}>
                  {viewingMemory.category}
                </span>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   SANCTUARY SCREEN
   ═══════════════════════════════════════════════════════ */
function SanctuaryScreen() {
  const sanctuarySubTab = useAppStore((s) => s.sanctuarySubTab);
  const setSanctuarySubTab = useAppStore((s) => s.setSanctuarySubTab);
  const subTabs: { key: SanctuarySubTab; label: string; icon: React.ElementType }[] = [
    { key: 'ai', label: 'AI', icon: Sparkles },
    { key: 'dark', label: 'Dark', icon: Moon },
    { key: 'plan', label: 'Plan', icon: Calendar },
    { key: 'vault', label: 'Vault', icon: Lock },
    { key: 'memory', label: 'Memory', icon: Brain },
    { key: 'game', label: 'Game', icon: Gamepad2 },
  ];

  return (
    <div className="px-4 pb-4">
      <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--theme-text-main)' }}>Sanctuary</h2>

      {/* Sub-tab bar */}
      <div className="flex gap-1 mb-4 p-1 rounded-2xl" style={{ backgroundColor: 'var(--theme-surface-container)' }}>
        {subTabs.map(({ key, label, icon: Icon }) => (
          <motion.button
            key={key}
            whileTap={{ scale: 0.95 }}
            onClick={() => setSanctuarySubTab(key)}
            className="flex-1 flex flex-col items-center gap-0.5 py-2 rounded-xl text-xs font-medium transition-colors"
            style={{
              backgroundColor: sanctuarySubTab === key ? 'var(--theme-surface)' : 'transparent',
              color: sanctuarySubTab === key ? 'var(--theme-primary)' : 'var(--theme-text-sub)',
              boxShadow: sanctuarySubTab === key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            <Icon size={16} />
            {label}
          </motion.button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {sanctuarySubTab === 'ai' && <AITab key="ai" />}
        {sanctuarySubTab === 'dark' && <DarkTab key="dark" />}
        {sanctuarySubTab === 'plan' && <PlanTab key="plan" />}
        {sanctuarySubTab === 'vault' && <VaultTab key="vault" />}
        {sanctuarySubTab === 'memory' && <MemoryTab key="memory" />}
        {sanctuarySubTab === 'game' && <GameTab key="game" />}
      </AnimatePresence>
    </div>
  );
}

/* AI Tab */
function AITab() {
  const identity = useAppStore((s) => s.identity);
  const sanctuaryChat = useAppStore((s) => s.sanctuaryChat);
  const addSanctuaryChatMessage = useAppStore((s) => s.addSanctuaryChatMessage);
  const aiMemory = useAppStore((s) => s.aiMemory);
  const [chatInput, setChatInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const suggestions = [
    { icon: Flame, title: 'Spice Things Up', desc: 'Steamy ideas to drive each other wild' },
    { icon: Heart, title: 'Dirty Truth or Dare', desc: 'Naughty questions & daring challenges' },
    { icon: Sparkles, title: 'Roleplay Scenarios', desc: 'Fantasy scenes for you two to act out' },
    { icon: Star, title: 'Seduction Moves', desc: 'Tips to make them melt in your hands' },
  ];

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [sanctuaryChat.length]);

  const sendToAI = async () => {
    if (!chatInput.trim()) return;
    const userMsg = chatInput.trim();
    setChatInput('');
    const userName = identity === 'Batman' ? 'Obada' : 'Lilia';
    addSanctuaryChatMessage({ role: 'user', text: userMsg });
    setAiLoading(true);

    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `[${userName} says]: ${userMsg}`,
          history: sanctuaryChat.slice(-10).map(m => ({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.text })),
        }),
      });
      const data = await res.json();
      addSanctuaryChatMessage({ role: 'ai', text: data.reply || data.error || 'Something went wrong 💔' });
    } catch {
      addSanctuaryChatMessage({ role: 'ai', text: 'Mmm, I got distracted thinking about you two fucking... try again? 🔥💋' });
    }
    setAiLoading(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-4"
    >
      {/* Suggestion Cards */}
      <div className="space-y-2">
        {suggestions.map((s, i) => (
          <motion.div
            key={i}
            whileTap={{ scale: 0.98 }}
            className="rounded-2xl p-3 flex items-center gap-3"
            style={{ backgroundColor: 'var(--theme-surface)' }}
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--theme-primary-container)', color: 'var(--theme-on-primary-container)' }}>
              <s.icon size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold" style={{ color: 'var(--theme-text-main)' }}>{s.title}</div>
              <div className="text-xs" style={{ color: 'var(--theme-text-sub)' }}>{s.desc}</div>
            </div>
            <motion.button
              whileTap={{ scale: 0.9 }}
              className="px-3 py-1.5 rounded-full text-xs font-semibold"
              style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-on-primary)' }}
              onClick={() => {
                addSanctuaryChatMessage({ role: 'user', text: `Suggest: ${s.title}` });
                addSanctuaryChatMessage({ role: 'ai', text: `Oh, you want ${s.title.toLowerCase()}? I love where your head's at, Obada & Lilia... 🔥 Let me whip up something that'll make you both blush and crave each other. Ask me for details, I dare you 😈💋` });
              }}
            >
              Choose
            </motion.button>
          </motion.div>
        ))}
      </div>

      {/* Chosen Interactions */}
      {aiMemory.chosenInteractions.length > 0 && (
        <SectionCard>
          <div className="text-xs font-medium mb-2" style={{ color: 'var(--theme-text-sub)' }}>Chosen Interactions</div>
          <div className="flex flex-wrap gap-1.5">
            {aiMemory.chosenInteractions.map((ci, i) => (
              <span key={i} className="px-2 py-1 rounded-full text-xs" style={{ backgroundColor: 'var(--theme-primary-container)', color: 'var(--theme-on-primary-container)' }}>
                {ci}
              </span>
            ))}
          </div>
        </SectionCard>
      )}

      {/* AI Chat */}
      <SectionCard>
        <div className="text-xs font-medium mb-3" style={{ color: 'var(--theme-text-sub)' }}>Chat with Obli 🔥</div>
        <div className="max-h-64 overflow-y-auto space-y-2 mb-3">
          {sanctuaryChat.length === 0 && (
            <p className="text-xs text-center py-4" style={{ color: 'var(--theme-text-sub)' }}>Hey Obada & Lilia... Obli's wet & ready to make you horny 💋🔥</p>
          )}
          {sanctuaryChat.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className="max-w-[80%] rounded-2xl px-3 py-2 text-xs"
                style={{
                  backgroundColor: msg.role === 'user' ? 'var(--theme-primary)' : 'var(--theme-surface-container)',
                  color: msg.role === 'user' ? 'var(--theme-on-primary)' : 'var(--theme-on-surface)',
                }}
              >
                {msg.text}
              </div>
            </div>
          ))}
          {aiLoading && (
            <div className="flex justify-start">
              <div className="rounded-2xl px-4 py-2" style={{ backgroundColor: 'var(--theme-surface-container)' }}>
                <div className="flex gap-1">
                  <span className="typing-dot-1 w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--theme-text-sub)' }} />
                  <span className="typing-dot-2 w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--theme-text-sub)' }} />
                  <span className="typing-dot-3 w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--theme-text-sub)' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>
        <div className="flex gap-2">
          <input
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendToAI()}
            placeholder="Ask Obli anything..."
            className="flex-1 px-3 py-2 rounded-full text-sm border"
            style={{ borderColor: 'var(--theme-primary-container)', color: 'var(--theme-text-main)', backgroundColor: 'var(--theme-surface-container)' }}
          />
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={sendToAI}
            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
            style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-on-primary)' }}
          >
            <Send size={16} />
          </motion.button>
        </div>
      </SectionCard>
    </motion.div>
  );
}

/* Dark Tab */
function DarkTab() {
  const [activeGame, setActiveGame] = useState<string | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [shuffledOrder, setShuffledOrder] = useState<number[]>([]);
  const [playerAnswer, setPlayerAnswer] = useState<string | null>(null);
  const [partnerAnswer, setPartnerAnswer] = useState<string | null>(null);
  const [showMatch, setShowMatch] = useState(false);
  const [diceRolling, setDiceRolling] = useState(false);
  const [diceResult, setDiceResult] = useState<string | null>(null);

  const games = [
    { id: 'compromise', title: 'Wet & Wild Compromise', desc: 'How dirty are you both? 💦', icon: Wine, color: '#E84393', bg: 'linear-gradient(135deg, #E84393 0%, #FD79A8 100%)' },
    { id: 'taboo', title: 'Filthy Truth or Dare', desc: 'Say it. Do it. No limits. 🔥', icon: Flame, color: '#FF6B6B', bg: 'linear-gradient(135deg, #FF6B6B 0%, #EE5A24 100%)' },
    { id: 'dice', title: 'Pleasure Dice', desc: 'Roll for that pussy/dick 🎲', icon: Dice1, color: '#A29BFE', bg: 'linear-gradient(135deg, #A29BFE 0%, #6C5CE7 100%)' },
    { id: 'touch', title: 'Lick & Touch', desc: 'Tongue, hands, everywhere 😈', icon: Heart, color: '#FF9FF3', bg: 'linear-gradient(135deg, #FF9FF3 0%, #F368E0 100%)' },
    { id: 'strip', title: 'Strip Roulette', desc: 'One piece at a time... 🫣', icon: Zap, color: '#FDCB6E', bg: 'linear-gradient(135deg, #FDCB6E 0%, #E17055 100%)' },
    { id: 'position', title: 'Fuck Position', desc: 'Try it right now 🍆', icon: Flame, color: '#00B894', bg: 'linear-gradient(135deg, #00B894 0%, #55E6C1 100%)' },
  ];

  const questions = {
    compromise: [
      { q: 'Lick or suck? Choose wisely 👅', a: ['Lick it slow 🤤', 'Suck it deep 👄'] },
      { q: 'Where do you want Obada\'s dick right now?', a: ['In my mouth 🤤', 'Inside me deep 🍆'] },
      { q: 'Lilia\'s boobs or Lilia\'s ass?', a: ['Boobs in my face 🍒', 'Ass in my hands 🍑'] },
      { q: 'Spank or scratch?', a: ['Spank that ass 🖐️', 'Scratch my back 😈'] },
      { q: 'Who rides tonight?', a: ['Lilia on top 💃', 'Obada takes control 💪'] },
      { q: 'Spit or swallow?', a: ['Swallow every drop 🤤', 'Let it drip 😏'] },
      { q: 'Quickie or marathon?', a: ['Bend me over now 🔥', 'All night long 💦'] },
      { q: 'Where\'s the wildest place you\'d fuck?', a: ['Kitchen counter 🍳', 'Against the wall 🧱'] },
      { q: 'Tease or please?', a: ['Tease me till I beg 🫦', 'Please me right now 😩'] },
      { q: 'Lights on or off?', a: ['On, I wanna see everything 👀', 'Off, just feel it 🌙'] },
      { q: 'Gentle touch or rough grab?', a: ['Soft fingertips 🪶', 'Grab me hard 🤛'] },
      { q: 'Slow grind or fast bounce?', a: ['Slow & sensual 🐢', 'Fast & wild 🐇'] },
      { q: 'Handcuffs or silk ties?', a: ['Metal restraint 🔗', 'Silky soft 🎀'] },
      { q: 'Whisper or moan?', a: ['Dirty whisper in ear 🫦', 'Loud moaning 🗣️'] },
      { q: 'Foreplay for how long?', a: ['Just get to it 🔥', 'Tease for 20 minutes 🫦'] },
    ],
    taboo: [
      { q: 'Truth: Describe how Lilia\'s pussy tastes', a: ['Sweet like candy 🍬', 'I\'m addicted 🤤'] },
      { q: 'Dare: Lick Lilia from neck to pussy right now', a: ['Slowly tongue down 👅', 'Skip straight to pussy 🤤'] },
      { q: 'Truth: How big does Obada feel inside you?', a: ['Fills me up completely 🍆', 'Hits the right spot 😩'] },
      { q: 'Dare: Suck Obada\'s dick for 30 seconds', a: ['On my knees now 👄', 'Deep throat it 🤤'] },
      { q: 'Truth: What\'s the filthiest thing you wanna do to each other?', a: ['Eat that pussy till she cums 👅', 'Fuck till we can\'t walk 🔥'] },
      { q: 'Dare: Spank Lilia\'s ass 5 times hard', a: ['Make it red 🖐️', 'Make it sting 😈'] },
      { q: 'Truth: Where do you want Obada to cum?', a: ['Inside me deep 💦', 'All over my boobs 🍒'] },
      { q: 'Dare: Suck Lilia\'s nipples for 20 seconds', a: ['Gentle & slow 👅', 'Bite them hard 😈'] },
      { q: 'Truth: What\'s your secret fantasy with us?', a: ['Threesome vibes 👥', 'Public place thrill 🌍'] },
      { q: 'Dare: Give Obada a lap dance right now', a: ['Slow & sexy 💃', 'Grind hard 🍑'] },
      { q: 'Truth: What position makes you cum hardest?', a: ['Deep from behind 🍑', 'Riding on top 💦'] },
      { q: 'Dare: Talk dirty to each other for 60 seconds', a: ['Filthy as possible 🗣️', 'Whisper it seductively 🫦'] },
      { q: 'Dare: Leave a hickey on their inner thigh', a: ['Suck hard 💋', 'Gentle & slow 🫦'] },
      { q: 'Truth: What makes you cum fastest?', a: ['Deep penetration 🍆', 'Clit stimulation 👅'] },
      { q: 'Dare: Use an ice cube on their body for 30 seconds', a: ['Trail down slowly 🧊', 'Hold on their most sensitive spot 🥶'] },
    ],
    dice: [
      { q: 'Spank that ass!', a: ['Light & teasing 🖐️', 'Hard & loud 😈'] },
      { q: 'Lick something now', a: ['Lick the clit 👅', 'Lick the dick 🤤'] },
      { q: 'Touch yourself while they watch', a: ['Finger that pussy 🤤', 'Stroke that dick 🍆'] },
      { q: 'Suck on something', a: ['Suck those nipples 👄', 'Suck that dick deep 🤤'] },
      { q: 'Bite them somewhere sensitive', a: ['Inner thigh 😈', 'Neck hard 💋'] },
      { q: 'Make them wet/hard in 15 seconds', a: ['Use your tongue 👅', 'Use your hands 🤲'] },
      { q: 'Blindfold them and...', a: ['Tease everywhere 🫦', 'Go straight for it 😈'] },
      { q: 'Whisper something dirty in their ear', a: ['Tell them what you want 🗣️', 'Just moan softly 😩'] },
      { q: 'Ice cube on their body', a: ['Trail down slowly 🧊', 'Hold on the nipples 🥶'] },
      { q: 'Massage with oil, then...', a: ['Slide into them 💦', 'Flip them over 😈'] },
      { q: 'Role play — who\'s in charge?', a: ['I\'m the boss tonight 💪', 'You command me 😩'] },
      { q: 'Pull their hair while...', a: ['Kissing their neck 💋', 'Going deep 🍆'] },
    ],
    touch: [
      { q: 'Lick their inner thigh slowly for 20 seconds', a: ['Get close to the pussy 👅', 'Tease around it 😈'] },
      { q: 'Massage their boobs/chest with oil', a: ['Circular & slow 💆', 'Pinch the nipples 😈'] },
      { q: 'Run your tongue from ear to collarbone', a: ['Wet & sloppy 👅', 'Light & teasing 💋'] },
      { q: 'Grab their ass with both hands', a: ['Squeeze hard 🍑', 'Spread & spank 🖐️'] },
      { q: 'Kiss their stomach going down...', a: ['Stop at the waistline 😏', 'Don\'t stop till you hit it 👅'] },
      { q: 'Finger them slowly while kissing', a: ['One finger first 🤤', 'Two fingers deep 😩'] },
      { q: 'Blow on their most sensitive spot', a: ['Warm breath 💨', 'Cool air tease 🌬️'] },
      { q: 'Trace their body with your tongue', a: ['Slow circular motions 👅', 'Straight line down ⬇️'] },
      { q: 'Nibble their earlobe while...', a: ['Grinding on them 🍑', 'Touching below 🤤'] },
      { q: 'Wrap your legs around them and...', a: ['Pull them in deep 💦', 'Roll on top 💃'] },
      { q: 'Use a feather to trace their whole body', a: ['Slow & agonizing 🪶', 'Focus on sensitive spots only 😈'] },
      { q: 'Suck their fingers one by one', a: ['Seductive & slow 👄', 'Quick & teasing 😏'] },
    ],
    strip: [
      { q: 'Take off one piece of clothing', a: ['Top comes off 🫣', 'Pants first 👀'] },
      { q: 'Your partner removes something from you', a: ['Slowly unzip 😏', 'Rip it off 🔥'] },
      { q: 'Show them what\'s underneath for 10 seconds', a: ['Let them look 👀', 'Let them touch 🤲'] },
      { q: 'Turn around slowly... let them see everything', a: ['Arched back 🍑', 'Hands up 🍒'] },
      { q: 'Only underwear left... what now?', a: ['Slide them off 😈', 'Let them pull it with teeth 👄'] },
      { q: 'Naked now. Do whatever they say for 30 seconds', a: ['Yes master 😩', 'Make me 🔥'] },
      { q: 'Take off something using only your teeth', a: ['Their shirt collar 👄', 'Their belt buckle 😈'] },
      { q: 'Leave one thing on — your choice', a: ['Socks, obviously 😂', 'Something lacey 👙'] },
      { q: 'Strip while maintaining eye contact', a: ['Slow & confident 😏', 'Shy & blushing 😳'] },
      { q: 'They blindfold you, then undress you', a: ['Anticipation building 🫣', 'Trust completely 💕'] },
      { q: 'Strip to music — give a show', a: ['Slow & sensual 💃', 'Wild & reckless 🔥'] },
      { q: 'Your partner picks what comes off next', a: ['I trust their choice 😏', 'They pick the sexiest piece 👙'] },
    ],
    position: [
      { q: 'Lilia rides Obada facing him', a: ['Slow grinding 💦', 'Bounce hard 🍆'] },
      { q: 'Doggy style — how hard?', a: ['Deep & slow 🐕', 'Pound that ass 🔥'] },
      { q: 'Obada picks up Lilia against the wall', a: ['Legs wrapped tight 🧱', 'One leg up 💪'] },
      { q: '69 — who\'s on top?', a: ['Lilia on top sucking 👅', 'Lilia on bottom getting eaten 🤤'] },
      { q: 'Lilia bends over and...', a: ['Obada enters from behind 🍑', 'Obada licks from behind 👅'] },
      { q: 'Lazy spoon — deep & intimate', a: ['Slow & sensual 💕', 'Deep thrusts 💦'] },
      { q: 'Edge of the bed — legs up', a: ['Ankles on shoulders 🦵', 'Spread wide open 🦋'] },
      { q: 'Reverse cowgirl', a: ['Grind in circles 🔄', 'Bounce up & down 🏀'] },
      { q: 'Lotus position — face to face', a: ['Rocking together 🪷', 'Bouncing on it 💦'] },
      { q: 'Standing up — carried', a: ['Wrap around tight 🤗', 'Pinned against something 🧱'] },
      { q: 'On the edge of the table — legs spread', a: ['Slow entry 💦', 'Quick thrust in 🔥'] },
      { q: 'Missionary but intense — eyes locked', a: ['Whisper I love you 💕', 'Bite their lip 😈'] },
    ],
  };

  const desireDiceOptions = [
    'Lick 👅', 'Suck 👄', 'Spank 🖐️', 'Bite 😈', 'Finger 🤤', 'Kiss 💋',
    'Scratch 😏', 'Blow 💨', 'Nibble 🫦', 'Tease 🔥', 'Slap 🖐️', 'Tongue-fuck 👅',
    'Stroke 🤲', 'Pinch 😈', 'Massage 💆', 'Tickle 🪶', 'Pull 💪', 'Grind 🍑',
    'Moan in their ear 🗣️', 'Ice play 🧊', 'Feather touch 🪶', 'Kiss deeply 💋',
  ];
  const bodyParts = [
    'Pussy 🍑', 'Dick 🍆', 'Boobs 🍒', 'Ass 🍑', 'Nipples 👅', 'Neck 💋',
    'Inner thigh 😈', 'Clit 👅', 'Lips 💋', 'Lower back 🤤', 'Stomach 🔥', 'Ear 🫦',
    'Collarbone 💀', 'Hip bone 🦴', 'Behind the knee 🦵', 'Wrist 💋',
    'Small of back 🤤', 'Jawline 😏', 'Belly button 🫦', 'Lower lip 💋',
  ];

  const rollDesireDice = () => {
    setDiceRolling(true);
    setDiceResult(null);
    setTimeout(() => {
      const action = desireDiceOptions[Math.floor(Math.random() * desireDiceOptions.length)];
      const body = bodyParts[Math.floor(Math.random() * bodyParts.length)];
      setDiceResult(`${action} → ${body}`);
      setDiceRolling(false);
    }, 1200);
  };

  const game = games.find((g) => g.id === activeGame);
  // Shuffle questions each time a game starts for freshness
  const [shuffledQuestions, setShuffledQuestions] = useState<typeof questions.compromise | null>(null);
  const gameQuestions = activeGame ? (shuffledQuestions || questions[activeGame as keyof typeof questions]) : null;

  // Shuffle questions when a new game starts
  useEffect(() => {
    if (activeGame && activeGame !== 'dice') {
      const original = questions[activeGame as keyof typeof questions];
      const shuffled = [...original].sort(() => Math.random() - 0.5);
      queueMicrotask(() => setShuffledQuestions(shuffled));
    } else {
      queueMicrotask(() => setShuffledQuestions(null));
    }
    // Reset question index when switching games
    queueMicrotask(() => setCurrentQuestion(0));
  }, [activeGame]);

  const answerQuestion = (answer: string) => {
    setPlayerAnswer(answer);
    setTimeout(() => {
      setPartnerAnswer(gameQuestions![currentQuestion].a[Math.random() > 0.5 ? 0 : 1]);
      setShowMatch(true);
    }, 1000);
  };

  const nextQuestion = () => {
    setPlayerAnswer(null);
    setPartnerAnswer(null);
    setShowMatch(false);
    const maxQ = gameQuestions ? gameQuestions.length - 1 : 0;
    if (currentQuestion < maxQ) setCurrentQuestion((c) => c + 1);
    else { setActiveGame(null); setCurrentQuestion(0); }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-3"
    >
      {!activeGame ? (
        <div className="space-y-3">
          <div className="text-center mb-4">
            <motion.div
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              className="text-2xl font-black tracking-tight"
              style={{ color: 'var(--theme-primary)' }}
            >
              🔥 Play Dirty Tonight 🔥
            </motion.div>
            <div className="text-xs mt-1" style={{ color: 'var(--theme-text-sub)' }}>Obada & Lilia's pleasure zone</div>
          </div>
          {games.map((g, idx) => (
            <motion.button
              key={g.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.08 }}
              whileTap={{ scale: 0.96 }}
              whileHover={{ scale: 1.02 }}
              onClick={() => setActiveGame(g.id)}
              className="w-full rounded-2xl p-4 flex items-center gap-3 text-left shadow-lg relative overflow-hidden"
              style={{ background: g.bg, color: 'white' }}
            >
              <motion.div
                animate={{ rotate: [0, 5, -5, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: idx * 0.3 }}
                className="w-14 h-14 rounded-2xl flex items-center justify-center bg-white/20 backdrop-blur-sm"
              >
                <g.icon size={24} />
              </motion.div>
              <div className="flex-1">
                <div className="font-bold text-sm">{g.title}</div>
                <div className="text-xs opacity-80">{g.desc}</div>
              </div>
              <div className="text-xl">👉</div>
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
                style={{ animation: 'shimmer 2s infinite' }} />
            </motion.button>
          ))}
        </div>
      ) : activeGame === 'dice' && diceResult ? (
        /* Desire Dice result screen */
        <SectionCard>
          <div className="text-center space-y-5 py-4">
            <div className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--theme-primary)' }}>Pleasure Dice 🎲🔥</div>
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
              className="w-28 h-28 rounded-full mx-auto flex items-center justify-center text-2xl font-bold shadow-xl"
              style={{ background: 'linear-gradient(135deg, #A29BFE 0%, #6C5CE7 100%)', color: 'white' }}
            >
              {diceResult.split(' → ')[0]}
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-lg font-semibold"
              style={{ color: 'var(--theme-text-main)' }}
            >
              → {diceResult.split(' → ')[1]}
            </motion.div>
            <p className="text-xs" style={{ color: 'var(--theme-text-sub)' }}>No backing out now... do it you filthy couple 😈💦</p>
            <div className="flex gap-3 justify-center">
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => { setDiceResult(null); rollDesireDice(); }}
                className="px-5 py-2.5 rounded-full text-sm font-semibold text-white"
                style={{ background: 'linear-gradient(135deg, #A29BFE 0%, #6C5CE7 100%)' }}
              >
                Roll Again 🔥🎲
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => { setActiveGame(null); setDiceResult(null); setCurrentQuestion(0); }}
                className="px-5 py-2.5 rounded-full text-sm font-medium"
                style={{ backgroundColor: 'var(--theme-surface-container)', color: 'var(--theme-on-surface)' }}
              >
                Back
              </motion.button>
            </div>
          </div>
        </SectionCard>
      ) : activeGame === 'dice' ? (
        /* Desire Dice rolling screen */
        <SectionCard>
          <div className="text-center space-y-6 py-6">
            <div className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--theme-primary)' }}>Pleasure Dice 🎲🔥</div>
            <motion.div
              animate={diceRolling ? { rotate: [0, 360, 720], scale: [1, 1.3, 1] } : { scale: [1, 1.05, 1] }}
              transition={diceRolling ? { duration: 1.2, ease: 'easeInOut' } : { duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              className="w-28 h-28 rounded-2xl mx-auto flex items-center justify-center text-5xl shadow-xl cursor-pointer"
              style={{ background: 'linear-gradient(135deg, #A29BFE 0%, #6C5CE7 100%)' }}
              onClick={rollDesireDice}
            >
              🎲
            </motion.div>
            <div className="text-sm font-medium" style={{ color: 'var(--theme-text-main)' }}>
              {diceRolling ? 'Rolling for pleasure... 🔥💦' : 'Tap that dice, you horny couple'}
            </div>
            <p className="text-xs" style={{ color: 'var(--theme-text-sub)' }}>Fate decides whose pussy/dick gets it 😈</p>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={rollDesireDice}
              disabled={diceRolling}
              className="px-8 py-3 rounded-full text-sm font-bold text-white shadow-lg"
              style={{ background: 'linear-gradient(135deg, #A29BFE 0%, #6C5CE7 100%)' }}
            >
              {diceRolling ? 'Rolling...' : 'Roll for Pleasure 🔥'}
            </motion.button>
            <div>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => { setActiveGame(null); setCurrentQuestion(0); }}
                className="text-xs px-4 py-2 rounded-full"
                style={{ color: 'var(--theme-text-sub)' }}
              >
                ← Back
              </motion.button>
            </div>
          </div>
        </SectionCard>
      ) : (
        <SectionCard>
          <div className="text-center space-y-4 py-2">
            <div className="text-xs font-medium uppercase tracking-wider" style={{ color: game?.color }}>{game?.title} 🔥</div>
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              className="w-20 h-20 rounded-full mx-auto flex items-center justify-center shadow-xl"
              style={{ background: game?.bg, color: 'white' }}
            >
              {game && <game.icon size={32} />}
            </motion.div>

            <motion.div
              key={currentQuestion}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 200, damping: 20 }}
              className="text-lg font-semibold py-3 px-2"
              style={{ color: 'var(--theme-text-main)' }}
            >
              {gameQuestions?.[currentQuestion].q}
            </motion.div>

            <div className="text-xs font-medium mb-1" style={{ color: 'var(--theme-text-sub)' }}>
              {currentQuestion + 1} / {gameQuestions?.length}
            </div>

            {!showMatch ? (
              <div className="flex gap-3 justify-center">
                {gameQuestions?.[currentQuestion].a.map((opt) => (
                  <motion.button
                    key={opt}
                    whileTap={{ scale: 0.95 }}
                    whileHover={{ scale: 1.03 }}
                    onClick={() => answerQuestion(opt)}
                    className="px-5 py-3 rounded-2xl text-sm font-medium shadow-sm"
                    style={{
                      background: playerAnswer === opt ? game?.bg : 'var(--theme-surface-container)',
                      color: playerAnswer === opt ? 'white' : 'var(--theme-on-surface)',
                    }}
                  >
                    {opt}
                  </motion.button>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-center gap-5">
                  <motion.div
                    initial={{ x: -30, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    className="text-center"
                  >
                    <div className="text-xs mb-1.5 font-medium" style={{ color: 'var(--theme-primary)' }}>Obada</div>
                    <div className="px-4 py-2.5 rounded-xl text-sm font-medium shadow-sm" style={{ background: game?.bg, color: 'white' }}>
                      {playerAnswer}
                    </div>
                  </motion.div>
                  <motion.div
                    initial={{ x: 30, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    className="text-center"
                  >
                    <div className="text-xs mb-1.5 font-medium" style={{ color: 'var(--theme-primary)' }}>Lilia</div>
                    <div className="px-4 py-2.5 rounded-xl text-sm font-medium shadow-sm" style={{ backgroundColor: 'var(--theme-surface-container)', color: 'var(--theme-on-surface)' }}>
                      {partnerAnswer}
                    </div>
                  </motion.div>
                </div>
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                  className="text-2xl"
                >
                  {playerAnswer === partnerAnswer ? '💕 MATCH! You filthy pair 🔥' : '😈 Different kinks — even hotter!'}
                </motion.div>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={nextQuestion}
                  className="px-8 py-2.5 rounded-full text-sm font-semibold text-white shadow-lg"
                  style={{ background: game?.bg }}
                >
                  {currentQuestion < (gameQuestions ? gameQuestions.length - 1 : 0) ? 'Next 🔥😈' : 'Finish & Fuck 💋🔥'}
                </motion.button>
              </div>
            )}
          </div>
        </SectionCard>
      )}
    </motion.div>
  );
}

/* Plan Tab */
function PlanTab() {
  const events = useAppStore((s) => s.events);
  const setEvents = useAppStore((s) => s.setEvents);
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newType, setNewType] = useState<'Date' | 'Goal' | 'Anniversary'>('Date');

  const typeIcons: Record<string, React.ElementType> = { Date: Heart, Goal: Target, Anniversary: Gift };

  const addEvent = () => {
    if (!newTitle.trim() || !newDate) return;
    setEvents([
      ...events,
      { id: `evt-${Date.now()}`, title: newTitle, date: new Date(newDate).toISOString(), type: newType },
    ]);
    setNewTitle('');
    setNewDate('');
    setNewType('Date');
    setShowAdd(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-3"
    >
      <div className="flex justify-end">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => setShowAdd(true)}
          className="px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-1"
          style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-on-primary)' }}
        >
          <Plus size={16} /> Add Event
        </motion.button>
      </div>

      {events.length === 0 ? (
        <div className="text-center py-12">
          <Calendar size={40} className="mx-auto mb-3 opacity-30" style={{ color: 'var(--theme-text-sub)' }} />
          <p className="text-sm" style={{ color: 'var(--theme-text-sub)' }}>No events planned yet</p>
        </div>
      ) : (
        events.map((evt) => {
          const Icon = typeIcons[evt.type] || Heart;
          return (
            <motion.div key={evt.id} whileTap={{ scale: 0.98 }} className="rounded-2xl p-3 flex items-center gap-3" style={{ backgroundColor: 'var(--theme-surface)' }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--theme-primary-container)', color: 'var(--theme-on-primary-container)' }}>
                <Icon size={18} />
              </div>
              <div className="flex-1">
                <div className="font-semibold text-sm" style={{ color: 'var(--theme-text-main)' }}>{evt.title}</div>
                <div className="text-xs" style={{ color: 'var(--theme-text-sub)' }}>{formatDate(evt.date)}</div>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ backgroundColor: 'var(--theme-primary-container)', color: 'var(--theme-on-primary-container)' }}>
                {evt.type}
              </span>
            </motion.div>
          );
        })
      )}

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="New Event">
        <div className="p-4 space-y-4">
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Event title"
            className="w-full p-3 rounded-2xl border text-sm"
            style={{ borderColor: 'var(--theme-primary-container)', color: 'var(--theme-text-main)', backgroundColor: 'var(--theme-surface-container)' }}
          />
          <input
            type="date"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            className="w-full p-3 rounded-2xl border text-sm"
            style={{ borderColor: 'var(--theme-primary-container)', color: 'var(--theme-text-main)', backgroundColor: 'var(--theme-surface-container)' }}
          />
          <div className="flex gap-2">
            {(['Date', 'Goal', 'Anniversary'] as const).map((t) => (
              <motion.button
                key={t}
                whileTap={{ scale: 0.95 }}
                onClick={() => setNewType(t)}
                className="flex-1 py-2.5 rounded-xl text-xs font-medium"
                style={{
                  backgroundColor: newType === t ? 'var(--theme-primary)' : 'var(--theme-surface-container)',
                  color: newType === t ? 'var(--theme-on-primary)' : 'var(--theme-text-sub)',
                }}
              >
                {t}
              </motion.button>
            ))}
          </div>
          <motion.button whileTap={{ scale: 0.95 }} onClick={addEvent} className="w-full py-3 rounded-2xl font-semibold text-white" style={{ backgroundColor: 'var(--theme-primary)' }}>
            Add Event
          </motion.button>
        </div>
      </Modal>
    </motion.div>
  );
}

/* Vault Tab */
function VaultTab() {
  const identity = useAppStore((s) => s.identity);
  const batmanName = useAppStore((s) => s.batmanName);
  const princessName = useAppStore((s) => s.princessName);
  const letters = useAppStore((s) => s.letters);
  const setLetters = useAppStore((s) => s.setLetters);
  const [showWrite, setShowWrite] = useState(false);
  const [letterContent, setLetterContent] = useState('');

  const writeLetter = () => {
    if (!letterContent.trim()) return;
    const myName = identity === 'Batman' ? batmanName : princessName;
    const partnerName = identity === 'Batman' ? princessName : batmanName;
    setLetters([
      ...letters,
      { id: `let-${Date.now()}`, from: myName, to: partnerName, content: letterContent, timestamp: new Date().toISOString(), read: false },
    ]);
    setLetterContent('');
    setShowWrite(false);
  };

  const openLetter = (letterId: string) => {
    const letter = letters.find(l => l.id === letterId);
    if (letter && !letter.read && letter.to === (identity === 'Batman' ? batmanName : princessName)) {
      // Feature 8: Mark letter as read when opened by recipient
      const state = useAppStore.getState();
      state.markLetterRead(letterId);
      // Emit letter-read event via socket
      if (typeof window !== 'undefined') {
        try { (window as any).__sanctuarySocket?.emitLetterRead(letterId); } catch {}
      }
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-3"
    >
      <div className="flex justify-end">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => setShowWrite(true)}
          className="px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-1"
          style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-on-primary)' }}
        >
          <PenTool size={14} /> Write Letter
        </motion.button>
      </div>

      {letters.length === 0 ? (
        <div className="text-center py-12">
          <BookOpen size={40} className="mx-auto mb-3 opacity-30" style={{ color: 'var(--theme-text-sub)' }} />
          <p className="text-sm" style={{ color: 'var(--theme-text-sub)' }}>No love letters yet</p>
          <p className="text-xs mt-1" style={{ color: 'var(--theme-text-sub)' }}>Write your first letter to your partner</p>
        </div>
      ) : (
        letters.map((letter) => (
          <motion.div key={letter.id} whileTap={{ scale: 0.98 }} className="rounded-2xl p-4 relative" style={{ backgroundColor: 'var(--theme-surface)' }} onClick={() => openLetter(letter.id)}>
            {/* Feature 8: Unread indicator */}
            {!letter.read && letter.to === (identity === 'Batman' ? batmanName : princessName) && (
              <div className="absolute top-3 right-3 w-2.5 h-2.5 rounded-full" style={{ backgroundColor: 'var(--theme-primary)' }} />
            )}
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-medium" style={{ color: 'var(--theme-primary)' }}>From {letter.from}</span>
              <span className="text-xs" style={{ color: 'var(--theme-text-sub)' }}>→</span>
              <span className="text-xs font-medium" style={{ color: 'var(--theme-primary)' }}>{letter.to}</span>
              <span className="text-[10px] ml-auto" style={{ color: 'var(--theme-text-sub)' }}>{timeAgo(letter.timestamp)}</span>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--theme-on-surface)' }}>{letter.content}</p>
            {/* Feature 8: Read/Delivered status for sent letters */}
            {letter.from === (identity === 'Batman' ? batmanName : princessName) && (
              <div className="flex items-center gap-1 mt-2 justify-end">
                {letter.read ? (
                  <CheckCheck size={12} style={{ color: 'var(--theme-primary)' }} />
                ) : (
                  <Check size={12} style={{ color: 'var(--theme-text-sub)' }} />
                )}
                <span className="text-[10px]" style={{ color: letter.read ? 'var(--theme-primary)' : 'var(--theme-text-sub)' }}>
                  {letter.read ? 'Read' : 'Delivered'}
                </span>
              </div>
            )}
          </motion.div>
        ))
      )}

      <Modal open={showWrite} onClose={() => setShowWrite(false)} title="Love Letter">
        <div className="p-4 space-y-4">
          <textarea
            value={letterContent}
            onChange={(e) => setLetterContent(e.target.value)}
            placeholder="Write something from the heart..."
            className="w-full p-3 rounded-2xl border text-sm resize-none h-40"
            style={{ borderColor: 'var(--theme-primary-container)', color: 'var(--theme-text-main)', backgroundColor: 'var(--theme-surface-container)' }}
          />
          <motion.button whileTap={{ scale: 0.95 }} onClick={writeLetter} className="w-full py-3 rounded-2xl font-semibold text-white" style={{ backgroundColor: 'var(--theme-primary)' }}>
            Send Letter 💕
          </motion.button>
        </div>
      </Modal>
    </motion.div>
  );
}

/* Memory Tab */
function MemoryTab() {
  const aiMemory = useAppStore((s) => s.aiMemory);
  const setAiMemory = useAppStore((s) => s.setAiMemory);
  const [showAdd, setShowAdd] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [newCategory, setNewCategory] = useState<string>('General');
  const [newRevealDate, setNewRevealDate] = useState('');

  const addAIMemory = () => {
    if (!newContent.trim()) return;
    setAiMemory({
      ...aiMemory,
      explicitMemories: [
        ...aiMemory.explicitMemories,
        {
          id: `aimem-${Date.now()}`,
          content: newContent,
          timestamp: new Date().toISOString(),
          category: newCategory as 'General',
          revealDate: newRevealDate || undefined,
        },
      ],
    });
    setNewContent('');
    setNewCategory('General');
    setNewRevealDate('');
    setShowAdd(false);
  };

  const categories = ['General', 'Joke', 'Favorite', 'Date', 'Important'];

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-3"
    >
      <div className="flex justify-end">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => setShowAdd(true)}
          className="px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-1"
          style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-on-primary)' }}
        >
          <Plus size={16} /> Add Memory
        </motion.button>
      </div>

      {aiMemory.explicitMemories.length === 0 ? (
        <div className="text-center py-12">
          <Brain size={40} className="mx-auto mb-3 opacity-30" style={{ color: 'var(--theme-text-sub)' }} />
          <p className="text-sm" style={{ color: 'var(--theme-text-sub)' }}>No AI memories stored</p>
          <p className="text-xs mt-1" style={{ color: 'var(--theme-text-sub)' }}>Help the AI learn about your relationship</p>
        </div>
      ) : (
        aiMemory.explicitMemories.map((mem) => (
          <motion.div key={mem.id} whileTap={{ scale: 0.98 }} className="rounded-2xl p-3 flex items-center gap-3" style={{ backgroundColor: 'var(--theme-surface)' }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--theme-primary-container)', color: 'var(--theme-on-primary-container)' }}>
              <Brain size={18} />
            </div>
            <div className="flex-1">
              <div className="text-sm" style={{ color: 'var(--theme-text-main)' }}>{mem.content}</div>
              <div className="text-[10px] mt-0.5" style={{ color: 'var(--theme-text-sub)' }}>{formatDate(mem.timestamp)}</div>
            </div>
          </motion.div>
        ))
      )}

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add AI Memory">
        <div className="p-4 space-y-4">
          <textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="What should the AI remember?"
            className="w-full p-3 rounded-2xl border text-sm resize-none h-24"
            style={{ borderColor: 'var(--theme-primary-container)', color: 'var(--theme-text-main)', backgroundColor: 'var(--theme-surface-container)' }}
          />
          <div>
            <label className="text-xs font-medium mb-2 block" style={{ color: 'var(--theme-text-sub)' }}>Category</label>
            <div className="flex gap-2 flex-wrap">
              {categories.map((cat) => (
                <motion.button
                  key={cat}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setNewCategory(cat)}
                  className="px-3 py-1.5 rounded-full text-xs font-medium"
                  style={{
                    backgroundColor: newCategory === cat ? 'var(--theme-primary)' : 'var(--theme-surface-container)',
                    color: newCategory === cat ? 'var(--theme-on-primary)' : 'var(--theme-text-sub)',
                  }}
                >
                  {cat}
                </motion.button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium mb-2 block" style={{ color: 'var(--theme-text-sub)' }}>Reveal Date</label>
            <input
              type="date"
              value={newRevealDate}
              onChange={(e) => setNewRevealDate(e.target.value)}
              className="w-full p-3 rounded-2xl border text-sm"
              style={{ borderColor: 'var(--theme-primary-container)', color: 'var(--theme-text-main)', backgroundColor: 'var(--theme-surface-container)' }}
            />
          </div>
          <motion.button whileTap={{ scale: 0.95 }} onClick={addAIMemory} className="w-full py-3 rounded-2xl font-semibold text-white" style={{ backgroundColor: 'var(--theme-primary)' }}>
            Save Memory
          </motion.button>
        </div>
      </Modal>
    </motion.div>
  );
}

/* Game Tab (Feature 13: Love Quiz Battle) */
const LOVE_QUIZ_QUESTIONS = [
  { q: "When did we first meet?", options: ["At a party", "Through friends", "Online", "At work"], correct: 0 },
  { q: "Who said 'I love you' first?", options: ["Me!", "My partner!", "We said it together", "It's a secret 😏"], correct: 0 },
  { q: "What's our favorite thing to do together?", options: ["Watch movies", "Cook together", "Go on walks", "Dance in the kitchen"], correct: 0 },
  { q: "What was our first trip together?", options: ["Beach getaway", "Mountain cabin", "City adventure", "Staycation"], correct: 0 },
  { q: "Who is the better cook?", options: ["Me, obviously 👨‍🍳", "My partner 🧑‍🍳", "We're equal", "We order takeout 😂"], correct: 0 },
  { q: "What's our song?", options: ["A love ballad 💕", "An upbeat jam 🎵", "Something funny 😄", "We have many!"], correct: 0 },
  { q: "Who takes longer to get ready?", options: ["Definitely me 😅", "My partner for sure", "Same time", "We're both quick!"], correct: 0 },
  { q: "What's our dream destination?", options: ["Paris 🗼", "Tokyo 🗾", "Maldives 🏝️", "Road trip 🚗"], correct: 0 },
  { q: "Who is more romantic?", options: ["Me 💕", "My partner 🌹", "Equally romantic", "Neither of us 😂"], correct: 0 },
  { q: "What's our favorite date night?", options: ["Fancy dinner 🍽️", "Movie night 🍿", "Stargazing 🌟", "Dancing 💃"], correct: 0 },
  { q: "Who remembers important dates better?", options: ["Me 📅", "My partner 🗓️", "Both equally", "We both forget 😅"], correct: 0 },
  { q: "What's our couple nickname?", options: ["Something sweet 🍯", "Something funny 😂", "Something secret 🤫", "We don't have one"], correct: 0 },
  { q: "Who falls asleep first?", options: ["Me 😴", "My partner 💤", "Same time", "We take turns"], correct: 0 },
  { q: "What's our inside joke about?", options: ["Food 🍕", "An embarrassing moment 😳", "A weird habit 🤭", "Too many to count!"], correct: 0 },
  { q: "Who is the big spoon?", options: ["Me 🥄", "My partner", "We switch!", "No spoons, just chaos 😂"], correct: 0 },
  { q: "What would we do with a free weekend?", options: ["Sleep in 😴", "Adventure time 🏔️", "Binge a show 📺", "Try something new 🎨"], correct: 0 },
  { q: "Who is more likely to cry during a movie?", options: ["Me 😭", "My partner 🥺", "Both of us 💔", "Neither 🧐"], correct: 0 },
  { q: "What's our comfort food?", options: ["Pizza 🍕", "Ice cream 🍦", "Pasta 🍝", "Chocolate 🍫"], correct: 0 },
  { q: "Who is the better gift giver?", options: ["Me 🎁", "My partner 🎀", "Equally thoughtful", "We're both terrible 😂"], correct: 0 },
  { q: "What made us fall for each other?", options: ["Sense of humor 😄", "Kindness 💝", "Intelligence 🧠", "Everything! 💕"], correct: 0 },
  { q: "Who hogs the blankets?", options: ["Me 🛏️", "My partner", "We share!", "It's a nightly war ⚔️"], correct: 0 },
  { q: "What's our go-to conversation topic?", options: ["Future plans 🗺️", "Funny stories 😂", "Deep talks 🌊", "Gossip 🤫"], correct: 0 },
  { q: "Who is more spontaneous?", options: ["Me 🎲", "My partner 🎪", "Equally wild", "We're both planners 📋"], correct: 0 },
  { q: "What's the key to our relationship?", options: ["Trust 💎", "Laughter 😄", "Communication 💬", "Love ❤️"], correct: 0 },
  { q: "Who apologizes first after a fight?", options: ["Me 🙏", "My partner 🤝", "Whoever is wrong", "We don't fight! 😇"], correct: 0 },
  { q: "What would we name our pet?", options: ["Something cute 🐱", "Something funny 🐶", "A human name 😂", "We can't agree! 🤷"], correct: 0 },
  { q: "Who is the morning person?", options: ["Me ☀️", "My partner 🌅", "Neither 🌙", "Both of us!"], correct: 0 },
  { q: "What's our favorite season together?", options: ["Spring 🌸", "Summer ☀️", "Fall 🍂", "Winter ❄️"], correct: 0 },
  { q: "Who says 'I love you' more?", options: ["Me 💕", "My partner 💖", "About the same", "Actions > words 💪"], correct: 0 },
  { q: "What's our relationship in 3 words?", options: ["Fun & loving", "Crazy together", "Best friends", "Forever & always"], correct: 0 },
  { q: "Who is the better dancer?", options: ["Me 💃", "My partner 🕺", "Equally bad 😂", "Equally amazing!"], correct: 0 },
  { q: "What's our midnight snack?", options: ["Cereal 🥣", "Chips 🍿", "Ice cream 🍦", "Whatever's there 😅"], correct: 0 },
  // ── 20+ MORE varied questions for freshness ──
  { q: "Who is more stubborn?", options: ["Me, hands down 🗿", "My partner, obviously 😤", "We're both impossible 😂", "We're both flexible 🧘"], correct: 0 },
  { q: "What's our favorite way to show affection?", options: ["Holding hands 🤝", "Kisses 💋", "Cuddling 🤗", "Surprise gifts 🎁"], correct: 0 },
  { q: "Who is the better listener?", options: ["Me 👂", "My partner 💭", "We take turns", "We both zone out 😅"], correct: 0 },
  { q: "What's our go-to TV genre?", options: ["Romance 💕", "Comedy 😂", "Thriller 🔪", "Documentary 🎬"], correct: 0 },
  { q: "Who is more likely to start a tickle fight?", options: ["Me 🤭", "My partner 😈", "It's mutual chaos 🙊", "Neither, we're serious 😐"], correct: 0 },
  { q: "What would we do if we won the lottery?", options: ["Travel the world ✈️", "Buy a dream house 🏠", "Start a business 💼", "Donate & invest 📈"], correct: 0 },
  { q: "Who takes more selfies together?", options: ["Me 📸", "My partner 🤳", "We're equal offenders", "We prefer memories over photos 📷"], correct: 0 },
  { q: "What's our pet peeve about each other?", options: ["Snoring 😴", "Leaving things around 🧹", "Phone addiction 📱", "We're perfect! 😇"], correct: 0 },
  { q: "Who is more competitive?", options: ["Me, I must win 🏆", "My partner 🥊", "Equally fierce 🔥", "We don't compete 💕"], correct: 0 },
  { q: "What's our ideal vacation vibe?", options: ["Relaxing beach 🏖️", "Exploring cities 🏛️", "Nature retreat 🌲", "Party destination 🎉"], correct: 0 },
  { q: "Who is the messy one?", options: ["Me 🌪️", "My partner 🌀", "Both of us 😅", "We're both neat freaks ✨"], correct: 0 },
  { q: "What's our special tradition?", options: ["Date nights 💑", "Movie marathons 🎬", "Cooking together 👩‍🍳", "We're making it up as we go 😂"], correct: 0 },
  { q: "Who overthinks more?", options: ["Me 🧠", "My partner 🤔", "We spiral together 🌊", "We're both chill 😎"], correct: 0 },
  { q: "What's our favorite way to unwind?", options: ["Cuddling on the couch 🛋️", "Going for a walk 🚶", "Gaming together 🎮", "Cooking a nice meal 🍳"], correct: 0 },
  { q: "Who is the first to say sorry?", options: ["Me 💙", "My partner 💜", "Whoever messed up 🙃", "We don't keep track 💕"], correct: 0 },
  { q: "What would our couple superpower be?", options: ["Reading each other's minds 🧠", "Finishing each other's sentences 💬", "Making each other laugh anywhere 😂", "Unstoppable together 💪"], correct: 0 },
  { q: "Who is the better shopper?", options: ["Me, bargain hunter 🛍️", "My partner, taste maker ✨", "We're both impulsive 💸", "We both hate shopping 😂"], correct: 0 },
  { q: "What's our love language?", options: ["Words of affirmation 💬", "Quality time ⏰", "Physical touch 🤗", "Acts of service 🛠️"], correct: 0 },
  { q: "Who is more photogenic?", options: ["Me 😎", "My partner 📸", "We're both stunning ✨", "We both take bad photos 😂"], correct: 0 },
  { q: "What would we do on a rainy day?", options: ["Stay in bed all day 🛏️", "Board games 🎲", "Cook something warm 🍲", "Dance in the rain 🌧️"], correct: 0 },
  { q: "Who is the bigger scaredy-cat?", options: ["Me 😱", "My partner 👻", "We're both brave... jk 😂", "We love horror! 🍿"], correct: 0 },
  { q: "Who is more likely to cry during a sad movie?", options: ["Me, every time 😭", "My partner, secretly 🥺", "We both reach for tissues 🤧", "We only watch action 💪"], correct: 0 },
  { q: "What's our go-to late night snack?", options: ["Instant noodles 🍜", "Ice cream raid 🍦", "Whatever we can find 🍕", "We actually cook 🍳"], correct: 0 },
  { q: "Who hogs the bathroom in the morning?", options: ["Me, I need my routine 💅", "My partner takes forever 🪞", "We tag-team it 🏃", "We have our own bathrooms 😎"], correct: 0 },
  { q: "What's our couple hobby?", options: ["Gaming together 🎮", "Cooking experiments 👩‍🍳", "Outdoor adventures 🏔️", "Netflix binging 📺"], correct: 0 },
  { q: "Who is more likely to get lost?", options: ["Me, no sense of direction 🗺️", "My partner, stubborn about GPS 📱", "We get lost together 🤷", "We're both navigators 🧭"], correct: 0 },
  { q: "What's our dream home?", options: ["Cozy apartment in the city 🏙️", "Beach house with a view 🏖️", "Cabin in the mountains 🏔️", "Mansion with everything 🏰"], correct: 0 },
  { q: "Who is the better driver?", options: ["Me, smooth and safe 🚗", "My partner, fast and furious 🏎️", "We're both terrible 😂", "We take turns ⌨️"], correct: 0 },
  { q: "What's our anniversary tradition?", options: ["Fancy dinner out 🍽️", "Recreating our first date 💕", "Surprise gifts 🎁", "We forget every year 😅"], correct: 0 },
  { q: "Who is more likely to send a risky text?", options: ["Me 😏", "My partner 💋", "We compete at being risky 🔥", "We're both angels 😇"], correct: 0 },
  { q: "What's our weirdest couple habit?", options: ["Finishing each other's food 🍽️", "Talking in inside jokes 🗣️", "Matching outfits 👫", "Too many to list 🤪"], correct: 0 },
  { q: "Who is the better kisser?", options: ["Me, obviously 💋", "My partner has magic lips ✨", "We're equally amazing 🔥", "Our kisses cause earthquakes 🌋"], correct: 0 },
  { q: "What would our couple theme song be?", options: ["A love ballad 🎵", "Something upbeat 💃", "A romantic rap 🎤", "An 80s power ballad 🎸"], correct: 0 },
  { q: "Who is more likely to plan a surprise?", options: ["Me, I love surprising 💝", "My partner, keeps secrets well 🤫", "We both try and fail 😂", "We prefer spontaneous moments ✨"], correct: 0 },
  { q: "What's our texting style?", options: ["Paragraph essays 📝", "Quick and emoji-heavy 😂💕", "Voice notes only 🎤", "Memes > words 🖼️"], correct: 0 },
  { q: "Who snores louder?", options: ["Me, apparently 🗣️", "My partner, like a bear 🐻", "We duet together 🎶", "Neither, we sleep like angels 😇"], correct: 0 },
  { q: "What's our favorite holiday together?", options: ["Valentine's Day 💝", "New Year's Eve 🎆", "Our anniversary 💕", "Every day with you ✨"], correct: 0 },
  { q: "Who would survive longer in a zombie apocalypse?", options: ["Me, I have a plan 🧟", "My partner, surprisingly tough 💪", "We'd go down fighting together ⚔️", "We'd hide and eat snacks 🍿"], correct: 0 },
  { q: "What's our couple superpower?", options: ["Making each other laugh anywhere 😂", "Reading each other's minds 🧠", "Turning any situation romantic 💕", "Never running out of things to say 💬"], correct: 0 },
  { q: "Who is the bigger flirt?", options: ["Me, I can't help it 😏", "My partner, smooth operator 💋", "We're both terrible at it 😂", "We only flirt with each other 💕"], correct: 0 },
  { q: "What would we name our reality TV show?", options: ["'Love & Chaos' 🎬", "'The Perfect Mess' 😂", "'Couple Goals' 💕", "'What Were We Thinking?' 🤪"], correct: 0 },
  { q: "Who is more likely to say 'I love you' first after a fight?", options: ["Me, I can't stay mad 💙", "My partner, big heart 💜", "We say it at the same time 💕", "We show it through actions 🤗"], correct: 0 },
];

function GameTab() {
  const identity = useAppStore((s) => s.identity);
  const batmanName = useAppStore((s) => s.batmanName);
  const princessName = useAppStore((s) => s.princessName);
  const vaultId = useAppStore((s) => s.vaultId);
  const [gameState, setGameState] = useState<'idle' | 'waiting' | 'question' | 'answered' | 'result' | 'finished'>('idle');
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [myAnswer, setMyAnswer] = useState<number | null>(null);
  const [partnerAnswer, setPartnerAnswer] = useState<number | null>(null);
  const [myScore, setMyScore] = useState(0);
  const [partnerScore, setPartnerScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(10);
  const [questionOrder, setQuestionOrder] = useState<number[]>([]);
  const [waitingForPartner, setWaitingForPartner] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const myAnswerStateRef = useRef<number | null>(null); // track answer across closures
  const questionOrderRef = useRef<number[]>([]);
  const currentQuestionRef = useRef(0);

  // Keep refs in sync
  useEffect(() => { questionOrderRef.current = questionOrder; }, [questionOrder]);
  useEffect(() => { currentQuestionRef.current = currentQuestion; }, [currentQuestion]);

  const TOTAL_QUESTIONS = 10;
  const myName = identity === 'Batman' ? batmanName : princessName;
  const partnerName = identity === 'Batman' ? princessName : batmanName;

  // ── Listen for real-time game events from socket ──
  useEffect(() => {
    const handleGameStarted = (e: Event) => {
      const { questionOrder: qOrder, questionIndex } = (e as CustomEvent).detail;
      if (qOrder && qOrder.length > 0) {
        setQuestionOrder(qOrder);
        questionOrderRef.current = qOrder;
      }
      setCurrentQuestion(questionIndex || 0);
      currentQuestionRef.current = questionIndex || 0;
      setMyScore(0);
      setPartnerScore(0);
      setMyAnswer(null);
      myAnswerStateRef.current = null;
      setPartnerAnswer(null);
      setWaitingForPartner(false);
      setGameState('question');
      setTimeLeft(10);
    };

    const handleGameAnswer = (e: Event) => {
      const { answer, from } = (e as CustomEvent).detail;
      // Only accept answers from partner
      if (from === identity) return;
      setPartnerAnswer(answer);
      setWaitingForPartner(false);
      // If I've already answered, move to result
      if (myAnswerStateRef.current !== null) {
        setGameState('result');
      }
    };

    const handleGameResult = (e: Event) => {
      const { answers } = (e as CustomEvent).detail;
      const state = useAppStore.getState();
      // Extract partner's answer
      const partnerIdentity = state.identity === 'Batman' ? 'Princess' : 'Batman';
      const pAnswer = answers[partnerIdentity];
      if (pAnswer !== null && pAnswer !== undefined) {
        setPartnerAnswer(pAnswer as number);
      }
      if (myAnswerStateRef.current !== null) {
        setGameState('result');
      }
    };

    const handleGameNext = (e: Event) => {
      const { questionIndex } = (e as CustomEvent).detail;
      setCurrentQuestion(questionIndex);
      currentQuestionRef.current = questionIndex;
      myAnswerStateRef.current = null;
      setMyAnswer(null);
      setPartnerAnswer(null);
      setWaitingForPartner(false);
      setTimeLeft(10);
      setGameState('question');
    };

    const handleGameEnded = () => {
      setGameState('finished');
    };

    window.addEventListener('sanctuary-game-started', handleGameStarted);
    window.addEventListener('sanctuary-game-answer', handleGameAnswer);
    window.addEventListener('sanctuary-game-result', handleGameResult);
    window.addEventListener('sanctuary-game-next', handleGameNext);
    window.addEventListener('sanctuary-game-ended', handleGameEnded);

    return () => {
      window.removeEventListener('sanctuary-game-started', handleGameStarted);
      window.removeEventListener('sanctuary-game-answer', handleGameAnswer);
      window.removeEventListener('sanctuary-game-result', handleGameResult);
      window.removeEventListener('sanctuary-game-next', handleGameNext);
      window.removeEventListener('sanctuary-game-ended', handleGameEnded);
    };
  }, [identity]);

  // Daily bonus question based on date
  const getDailyBonusQuestion = () => {
    const today = new Date();
    const daySeed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
    const idx = daySeed % LOVE_QUIZ_QUESTIONS.length;
    return idx;
  };

  // Shuffle and pick questions
  const startGame = () => {
    const indices = Array.from({ length: LOVE_QUIZ_QUESTIONS.length }, (_, i) => i);
    // Fisher-Yates shuffle
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    // Include daily bonus question as the last question
    const dailyBonus = getDailyBonusQuestion();
    let selected = indices.slice(0, TOTAL_QUESTIONS - 1);
    selected.push(dailyBonus);
    setQuestionOrder(selected);
    questionOrderRef.current = selected;
    setCurrentQuestion(0);
    currentQuestionRef.current = 0;
    setMyScore(0);
    setPartnerScore(0);
    setMyAnswer(null);
    myAnswerStateRef.current = null;
    setPartnerAnswer(null);
    setWaitingForPartner(false);
    setGameState('question');
    setTimeLeft(10);

    // Emit game start to partner with question order for sync
    const socket = (window as any).__sanctuarySocket;
    if (socket) {
      // Emit via raw socket so we can include questionOrder
      const state = useAppStore.getState();
      if (socket.socket?.current?.connected) {
        socket.socket.current.emit('game-start', {
          vaultId: state.vaultId,
          from: state.identity,
          questionOrder: selected,
        });
      }
    }
  };

  // Countdown timer
  useEffect(() => {
    if (gameState !== 'question') {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          // Time's up — auto-submit null answer
          if (myAnswerStateRef.current === null) {
            myAnswerStateRef.current = -1;
            setMyAnswer(-1);
            // Process auto-answer after state update
            setTimeout(() => {
              if (timerRef.current) clearInterval(timerRef.current);
              const socket = (window as any).__sanctuarySocket;
              if (socket) socket.emitGameAnswer(currentQuestionRef.current, -1);
              // Wait for partner's answer via socket event (real-time)
              setWaitingForPartner(true);
            }, 0);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [gameState, currentQuestion]);

  const handleAnswer = useCallback((answerIndex: number) => {
    if (myAnswerStateRef.current !== null) return; // Already answered
    myAnswerStateRef.current = answerIndex;
    setMyAnswer(answerIndex);
    if (timerRef.current) clearInterval(timerRef.current);

    // Emit answer to partner via socket
    const socket = (window as any).__sanctuarySocket;
    if (socket) socket.emitGameAnswer(currentQuestionRef.current, answerIndex);

    // Check if partner already answered (received via socket event)
    setWaitingForPartner(true);
  }, []);

  // When partner answer comes in and we've already answered, show result
  useEffect(() => {
    if (partnerAnswer !== null && myAnswerStateRef.current !== null && waitingForPartner) {
      queueMicrotask(() => {
        setWaitingForPartner(false);
        setGameState('result');
      });
    }
  }, [partnerAnswer, waitingForPartner]);

  const calculateScores = (my: number, partner: number) => {
    const q = LOVE_QUIZ_QUESTIONS[questionOrder[currentQuestion]];
    if (!q) return;
    const myCorrect = my === q.correct;
    const partnerCorrect = partner === q.correct;

    if (myCorrect) setMyScore((prev) => prev + (partnerCorrect ? 2 : 1));
    if (partnerCorrect) setPartnerScore((prev) => prev + (myCorrect ? 2 : 1));
  };

  const nextQuestion = () => {
    const nextQ = currentQuestion + 1;
    if (nextQ >= TOTAL_QUESTIONS) {
      setGameState('finished');
      const socket = (window as any).__sanctuarySocket;
      if (socket) socket.emitGameEnd();
      return;
    }
    setCurrentQuestion(nextQ);
    currentQuestionRef.current = nextQ;
    myAnswerStateRef.current = null;
    setMyAnswer(null);
    setPartnerAnswer(null);
    setWaitingForPartner(false);
    setTimeLeft(10);
    setGameState('question');

    const socket = (window as any).__sanctuarySocket;
    if (socket) socket.emitGameNext(nextQ);
  };

  const currentQ = questionOrder.length > 0 ? LOVE_QUIZ_QUESTIONS[questionOrder[currentQuestion]] : null;
  const isLastQuestion = currentQuestion >= TOTAL_QUESTIONS - 1;

  // Idle screen
  if (gameState === 'idle') {
    return (
      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
        <div className="text-center py-6">
          <motion.div
            animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            className="text-6xl mb-4"
          >
            🎮
          </motion.div>
          <h3 className="text-xl font-bold mb-2" style={{ color: 'var(--theme-text-main)' }}>Love Quiz Battle</h3>
          <p className="text-sm mb-1" style={{ color: 'var(--theme-text-sub)' }}>
            Test how well you know each other!
          </p>
          <p className="text-xs mb-6" style={{ color: 'var(--theme-text-sub)' }}>
            10 questions • 10 seconds each • Play together in real-time
          </p>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={startGame}
            className="px-8 py-3 rounded-full text-sm font-bold text-white shadow-lg"
            style={{ background: 'linear-gradient(135deg, var(--theme-primary), var(--theme-accent))' }}
          >
            Start Game 🎯
          </motion.button>
        </div>

        <SectionCard>
          <div className="text-xs font-medium mb-2" style={{ color: 'var(--theme-text-sub)' }}>How it works</div>
          <div className="space-y-2 text-xs" style={{ color: 'var(--theme-on-surface)' }}>
            <div className="flex gap-2"><span>1️⃣</span><span>Both partners see the same question</span></div>
            <div className="flex gap-2"><span>2️⃣</span><span>Pick your answer within 10 seconds</span></div>
            <div className="flex gap-2"><span>3️⃣</span><span>Both correct = 2pts each, one correct = 1pt</span></div>
            <div className="flex gap-2"><span>4️⃣</span><span>Most points after 10 rounds wins! 🏆</span></div>
          </div>
        </SectionCard>
      </motion.div>
    );
  }

  // Finished screen
  if (gameState === 'finished') {
    const isWinner = myScore > partnerScore;
    const isTie = myScore === partnerScore;
    return (
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-6 space-y-4">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          className="text-6xl mb-2"
        >
          {isTie ? '🤝' : isWinner ? '🏆' : '💝'}
        </motion.div>
        <h3 className="text-xl font-bold" style={{ color: 'var(--theme-text-main)' }}>
          {isTie ? "It's a Tie!" : isWinner ? `${myName} Wins!` : `${partnerName} Wins!`}
        </h3>
        <div className="flex justify-center gap-8">
          <div className="text-center">
            <div className="text-xs font-medium" style={{ color: 'var(--theme-primary)' }}>{myName}</div>
            <div className="text-3xl font-bold" style={{ color: 'var(--theme-text-main)' }}>{myScore}</div>
          </div>
          <div className="text-center">
            <div className="text-xs font-medium" style={{ color: 'var(--theme-text-sub)' }}>{partnerName}</div>
            <div className="text-3xl font-bold" style={{ color: 'var(--theme-text-sub)' }}>{partnerScore}</div>
          </div>
        </div>
        <p className="text-sm" style={{ color: 'var(--theme-text-sub)' }}>
          {isTie ? "You two are perfectly in sync! 💕" : isWinner ? "You know your partner best! 💪" : "Love is about learning more! 💖"}
        </p>
        <div className="flex gap-3 justify-center">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={startGame}
            className="px-6 py-2.5 rounded-full text-sm font-semibold text-white"
            style={{ backgroundColor: 'var(--theme-primary)' }}
          >
            Play Again 🎮
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setGameState('idle')}
            className="px-6 py-2.5 rounded-full text-sm font-medium"
            style={{ backgroundColor: 'var(--theme-surface-container)', color: 'var(--theme-on-surface)' }}
          >
            Back
          </motion.button>
        </div>
      </motion.div>
    );
  }

  // Question / Result screen
  return (
    <SectionCard>
      <div className="text-center space-y-4 py-2">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="text-xs font-medium" style={{ color: 'var(--theme-primary)' }}>
            {currentQuestion + 1} / {TOTAL_QUESTIONS}
          </div>
          <div className="flex items-center gap-1 text-sm font-bold" style={{ color: timeLeft <= 3 ? '#EF4444' : 'var(--theme-text-main)' }}>
            <Timer size={14} /> {timeLeft}s
          </div>
          <div className="flex gap-3 text-xs">
            <span style={{ color: 'var(--theme-primary)' }}>{myName}: {myScore}</span>
            <span style={{ color: 'var(--theme-text-sub)' }}>{partnerName}: {partnerScore}</span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--theme-surface-container)' }}>
          <div className="h-full rounded-full transition-all duration-300" style={{ width: `${((currentQuestion + (gameState === 'result' ? 1 : 0)) / TOTAL_QUESTIONS) * 100}%`, backgroundColor: 'var(--theme-primary)' }} />
        </div>

        {/* Question */}
        {currentQ && (
          <motion.div
            key={currentQuestion}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-lg font-semibold py-3 px-2"
            style={{ color: 'var(--theme-text-main)' }}
          >
            {currentQ.q}
          </motion.div>
        )}

        {/* Answer options or result */}
        {gameState === 'question' && currentQ && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {currentQ.options.map((opt, idx) => (
                <motion.button
                  key={idx}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleAnswer(idx)}
                  disabled={myAnswer !== null}
                  className="p-3 rounded-2xl text-sm font-medium text-left transition-colors"
                  style={{
                    backgroundColor: myAnswer === idx ? 'var(--theme-primary)' : 'var(--theme-surface-container)',
                    color: myAnswer === idx ? 'var(--theme-on-primary)' : 'var(--theme-on-surface)',
                    opacity: myAnswer !== null && myAnswer !== idx ? 0.5 : 1,
                  }}
                >
                  {opt}
                </motion.button>
              ))}
            </div>
            {/* Waiting for partner indicator */}
            {waitingForPartner && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-center gap-2 py-2 text-xs"
                style={{ color: 'var(--theme-text-sub)' }}
              >
                <div className="w-3 h-3 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--theme-primary)', borderTopColor: 'transparent' }} />
                Waiting for {partnerName} to answer...
              </motion.div>
            )}
          </div>
        )}

        {gameState === 'result' && currentQ && (
          <div className="space-y-3">
            {/* Show correct answer */}
            <div className="p-3 rounded-2xl text-sm font-medium text-center" style={{ backgroundColor: 'var(--theme-primary-container)', color: 'var(--theme-on-primary-container)' }}>
              ✨ Correct answer: {currentQ.options[currentQ.correct]}
            </div>
            {/* Show both answers */}
            <div className="flex gap-3 justify-center">
              <div className="text-center p-3 rounded-2xl flex-1" style={{ backgroundColor: myAnswer === currentQ.correct ? '#22C55E20' : '#EF444420', color: myAnswer === currentQ.correct ? '#16A34A' : '#DC2626' }}>
                <div className="text-xs font-medium mb-1">{myName}</div>
                <div className="text-sm">{myAnswer >= 0 ? currentQ.options[myAnswer] : '⏰ Time up!'}</div>
                <div className="text-lg mt-1">{myAnswer === currentQ.correct ? '✅' : '❌'}</div>
              </div>
              <div className="text-center p-3 rounded-2xl flex-1" style={{ backgroundColor: partnerAnswer === currentQ.correct ? '#22C55E20' : '#EF444420', color: partnerAnswer === currentQ.correct ? '#16A34A' : '#DC2626' }}>
                <div className="text-xs font-medium mb-1">{partnerName}</div>
                <div className="text-sm">{partnerAnswer !== null && partnerAnswer >= 0 ? currentQ.options[partnerAnswer] : '⏰ Time up!'}</div>
                <div className="text-lg mt-1">{partnerAnswer === currentQ.correct ? '✅' : '❌'}</div>
              </div>
            </div>
            {/* Match indicator */}
            {myAnswer === partnerAnswer && myAnswer >= 0 && (
              <div className="text-sm font-semibold" style={{ color: 'var(--theme-primary)' }}>
                💕 You both picked the same answer!
              </div>
            )}
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={nextQuestion}
              className="px-8 py-2.5 rounded-full text-sm font-semibold text-white"
              style={{ backgroundColor: 'var(--theme-primary)' }}
            >
              {isLastQuestion ? 'See Results 🏆' : 'Next Question →'}
            </motion.button>
          </div>
        )}
      </div>
    </SectionCard>
  );
}

/* ═══════════════════════════════════════════════════════
   SETTINGS SCREEN
   ═══════════════════════════════════════════════════════ */
function SettingsScreen() {
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);
  const font = useAppStore((s) => s.font);
  const setFont = useAppStore((s) => s.setFont);
  const identity = useAppStore((s) => s.identity);
  const batmanName = useAppStore((s) => s.batmanName);
  const princessName = useAppStore((s) => s.princessName);
  const batmanPhoto = useAppStore((s) => s.batmanPhoto);
  const princessPhoto = useAppStore((s) => s.princessPhoto);
  const setBatmanPhoto = useAppStore((s) => s.setBatmanPhoto);
  const setPrincessPhoto = useAppStore((s) => s.setPrincessPhoto);
  const notificationSettings = useAppStore((s) => s.notificationSettings);
  const setNotificationSettings = useAppStore((s) => s.setNotificationSettings);
  const encryptionEnabled = useAppStore((s) => s.encryptionEnabled);
  const setEncryptionEnabled = useAppStore((s) => s.setEncryptionEnabled);
  const encryptionKey = useAppStore((s) => s.encryptionKey);
  const setEncryptionKey = useAppStore((s) => s.setEncryptionKey);
  const autoSync = useAppStore((s) => s.autoSync);
  const setAutoSync = useAppStore((s) => s.setAutoSync);
  const resetApp = useAppStore((s) => s.resetApp);
  const vaultId = useAppStore((s) => s.vaultId);
  const chatWallpaper = useAppStore((s) => s.chatWallpaper);
  const setChatWallpaper = useAppStore((s) => s.setChatWallpaper);
  const aiApiKey = useAppStore((s) => s.aiApiKey);
  const setAiApiKey = useAppStore((s) => s.setAiApiKey);
  const setBatmanName = useAppStore((s) => s.setBatmanName);
  const setPrincessName = useAppStore((s) => s.setPrincessName);
  const messages = useAppStore((s) => s.messages);
  const [showReset, setShowReset] = useState(false);
  const [editingBatmanName, setEditingBatmanName] = useState(false);
  const [editingPrincessName, setEditingPrincessName] = useState(false);
  const [batmanNameVal, setBatmanNameVal] = useState(batmanName);
  const [princessNameVal, setPrincessNameVal] = useState(princessName);

  const themeNames = Object.keys(THEMES) as ThemeName[];
  const fontOptions: FontStyle[] = ['Default', 'Serif', 'Monospace'];

  const notifKeys = [
    { key: 'messages' as const, label: 'Messages', icon: MessageCircle },
    { key: 'signals' as const, label: 'Signals', icon: Zap },
    { key: 'memories' as const, label: 'Memories', icon: ImageIcon },
    { key: 'moodUpdates' as const, label: 'Mood Updates', icon: Heart },
    { key: 'sound' as const, label: 'Sound', icon: Volume2 },
    { key: 'vibration' as const, label: 'Vibration', icon: Vibrate },
    { key: 'showPreview' as const, label: 'Preview', icon: Eye },
  ];

  const copyVaultCode = () => {
    navigator.clipboard.writeText(vaultId);
  };

  return (
    <div className="px-4 pb-4 space-y-4">
      <h2 className="text-xl font-bold" style={{ color: 'var(--theme-text-main)' }}>Settings</h2>

      {/* Vault Sync */}
      <SectionCard>
        <div className="text-xs font-medium mb-3 flex items-center gap-2" style={{ color: 'var(--theme-text-sub)' }}>
          <Shield size={14} /> Vault Sync
        </div>
        <div className="flex items-center gap-2 mb-3">
          <div className="flex-1 px-3 py-2 rounded-xl text-sm font-mono" style={{ backgroundColor: 'var(--theme-surface-container)', color: 'var(--theme-text-main)' }}>
            {vaultId}
          </div>
          <motion.button whileTap={{ scale: 0.9 }} onClick={copyVaultCode} className="p-2 rounded-xl" style={{ backgroundColor: 'var(--theme-primary-container)', color: 'var(--theme-on-primary-container)' }}>
            <Copy size={16} />
          </motion.button>
        </div>
        <div className="flex gap-2">
          <motion.button whileTap={{ scale: 0.95 }} className="flex-1 py-2 rounded-xl text-xs font-medium flex items-center justify-center gap-1" style={{ backgroundColor: 'var(--theme-surface-container)', color: 'var(--theme-text-sub)' }}>
            <Download size={14} /> Install App
          </motion.button>
          <motion.button whileTap={{ scale: 0.95 }} className="flex-1 py-2 rounded-xl text-xs font-medium flex items-center justify-center gap-1" style={{ backgroundColor: 'var(--theme-surface-container)', color: 'var(--theme-text-sub)' }}>
            <Globe size={14} /> Export Data
          </motion.button>
        </div>
      </SectionCard>

      {/* Identity */}
      <SectionCard>
        <div className="text-xs font-medium mb-3 flex items-center gap-2" style={{ color: 'var(--theme-text-sub)' }}>
          <User size={14} /> Identity
        </div>
        <div className="flex gap-3">
          {/* Batman */}
          <div
            className="flex-1 rounded-2xl p-3 text-center"
            style={{ backgroundColor: identity === 'Batman' ? 'var(--theme-primary-container)' : 'var(--theme-surface-container)' }}
          >
            <div className="flex justify-center">
              <ProfilePhotoPicker name={batmanName} photo={batmanPhoto} size={48} onPhotoChange={(url) => setBatmanPhoto(url)} />
            </div>
            <div className="text-xs font-semibold mt-2" style={{ color: 'var(--theme-text-main)' }}>
              {batmanName}
            </div>
            {identity === 'Batman' && (
              <span className="text-[10px] px-2 py-0.5 rounded-full mt-1 inline-block" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-on-primary)' }}>You</span>
            )}
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => { setEditingBatmanName(true); setBatmanNameVal(batmanName); }}
              className="mt-1 text-[10px] flex items-center gap-0.5 mx-auto"
              style={{ color: 'var(--theme-primary)' }}
            >
              <Edit3 size={10} /> Edit
            </motion.button>
          </div>

          {/* Princess */}
          <div
            className="flex-1 rounded-2xl p-3 text-center"
            style={{ backgroundColor: identity === 'Princess' ? 'var(--theme-primary-container)' : 'var(--theme-surface-container)' }}
          >
            <div className="flex justify-center">
              <ProfilePhotoPicker name={princessName} photo={princessPhoto} size={48} onPhotoChange={(url) => setPrincessPhoto(url)} />
            </div>
            <div className="text-xs font-semibold mt-2" style={{ color: 'var(--theme-text-main)' }}>
              {princessName}
            </div>
            {identity === 'Princess' && (
              <span className="text-[10px] px-2 py-0.5 rounded-full mt-1 inline-block" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-on-primary)' }}>You</span>
            )}
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => { setEditingPrincessName(true); setPrincessNameVal(princessName); }}
              className="mt-1 text-[10px] flex items-center gap-0.5 mx-auto"
              style={{ color: 'var(--theme-primary)' }}
            >
              <Edit3 size={10} /> Edit
            </motion.button>
          </div>
        </div>
      </SectionCard>

      {/* Theme */}
      <SectionCard>
        <div className="text-xs font-medium mb-3 flex items-center gap-2" style={{ color: 'var(--theme-text-sub)' }}>
          <Palette size={14} /> Theme
        </div>
        <div className="flex gap-2 flex-wrap">
          {themeNames.map((name) => (
            <motion.button
              key={name}
              whileTap={{ scale: 0.9 }}
              onClick={() => setTheme(name)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium"
              style={{
                backgroundColor: theme === name ? THEMES[name].primary + '20' : 'var(--theme-surface-container)',
                color: theme === name ? THEMES[name].primary : 'var(--theme-text-sub)',
                border: theme === name ? `2px solid ${THEMES[name].primary}` : '2px solid transparent',
              }}
            >
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: THEMES[name].primary }} />
              {name}
            </motion.button>
          ))}
        </div>
      </SectionCard>

      {/* Font Style */}
      <SectionCard>
        <div className="text-xs font-medium mb-3 flex items-center gap-2" style={{ color: 'var(--theme-text-sub)' }}>
          <Type size={14} /> Font Style
        </div>
        <div className="flex gap-2">
          {fontOptions.map((f) => (
            <motion.button
              key={f}
              whileTap={{ scale: 0.95 }}
              onClick={() => setFont(f)}
              className="flex-1 py-2.5 rounded-xl text-xs font-medium"
              style={{
                backgroundColor: font === f ? 'var(--theme-primary)' : 'var(--theme-surface-container)',
                color: font === f ? 'var(--theme-on-primary)' : 'var(--theme-text-sub)',
                fontFamily: f === 'Serif' ? 'serif' : f === 'Monospace' ? 'monospace' : 'sans-serif',
              }}
            >
              {f}
            </motion.button>
          ))}
        </div>
      </SectionCard>

      {/* Chat Wallpaper (Feature 7 enhanced) */}
      <SectionCard>
        <div className="text-xs font-medium mb-3 flex items-center gap-2" style={{ color: 'var(--theme-text-sub)' }}>
          <ImageIcon size={14} /> Chat Wallpaper
        </div>
        {/* Preview */}
        <div
          className="h-20 rounded-2xl flex items-center justify-center cursor-pointer mb-3 relative overflow-hidden"
          style={{ background: chatWallpaper ? `url(${chatWallpaper}) center/cover` : 'var(--theme-surface-container)' }}
          onClick={() => {
            const url = prompt('Enter wallpaper URL (or leave empty to reset):');
            if (url !== null) setChatWallpaper(url);
          }}
        >
          {chatWallpaper && <div className="absolute inset-0 bg-black/20" />}
          {!chatWallpaper && (
            <span className="text-xs" style={{ color: 'var(--theme-text-sub)' }}>Tap to set wallpaper URL</span>
          )}
        </div>
        {chatWallpaper && (
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setChatWallpaper('')}
            className="w-full py-2 rounded-xl text-xs font-medium"
            style={{ backgroundColor: 'var(--theme-surface-container)', color: 'var(--theme-text-sub)' }}
          >
            Remove Wallpaper
          </motion.button>
        )}
      </SectionCard>

      {/* AI API Key */}
      <SectionCard>
        <div className="text-xs font-medium mb-3 flex items-center gap-2" style={{ color: 'var(--theme-text-sub)' }}>
          <Key size={14} /> AI API Key
        </div>
        <input
          type="password"
          value={aiApiKey}
          onChange={(e) => setAiApiKey(e.target.value)}
          placeholder="Enter your AI API key"
          className="w-full p-3 rounded-2xl border text-sm"
          style={{ borderColor: 'var(--theme-primary-container)', color: 'var(--theme-text-main)', backgroundColor: 'var(--theme-surface-container)' }}
        />
      </SectionCard>

      {/* Notifications */}
      <SectionCard>
        <div className="text-xs font-medium mb-3 flex items-center gap-2" style={{ color: 'var(--theme-text-sub)' }}>
          <Bell size={14} /> Notifications
        </div>
        <div className="space-y-3">
          {notifKeys.map(({ key, label, icon: Icon }) => (
            <div key={key} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon size={14} style={{ color: 'var(--theme-text-sub)' }} />
                <span className="text-sm" style={{ color: 'var(--theme-text-main)' }}>{label}</span>
              </div>
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => setNotificationSettings({ ...notificationSettings, [key]: !notificationSettings[key] })}
                className="w-11 h-6 rounded-full p-0.5 transition-colors"
                style={{ backgroundColor: notificationSettings[key] ? 'var(--theme-primary)' : 'var(--theme-surface-container)' }}
              >
                <motion.div
                  className="w-5 h-5 rounded-full bg-white shadow-sm"
                  animate={{ x: notificationSettings[key] ? 20 : 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              </motion.button>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Data & Cloud */}
      <SectionCard>
        <div className="text-xs font-medium mb-3 flex items-center gap-2" style={{ color: 'var(--theme-text-sub)' }}>
          <Cloud size={14} /> Data & Cloud
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm" style={{ color: 'var(--theme-text-main)' }}>Auto Sync</span>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => setAutoSync(!autoSync)}
              className="w-11 h-6 rounded-full p-0.5 transition-colors"
              style={{ backgroundColor: autoSync ? 'var(--theme-primary)' : 'var(--theme-surface-container)' }}
            >
              <motion.div
                className="w-5 h-5 rounded-full bg-white shadow-sm"
                animate={{ x: autoSync ? 20 : 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            </motion.button>
          </div>
          <motion.button
            whileTap={{ scale: 0.95 }}
            className="w-full py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2"
            style={{ backgroundColor: 'var(--theme-surface-container)', color: 'var(--theme-text-sub)' }}
          >
            <RefreshCw size={14} /> Force Sync
          </motion.button>
        </div>
      </SectionCard>

      {/* Security (Feature 12 enhanced) */}
      <SectionCard>
        <div className="text-xs font-medium mb-3 flex items-center gap-2" style={{ color: 'var(--theme-text-sub)' }}>
          <ShieldCheck size={14} /> Security & Encryption
        </div>
        
        {/* Encryption Toggle */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <span className="text-sm font-medium flex items-center gap-1.5" style={{ color: 'var(--theme-text-main)' }}>
              {encryptionEnabled ? <Lock size={14} style={{ color: 'var(--theme-primary)' }} /> : <Shield size={14} />}
              End-to-End Encryption
            </span>
            <div className="text-xs mt-0.5" style={{ color: 'var(--theme-text-sub)' }}>
              {encryptionEnabled ? '🔒 Messages are encrypted with AES-256' : '⚠️ Messages are stored in plain text'}
            </div>
          </div>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => setEncryptionEnabled(!encryptionEnabled)}
            className="w-11 h-6 rounded-full p-0.5 transition-colors"
            style={{ backgroundColor: encryptionEnabled ? 'var(--theme-primary)' : 'var(--theme-surface-container)' }}
          >
            <motion.div
              className="w-5 h-5 rounded-full bg-white shadow-sm"
              animate={{ x: encryptionEnabled ? 20 : 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            />
          </motion.button>
        </div>

        {/* Encryption Key Input */}
        {encryptionEnabled && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-2"
          >
            <div className="text-xs" style={{ color: 'var(--theme-text-sub)' }}>
              Enter a shared secret key. Both partners must use the same key to read messages.
            </div>
            <input
              type="password"
              value={encryptionKey}
              onChange={(e) => setEncryptionKey(e.target.value)}
              placeholder="Enter encryption key..."
              className="w-full px-3 py-2 rounded-xl text-sm border"
              style={{
                borderColor: encryptionKey ? 'var(--theme-primary)' : 'var(--theme-primary-container)',
                color: 'var(--theme-text-main)',
                backgroundColor: 'var(--theme-surface-container)',
              }}
            />
            {encryptionKey ? (
              <div className="text-xs flex items-center gap-1" style={{ color: '#10B981' }}>
                <CheckCircle2 size={12} /> Key set — messages will be encrypted
              </div>
            ) : (
              <div className="text-xs flex items-center gap-1" style={{ color: '#F59E0B' }}>
                <Shield size={12} /> Set a key to activate encryption
              </div>
            )}
            <div className="text-xs" style={{ color: 'var(--theme-text-sub)' }}>
              💡 Tip: Use your vault code as the key, or any shared password only you two know.
            </div>
          </motion.div>
        )}

        {/* Security Info */}
        <div className="mt-3 p-3 rounded-xl text-xs space-y-1" style={{ backgroundColor: 'var(--theme-surface-container)', color: 'var(--theme-text-sub)' }}>
          <div className="flex items-center gap-1.5">
            <Shield size={12} /> Data stored in IndexedDB (survives refresh)
          </div>
          <div className="flex items-center gap-1.5">
            <Lock size={12} /> Server-side backup in SQLite database
          </div>
          <div className="flex items-center gap-1.5">
            <Bell size={12} /> Rate-limited Socket.IO connection
          </div>
          <div className="flex items-center gap-1.5">
            <Eye size={12} /> File uploads validated (type + size limits)
          </div>
        </div>
      </SectionCard>

      {/* Storage Management */}
      <SectionCard>
        <div className="text-xs font-medium mb-3 flex items-center gap-2" style={{ color: 'var(--theme-text-sub)' }}>
          <Cloud size={14} /> Storage
        </div>
        <StorageInfo vaultId={vaultId} messageCount={messages.filter(m => !m.deleted).length} />
      </SectionCard>

      {/* Reset / Sign Out */}
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={() => setShowReset(true)}
        className="w-full py-3 rounded-2xl text-sm font-semibold"
        style={{ backgroundColor: '#FEE2E2', color: '#DC2626' }}
      >
        Reset All Data
      </motion.button>

      <div className="h-4" />

      {/* Reset Confirmation */}
      <Modal open={showReset} onClose={() => setShowReset(false)} title="Reset Data">
        <div className="p-4 space-y-4">
          <p className="text-sm" style={{ color: 'var(--theme-text-main)' }}>
            This will reset all your data including messages, memories, and settings. This action cannot be undone.
          </p>
          <div className="flex gap-2">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowReset(false)}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium"
              style={{ backgroundColor: 'var(--theme-surface-container)', color: 'var(--theme-text-sub)' }}
            >
              Cancel
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => { resetApp(); setShowReset(false); }}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white"
              style={{ backgroundColor: '#DC2626' }}
            >
              Reset
            </motion.button>
          </div>
        </div>
      </Modal>

      {/* Edit Name Modals */}
      <Modal open={editingBatmanName} onClose={() => setEditingBatmanName(false)} title="Edit Name">
        <div className="p-4 space-y-4">
          <input
            value={batmanNameVal}
            onChange={(e) => setBatmanNameVal(e.target.value)}
            className="w-full p-3 rounded-2xl border text-sm"
            style={{ borderColor: 'var(--theme-primary-container)', color: 'var(--theme-text-main)', backgroundColor: 'var(--theme-surface-container)' }}
          />
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => { setBatmanName(batmanNameVal); setEditingBatmanName(false); }}
            className="w-full py-3 rounded-2xl font-semibold text-white"
            style={{ backgroundColor: 'var(--theme-primary)' }}
          >
            Save
          </motion.button>
        </div>
      </Modal>

      <Modal open={editingPrincessName} onClose={() => setEditingPrincessName(false)} title="Edit Name">
        <div className="p-4 space-y-4">
          <input
            value={princessNameVal}
            onChange={(e) => setPrincessNameVal(e.target.value)}
            className="w-full p-3 rounded-2xl border text-sm"
            style={{ borderColor: 'var(--theme-primary-container)', color: 'var(--theme-text-main)', backgroundColor: 'var(--theme-surface-container)' }}
          />
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => { setPrincessName(princessNameVal); setEditingPrincessName(false); }}
            className="w-full py-3 rounded-2xl font-semibold text-white"
            style={{ backgroundColor: 'var(--theme-primary)' }}
          >
            Save
          </motion.button>
        </div>
      </Modal>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   STORAGE INFO COMPONENT
   ═══════════════════════════════════════════════════════ */
function StorageInfo({ vaultId, messageCount }: { vaultId: string; messageCount: number }) {
  const [storageUsage, setStorageUsage] = useState<{ usage: number; quota: number }>({ usage: 0, quota: 0 });
  const [idbStats, setIdbStats] = useState<{ messageCount: number; aiChatCount: number; mediaCount: number }>({ messageCount: 0, aiChatCount: 0, mediaCount: 0 });
  const [cleanupDays, setCleanupDays] = useState(90);
  const [cleanupResult, setCleanupResult] = useState<string | null>(null);
  const [cleaning, setCleaning] = useState(false);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const estimate = await getStorageEstimate();
        setStorageUsage(estimate);
      } catch {}
      try {
        const stats = await getStorageStats(vaultId);
        setIdbStats(stats);
      } catch {}
    };
    loadStats();
  }, [vaultId, messageCount]);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const handleCleanup = async () => {
    setCleaning(true);
    setCleanupResult(null);
    try {
      const deleted = await clearOldMessages(vaultId, cleanupDays);
      setCleanupResult(`Deleted ${deleted} messages older than ${cleanupDays} days`);
      // Refresh stats
      const stats = await getStorageStats(vaultId);
      setIdbStats(stats);
    } catch {
      setCleanupResult('Failed to clean up messages');
    }
    setCleaning(false);
  };

  const handleClearMedia = async () => {
    setCleaning(true);
    setCleanupResult(null);
    try {
      const deleted = await clearMediaCache(vaultId);
      setCleanupResult(`Cleared ${deleted} media files from cache`);
      const stats = await getStorageStats(vaultId);
      setIdbStats(stats);
    } catch {
      setCleanupResult('Failed to clear media cache');
    }
    setCleaning(false);
  };

  const usagePercent = storageUsage.quota > 0 ? Math.round((storageUsage.usage / storageUsage.quota) * 100) : 0;

  return (
    <div className="space-y-3">
      {/* Storage Stats */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm" style={{ color: 'var(--theme-text-main)' }}>Messages</span>
          <span className="text-sm font-medium" style={{ color: 'var(--theme-text-sub)' }}>{idbStats.messageCount}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm" style={{ color: 'var(--theme-text-main)' }}>Media Files</span>
          <span className="text-sm font-medium" style={{ color: 'var(--theme-text-sub)' }}>{idbStats.mediaCount}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm" style={{ color: 'var(--theme-text-main)' }}>AI Chat Entries</span>
          <span className="text-sm font-medium" style={{ color: 'var(--theme-text-sub)' }}>{idbStats.aiChatCount}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm" style={{ color: 'var(--theme-text-main)' }}>Storage Used</span>
          <span className="text-sm font-medium" style={{ color: 'var(--theme-text-sub)' }}>{formatBytes(storageUsage.usage)}</span>
        </div>
        {storageUsage.quota > 0 && (
          <div className="w-full h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--theme-surface-container)' }}>
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.min(usagePercent, 100)}%`,
                backgroundColor: usagePercent > 80 ? '#EF4444' : usagePercent > 50 ? '#F59E0B' : 'var(--theme-primary)',
              }}
            />
          </div>
        )}
        {storageUsage.quota > 0 && (
          <div className="text-xs text-center" style={{ color: 'var(--theme-text-sub)' }}>
            {usagePercent}% of {formatBytes(storageUsage.quota)} used
          </div>
        )}
      </div>

      {/* Cleanup Controls */}
      <div className="pt-2 border-t" style={{ borderColor: 'var(--theme-primary-container)' }}>
        <div className="text-xs font-medium mb-2" style={{ color: 'var(--theme-text-sub)' }}>Cleanup</div>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm" style={{ color: 'var(--theme-text-main)' }}>Delete messages older than</span>
          <select
            value={cleanupDays}
            onChange={(e) => setCleanupDays(Number(e.target.value))}
            className="px-2 py-1 rounded-lg text-sm border"
            style={{ borderColor: 'var(--theme-primary-container)', color: 'var(--theme-text-main)', backgroundColor: 'var(--theme-surface-container)' }}
          >
            <option value={30}>30 days</option>
            <option value={60}>60 days</option>
            <option value={90}>90 days</option>
            <option value={180}>180 days</option>
            <option value={365}>1 year</option>
          </select>
        </div>
        <div className="flex gap-2">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleCleanup}
            disabled={cleaning}
            className="flex-1 py-2.5 rounded-xl text-xs font-medium flex items-center justify-center gap-1"
            style={{ backgroundColor: 'var(--theme-surface-container)', color: 'var(--theme-text-sub)', opacity: cleaning ? 0.5 : 1 }}
          >
            <Trash2 size={14} /> {cleaning ? 'Cleaning...' : 'Clean Old Messages'}
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleClearMedia}
            disabled={cleaning}
            className="flex-1 py-2.5 rounded-xl text-xs font-medium flex items-center justify-center gap-1"
            style={{ backgroundColor: 'var(--theme-surface-container)', color: 'var(--theme-text-sub)', opacity: cleaning ? 0.5 : 1 }}
          >
            <FileText size={14} /> {cleaning ? 'Clearing...' : 'Clear Media Cache'}
          </motion.button>
        </div>
        {cleanupResult && (
          <div className="mt-2 text-xs text-center" style={{ color: 'var(--theme-primary)' }}>
            {cleanupResult}
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   BOTTOM NAVIGATION
   ═══════════════════════════════════════════════════════ */
function BottomNav() {
  const currentTab = useAppStore((s) => s.currentTab);
  const setTab = useAppStore((s) => s.setTab);
  const setChatOpen = useAppStore((s) => s.setChatOpen);
  const theme = useAppStore((s) => s.theme);
  const chatOpen = useAppStore((s) => s.chatOpen);
  const tabs: { key: TabName; icon: React.ElementType; label: string }[] = [
    { key: 'home', icon: Home, label: 'Home' },
    { key: 'chat', icon: MessageCircle, label: 'Chat' },
    { key: 'memories', icon: ImageIcon, label: 'Memories' },
    { key: 'sanctuary', icon: Sparkles, label: 'Sanctuary' },
    { key: 'settings', icon: Settings, label: 'Settings' },
  ];

  const isDark = ['Dracula', 'Midnight'].includes(theme);

  return (
    <div className="shrink-0 safe-bottom">
      <div
        className="mx-3 mb-2 rounded-3xl flex items-center justify-around py-2 px-1 shadow-xl"
        style={{
          backgroundColor: isDark ? 'rgba(40,42,54,0.88)' : 'rgba(255,255,255,0.82)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.04)',
        }}
      >
        {tabs.map(({ key, icon: Icon, label }) => {
          const active = currentTab === key;
          return (
            <motion.button
              key={key}
              whileTap={{ scale: 0.85 }}
              onClick={() => { setTab(key); if (key === 'chat') setChatOpen(false); }}
              className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-2xl transition-colors min-w-[56px]"
              style={{
                backgroundColor: active ? 'var(--theme-primary)' : 'transparent',
                color: active ? 'var(--theme-on-primary)' : 'var(--theme-text-sub)',
              }}
            >
              <Icon size={20} />
              <span className="text-[10px] font-medium">{label}</span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   MAIN APP
   ═══════════════════════════════════════════════════════ */
export default function SanctuaryApp() {
  const setupComplete = useAppStore((s) => s.setupComplete);
  const currentTab = useAppStore((s) => s.currentTab);
  const chatOpen = useAppStore((s) => s.chatOpen);
  const font = useAppStore((s) => s.font);
  const daysTogether = useAppStore((s) => s.daysTogether);
  const hasHydrated = useAppStore((s) => s._hasHydrated);

  useThemeCSS();
  const socketIO = useSocketIO();
  const dataLoadedRef = useRef(false);

  // Expose socketIO globally so components without direct access (GameTab, VaultTab, etc.) can emit events
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__sanctuarySocket = socketIO;
    }
  }, [socketIO]);

  // Detect Zustand persist hydration completion.
  // We use store.subscribe() + persist.hasHydrated() instead of onRehydrateStorage
  // because onRehydrateStorage runs during create() and causes a TDZ error
  // ("Cannot access 'lb' before initialization") in production builds.
  useEffect(() => {
    const api = useAppStore.persist;
    if (api.hasHydrated()) {
      useAppStore.setState({ _hasHydrated: true });
      return;
    }
    const unsub = api.onFinishHydration(() => {
      useAppStore.setState({ _hasHydrated: true });
    });
    return unsub;
  }, []);

  // Safety timeout: force hydration complete after 3s so the app never hangs forever
  useEffect(() => {
    if (hasHydrated) return;
    const timer = setTimeout(() => {
      if (!useAppStore.getState()._hasHydrated) {
        console.warn('[App] Hydration timeout — forcing _hasHydrated = true');
        useAppStore.setState({ _hasHydrated: true });
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, [hasHydrated]);

  // Load data from server + IndexedDB ONCE on mount when setupComplete
  // Use useAppStore.getState() to avoid dependency on store functions
  useEffect(() => {
    if (setupComplete && !dataLoadedRef.current) {
      dataLoadedRef.current = true;
      const state = useAppStore.getState();
      state.loadFromIDB().catch(() => {});
      state.loadFromServer().catch(() => {});
    }
  }, [setupComplete]);

  // Listen for service worker notification click messages
  useEffect(() => {
    if (!setupComplete) return;
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'NAVIGATE_TAB' && event.data.tab) {
        const tab = event.data.tab as TabName;
        useAppStore.getState().setTab(tab);
        if (tab === 'chat') {
          useAppStore.getState().setChatOpen(true);
        }
        window.focus();
      }
    };
    navigator.serviceWorker?.addEventListener('message', handler);
    return () => {
      navigator.serviceWorker?.removeEventListener('message', handler);
    };
  }, [setupComplete]);

  // Don't render anything until Zustand persist has hydrated from localStorage
  // This prevents flash of SetupScreen and hydration mismatches
  if (!hasHydrated) {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #FF6B9D 0%, #C44569 50%, #8E2D5B 100%)' }}>
        <div className="text-center">
          <div className="text-5xl mb-4">💕</div>
          <div className="w-8 h-8 border-3 border-white border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  // Show setup screen if not complete
  if (!setupComplete) {
    return <SetupScreen />;
  }

  const fontFamily = font === 'Serif' ? '"Playfair Display", serif' : font === 'Monospace' ? '"JetBrains Mono", monospace' : 'system-ui, sans-serif';

  const renderScreen = () => {
    switch (currentTab) {
      case 'home': return <HomeScreen />;
      case 'chat': return <ChatScreen socketIO={socketIO} />;
      case 'memories': return <MemoriesScreen />;
      case 'sanctuary': return <SanctuaryScreen />;
      case 'settings': return <SettingsScreen />;
      default: return <HomeScreen />;
    }
  };

  return (
    <div
      className="fixed inset-0 flex flex-col overflow-hidden"
      style={{
        backgroundColor: 'var(--theme-bg)',
        color: 'var(--theme-on-bg)',
        fontFamily,
      }}
    >
      {/* Header — hidden when chat conversation is open */}
      {!(chatOpen && currentTab === 'chat') && (
        <div
          className="shrink-0 px-4 pt-3 pb-2 safe-top flex items-center justify-between"
          style={{ backgroundColor: 'var(--theme-bg)' }}
        >
          <div className="flex items-center gap-2">
            <span className="text-lg" style={{ color: 'var(--theme-primary)' }}>💕</span>
            <h1 className="text-lg font-bold" style={{ color: 'var(--theme-text-main)' }}>Our Sanctuary</h1>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock size={14} style={{ color: 'var(--theme-text-sub)' }} />
            <span className="text-xs" style={{ color: 'var(--theme-text-sub)' }}>
              {daysTogether} days
            </span>
          </div>
        </div>
      )}

      {/* Screen Content */}
      <div className={`flex-1 overscroll-contain ${chatOpen && currentTab === 'chat' ? 'flex flex-col overflow-hidden' : 'overflow-y-auto'}`}>
        <AnimatePresence mode="wait">
          <motion.div
            key={currentTab + (chatOpen ? '-chat-open' : '')}
            variants={pageVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className={chatOpen && currentTab === 'chat' ? 'flex-1 flex flex-col overflow-hidden' : ''}
          >
            {renderScreen()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom Navigation — slides away when chat conversation is open */}
      <AnimatePresence>
        {!(chatOpen && currentTab === 'chat') && (
          <motion.div
            key="bottom-nav"
            initial={{ y: 0 }}
            animate={{ y: 0 }}
            exit={{ y: 80 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
          >
            <BottomNav />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
