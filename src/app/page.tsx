'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  Share, Bookmark, MessageSquare, Search
} from 'lucide-react';
import { useAppStore, type TabName, type SanctuarySubTab } from '@/lib/sanctuary-store';
import { THEMES, type ThemeName, type FontStyle } from '@/lib/themes';

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

/* ═══════════════════════════════════════════════════════
   HOME SCREEN
   ═══════════════════════════════════════════════════════ */
function HomeScreen() {
  const store = useAppStore();
  const [editingDate, setEditingDate] = useState(false);
  const [dateValue, setDateValue] = useState(store.relationshipStartDate.split('T')[0]);
  const [activeSignal, setActiveSignal] = useState<{ type: string; x: number; y: number } | null>(null);

  const myName = store.identity === 'Batman' ? store.batmanName : store.princessName;
  const partnerName = store.identity === 'Batman' ? store.princessName : store.batmanName;
  const myPhoto = store.identity === 'Batman' ? store.batmanPhoto : store.princessPhoto;
  const partnerPhoto = store.identity === 'Batman' ? store.princessPhoto : store.batmanPhoto;
  const myMood = store.moods.find((m) => m.userId === store.identity);
  const partnerMood = store.moods.find((m) => m.userId !== store.identity);

  const moods = ['😊', '💖', '😴', '🥺', '😈'];

  const handleSignal = (type: 'miss' | 'hug' | 'kiss', e: React.MouseEvent) => {
    store.sendSignal(type);
    setActiveSignal({ type, x: e.clientX, y: e.clientY });
    setTimeout(() => setActiveSignal(null), 800);
  };

  const handleDateSave = () => {
    store.setRelationshipStartDate(new Date(dateValue).toISOString());
    setEditingDate(false);
  };

  const revealedMemories = store.memoryEntries.filter(
    (m) => m.revealDate && new Date(m.revealDate) <= new Date()
  );

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
          key={store.daysTogether}
          initial={{ scale: 1.2 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200 }}
        >
          {store.daysTogether}
        </motion.div>
        <div className="text-sm font-medium mt-1" style={{ color: 'var(--theme-text-sub)' }}>
          Days Together
        </div>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => { setDateValue(store.relationshipStartDate.split('T')[0]); setEditingDate(true); }}
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
            <ProfileAvatar name={myName} photo={myPhoto} size={72} />
            <span className="text-sm font-semibold" style={{ color: 'var(--theme-text-main)' }}>{myName}</span>
          </div>
          <motion.div
            className="animate-pulse-heart text-3xl"
            style={{ color: 'var(--theme-primary)' }}
          >
            ❤️
          </motion.div>
          <div className="flex flex-col items-center gap-2">
            <ProfileAvatar name={partnerName} photo={partnerPhoto} size={72} />
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
              {moods.map((m) => (
                <motion.button
                  key={m}
                  whileTap={{ scale: 0.85 }}
                  className={`text-lg p-1 rounded-lg ${myMood?.mood === m ? 'ring-2' : ''}`}
                  style={myMood?.mood === m ? { outline: '2px solid var(--theme-primary)' } : {}}
                  onClick={() => {
                    store.setMoods(
                      store.moods.map((entry) =>
                        entry.userId === store.identity ? { ...entry, mood: m, timestamp: new Date().toISOString() } : entry
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
        {store.signals.length > 0 && (
          <div className="mt-3 space-y-1.5 max-h-24 overflow-y-auto">
            {store.signals.slice(-3).map((s, i) => (
              <div key={i} className="text-xs flex items-center gap-2 px-2 py-1 rounded-xl" style={{ backgroundColor: 'var(--theme-primary-container)', color: 'var(--theme-on-primary-container)' }}>
                <span>{signalEmojis[s.type]}</span>
                <span className="font-medium">{s.from === store.identity ? myName : partnerName}</span>
                <span>sent &quot;{signalLabels[s.type]}&quot;</span>
                <span className="ml-auto opacity-60">{timeAgo(s.timestamp)}</span>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Time Capsule Banner */}
      <AnimatePresence>
        {revealedMemories.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="rounded-3xl p-4 shadow-lg text-white"
            style={{ background: `linear-gradient(135deg, var(--theme-primary), ${THEMES[store.theme].accent})` }}
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
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   CHAT SCREEN
   ═══════════════════════════════════════════════════════ */

/* ─── Voice Message Playback Component ────────────── */
function VoiceMessageBubble({ url, duration, isSent }: { url: string; duration?: number; isSent: boolean }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(duration || 0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animFrameRef = useRef<number>(0);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      cancelAnimationFrame(animFrameRef.current);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
      const tick = () => {
        if (audioRef.current) {
          setPlaybackTime(audioRef.current.currentTime);
          animFrameRef.current = requestAnimationFrame(tick);
        }
      };
      tick();
    }
  };

  const formatDur = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const progress = totalDuration > 0 ? playbackTime / totalDuration : 0;
  const WAVE_BARS = 28;
  const barHeights = useRef(Array.from({ length: WAVE_BARS }, () => 0.3 + Math.random() * 0.7));

  return (
    <div className="flex items-center gap-2.5 py-1 min-w-[180px]">
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={togglePlay}
        className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
        style={{ backgroundColor: isSent ? 'rgba(255,255,255,0.2)' : 'var(--theme-primary)', color: isSent ? 'white' : 'var(--theme-on-primary)' }}
      >
        {isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" className="ml-0.5" />}
      </motion.button>
      <div className="flex-1 flex flex-col gap-1">
        <div className="flex items-end gap-[2px] h-6">
          {barHeights.current.map((h, i) => {
            const filled = i / WAVE_BARS <= progress;
            return (
              <div
                key={i}
                className="w-[3px] rounded-full transition-all duration-150"
                style={{
                  height: `${h * 100}%`,
                  backgroundColor: filled
                    ? (isSent ? 'rgba(255,255,255,0.9)' : 'var(--theme-primary)')
                    : (isSent ? 'rgba(255,255,255,0.25)' : 'var(--theme-primary-container)'),
                }}
              />
            );
          })}
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[10px] opacity-60 font-medium">{formatDur(isPlaying ? playbackTime : (totalDuration || 0))}</span>
          <Volume2 size={10} className="opacity-40" />
        </div>
      </div>
      <audio
        ref={audioRef}
        src={url}
        onLoadedMetadata={(e) => setTotalDuration(e.currentTarget.duration)}
        onEnded={() => { setIsPlaying(false); setPlaybackTime(0); cancelAnimationFrame(animFrameRef.current); }}
        className="hidden"
      />
    </div>
  );
}

function ChatScreen() {
  const store = useAppStore();
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
  const [partnerTyping, setPartnerTyping] = useState(false);

  // ─── Voice Recording State ───────────────────────────
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordingWaveform, setRecordingWaveform] = useState<number[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const waveformIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // ─── Message Selection State ─────────────────────────
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const longPressFiredRef = useRef(false);

  const myName = store.identity === 'Batman' ? store.batmanName : store.princessName;
  const partnerName = store.identity === 'Batman' ? store.princessName : store.batmanName;
  const myPhoto = store.identity === 'Batman' ? store.batmanPhoto : store.princessPhoto;
  const partnerPhoto = store.identity === 'Batman' ? store.princessPhoto : store.batmanPhoto;

  const activeMessages = store.messages.filter((m) => !m.deleted);
  const isSelectionMode = store.isSelectionMode;
  const selectedMessages = store.selectedMessages;

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [store.messages.length]);

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
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.start(100); // collect data every 100ms for live visualization
      setIsRecording(true);
      setRecordingTime(0);
      setRecordingWaveform([]);

      // Timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);

      // Simulated waveform visualization
      waveformIntervalRef.current = setInterval(() => {
        setRecordingWaveform((prev) => {
          const newBar = 0.2 + Math.random() * 0.8;
          const next = [...prev, newBar];
          return next.length > 40 ? next.slice(-40) : next;
        });
      }, 120);
    } catch (err) {
      console.error('Recording start failed:', err);
    }
  }, []);

  const stopVoiceRecording = useCallback((send: boolean) => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
      setIsRecording(false);
      return;
    }

    const mr = mediaRecorderRef.current;

    if (send) {
      mr.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(audioBlob);
        const msg = {
          id: Date.now(),
          type: 'sent' as const,
          senderId: store.identity,
          audio: url,
          audioDuration: recordingTime,
          time: new Date().toISOString(),
          status: 'sent' as const,
          replyTo: store.replyingTo ? {
            id: store.replyingTo.id,
            text: store.replyingTo.text?.slice(0, 50),
            sender: store.replyingTo.senderId === store.identity ? myName : partnerName,
          } : undefined,
        };
        store.addMessage(msg);
        store.setReplyingTo(null);
        mr.stream.getTracks().forEach((track) => track.stop());
      };
      mr.stop();
    } else {
      mr.onstop = () => {
        mr.stream.getTracks().forEach((track) => track.stop());
      };
      mr.stop();
    }

    setIsRecording(false);
    setRecordingTime(0);
    setRecordingWaveform([]);
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    if (waveformIntervalRef.current) clearInterval(waveformIntervalRef.current);
  }, [recordingTime, store, myName, partnerName]);

  const cancelVoiceRecording = useCallback(() => {
    stopVoiceRecording(false);
  }, [stopVoiceRecording]);

  // ─── Send Message ────────────────────────────────────
  const sendMessage = () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    const msgId = Date.now();
    const msg = {
      id: msgId,
      type: 'sent' as const,
      senderId: store.identity,
      text: trimmed,
      time: new Date().toISOString(),
      status: 'sent' as const,
      replyTo: store.replyingTo ? {
        id: store.replyingTo.id,
        text: store.replyingTo.text?.slice(0, 50),
        sender: store.replyingTo.senderId === store.identity ? myName : partnerName,
      } : undefined,
    };
    store.addMessage(msg);
    setInput('');
    store.setReplyingTo(null);
    setShowEmoji(false);

    // Simulate delivery and partner reply
    setTimeout(() => {
      const currentMessages = useAppStore.getState().messages;
      useAppStore.getState().setMessages(
        currentMessages.map((m) =>
          m.id === msgId ? { ...m, status: 'received' as const } : m
        )
      );
    }, 1000);
    // Show partner typing indicator
    setTimeout(() => {
      setPartnerTyping(true);
    }, 1500);
    setTimeout(() => {
      const currentMessages = useAppStore.getState().messages;
      useAppStore.getState().setMessages(
        currentMessages.map((m) =>
          m.id === msgId ? { ...m, status: 'seen' as const } : m
        )
      );
      setPartnerTyping(false);
      const replies = [
        'That sounds wonderful! 💕',
        'I love that idea! ✨',
        'You always make me smile 🥰',
        'Can\'t wait! 💖',
        'You\'re the best! 🌟',
        'Aww, that\'s so sweet 😘',
      ];
      store.addMessage({
        id: Date.now() + 1,
        type: 'received',
        senderId: store.identity === 'Batman' ? 'Princess' : 'Batman',
        text: replies[Math.floor(Math.random() * replies.length)],
        time: new Date().toISOString(),
        status: 'seen',
      });
    }, 2500);
  };

  // ─── Message Touch Handlers ──────────────────────────
  const handleTouchStart = (msgId: number, e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    longPressFiredRef.current = false;
    setSwipingId(msgId);

    // Long press to enter selection mode
    if (!isSelectionMode) {
      longPressTimerRef.current = setTimeout(() => {
        longPressFiredRef.current = true;
        store.toggleSelectMessage(msgId);
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
      const msg = store.messages.find((m) => m.id === swipingId);
      if (msg) store.setReplyingTo(msg);
    }
    setSwipingId(null);
    setSwipeX(0);
  };

  // ─── Mouse-based Long Press (Desktop Support) ─────────
  const mouseStartX = useRef(0);
  const mouseSwipingId = useRef<number | null>(null);
  const mouseLongPressFired = useRef(false);
  const mouseLongPressTimer = useRef<NodeJS.Timeout | null>(null);

  const handleMouseDown = (msgId: number, e: React.MouseEvent) => {
    // Only handle left mouse button
    if (e.button !== 0) return;
    mouseStartX.current = e.clientX;
    mouseSwipingId.current = msgId;
    mouseLongPressFired.current = false;
    setSwipingId(msgId);

    if (!isSelectionMode) {
      mouseLongPressTimer.current = setTimeout(() => {
        mouseLongPressFired.current = true;
        longPressFiredRef.current = true;
        store.toggleSelectMessage(msgId);
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
      const msg = store.messages.find((m) => m.id === swipingId);
      if (msg) store.setReplyingTo(msg);
    }
    setSwipingId(null);
    setSwipeX(0);
    mouseSwipingId.current = null;
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
      longPressFiredRef.current = false;
      mouseLongPressFired.current = false;
      return;
    }
    if (isSelectionMode) {
      store.toggleSelectMessage(msgId);
    }
  };

  // ─── Context Menu Actions ────────────────────────────
  const handleCopySelected = () => {
    const texts = store.messages
      .filter((m) => selectedMessages.includes(m.id) && m.text)
      .map((m) => m.text);
    if (texts.length > 0) {
      navigator.clipboard.writeText(texts.join('\n')).catch(() => {});
    }
    store.exitSelectionMode();
  };

  const handleReplyToSelected = () => {
    if (selectedMessages.length === 1) {
      const msg = store.messages.find((m) => m.id === selectedMessages[0]);
      if (msg) store.setReplyingTo(msg);
    }
    store.exitSelectionMode();
  };

  const handleStarSelected = () => {
    selectedMessages.forEach((id) => store.starMessage(id));
    store.exitSelectionMode();
  };

  const handleDeleteSelected = () => {
    store.deleteSelectedMessages();
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
  if (!store.chatOpen) {
    return (
      <div className="px-4 pb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold" style={{ color: 'var(--theme-text-main)' }}>Messages</h2>
        </div>
        <motion.div
          whileTap={{ scale: 0.98 }}
          onClick={() => store.setChatOpen(true)}
          className="rounded-3xl p-4 shadow-sm cursor-pointer"
          style={{ backgroundColor: 'var(--theme-surface)' }}
        >
          <div className="flex items-center gap-3">
            <div className="relative">
              <ProfileAvatar name={partnerName} photo={partnerPhoto} size={52} />
              {store.partnerOnline && (
                <div className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-white bg-green-500" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="font-semibold" style={{ color: 'var(--theme-text-main)' }}>{partnerName}</span>
                <span className="text-xs" style={{ color: 'var(--theme-text-sub)' }}>
                  {store.partnerOnline ? 'Online' : timeAgo(store.partnerLastSeen)}
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
            <motion.button whileTap={{ scale: 0.9 }} onClick={() => store.exitSelectionMode()} className="p-1.5">
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
            <motion.button whileTap={{ scale: 0.9 }} onClick={() => store.setChatOpen(false)}>
              <ChevronLeft size={24} style={{ color: 'var(--theme-primary)' }} />
            </motion.button>
            <div className="relative">
              <ProfileAvatar name={partnerName} photo={partnerPhoto} size={40} />
              {store.partnerOnline && (
                <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 bg-green-500" style={{ borderColor: 'var(--theme-surface)' }} />
              )}
            </div>
            <div className="flex-1">
              <div className="font-semibold text-sm" style={{ color: 'var(--theme-text-main)' }}>{partnerName}</div>
              <div className="text-xs" style={{ color: 'var(--theme-text-sub)' }}>
                {store.partnerOnline ? 'Online now' : `Last seen ${timeAgo(store.partnerLastSeen)}`}
              </div>
            </div>
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
                      onClick={() => { store.setSelectionMode(true); setShowChatMenu(false); }}
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
                      onClick={() => { setShowChatMenu(false); }}
                      className="flex items-center gap-3 px-4 py-3 w-full text-left text-sm hover:bg-black/5 transition-colors"
                      style={{ color: 'var(--theme-on-surface)' }}
                    >
                      <Volume2 size={16} style={{ color: 'var(--theme-primary)' }} /> Mute Notifications
                    </button>
                    <button
                      onClick={() => { setShowChatMenu(false); }}
                      className="flex items-center gap-3 px-4 py-3 w-full text-left text-sm hover:bg-black/5 transition-colors"
                      style={{ color: 'var(--theme-on-surface)' }}
                    >
                      <Palette size={16} style={{ color: 'var(--theme-primary)' }} /> Wallpaper
                    </button>
                    <div className="border-t" style={{ borderColor: 'var(--theme-primary-container)' }} />
                    <button
                      onClick={() => {
                        store.setMessages(store.messages.map((m) => ({ ...m, deleted: true })));
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
          background: store.chatWallpaper ? `url(${store.chatWallpaper}) center/cover` : 'var(--theme-bg)',
        }}
      >
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
              {/* Swipe reply indicator */}
              {swipingId === msg.id && swipeX > 10 && !isSelectionMode && (
                <motion.div
                  className="absolute left-0 top-1/2 -translate-y-1/2 flex items-center"
                  animate={{ x: swipeX - 60 }}
                >
                  <Reply size={16} style={{ color: 'var(--theme-primary)' }} />
                </motion.div>
              )}

              <div className={`flex ${isSent ? 'justify-end' : 'justify-start'} items-end gap-1.5 mb-1`}>
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
                    <div
                      className="text-xs px-3 py-1.5 rounded-t-2xl mb-0.5"
                      style={{
                        backgroundColor: isSent ? 'var(--theme-primary-container)' : 'var(--theme-surface-container)',
                        color: 'var(--theme-on-primary-container)',
                        borderLeft: `3px solid var(--theme-primary)`,
                      }}
                    >
                      <div className="font-semibold" style={{ color: 'var(--theme-primary)' }}>{msg.replyTo.sender}</div>
                      <div className="truncate opacity-70">{msg.replyTo.text}</div>
                    </div>
                  )}

                  <div
                    className={`rounded-2xl px-3.5 py-2.5 text-sm ${isSent ? 'rounded-br-sm' : 'rounded-bl-sm'} transition-all duration-150 ${isSelected ? 'ring-2 scale-[1.02]' : ''}`}
                    style={{
                      backgroundColor: isSent ? 'var(--theme-primary)' : 'var(--theme-surface)',
                      color: isSent ? 'var(--theme-on-primary)' : 'var(--theme-on-surface)',
                      ringColor: isSelected ? 'var(--theme-primary)' : 'transparent',
                    }}
                    onDoubleClick={() => { if (!isSelectionMode) store.addReaction(msg.id, '❤️'); }}
                  >
                    {/* Voice message */}
                    {msg.audio && (
                      <VoiceMessageBubble url={msg.audio} duration={msg.audioDuration} isSent={isSent} />
                    )}
                    {/* Text message */}
                    {msg.text && <span>{msg.text}</span>}
                    <div className={`flex items-center gap-1 mt-1 ${isSent ? 'justify-end' : ''}`}>
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
        {store.replyingTo && (
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
                {store.replyingTo.senderId === store.identity ? myName : partnerName}
              </div>
              <div className="text-xs truncate" style={{ color: 'var(--theme-text-sub)' }}>
                {store.replyingTo.text || (store.replyingTo.audio ? '🎤 Voice message' : '📎 Media')}
              </div>
            </div>
            <button onClick={() => store.setReplyingTo(null)}>
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
              {['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','😊','😇','🥰','😍','🤩','😘','😗','😚','😙','🥲','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🫢','🤫','🤔','🫡','🤐','🤨','😐','😑','😶','🫥','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🥵','🥶','🥴','😵','🤯','🤠','🥳','🥸','😎','🤓','🧐','😕','🫤','😟','🙁','😮','😯','😲','😳','🥺','🥹','😦','😧','😨','😰','😥','😢','😭','😱','😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬','😈','👿','💀','☠️','💩','🤡','👹','👺','👻','👽','👾','🤖','😺','😸','😹','😻','😼','😽','🙀','😿','😾','💋','❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❤️‍🔥','💕','💞','💓','💗','💖','💘','💝','⭐','🌟','✨','💫','🔥','🌸','🌺','🌹','🥀','💐','🍄','🌙','☀️','🌈','🦋','🐱','🐶','🐰','🐻','🦊','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🐔','🐧','🐦','🦄','🐝','🐛','🦋','🐌','🐞','🐜','🪲'].map((emoji) => (
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
                    onChange={(e) => setInput(e.target.value)}
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
                  <ActionButton icon={Camera} label="Photo" color="var(--theme-primary)" onClick={() => setShowAttach(false)} />
                  <ActionButton icon={ImageIcon} label="Gallery" color="#9B59B6" onClick={() => setShowAttach(false)} />
                  <ActionButton icon={Volume2} label="Audio" color="#E67E22" onClick={() => setShowAttach(false)} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
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
                    store.addReaction(showReactions, emoji);
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
          {store.messages.filter((m) => m.starred && !m.deleted).length === 0 ? (
            <div className="text-center py-8">
              <Star size={32} className="mx-auto mb-2 opacity-30" style={{ color: 'var(--theme-text-sub)' }} />
              <p className="text-sm" style={{ color: 'var(--theme-text-sub)' }}>No starred messages yet</p>
              <p className="text-xs mt-1" style={{ color: 'var(--theme-text-sub)' }}>Long-press a message and tap ⭐ to star it</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {store.messages.filter((m) => m.starred && !m.deleted).map((msg) => (
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
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {activeMessages
                .filter((m) => m.text?.toLowerCase().includes(searchQuery.toLowerCase()))
                .map((msg) => (
                  <div
                    key={msg.id}
                    className="rounded-2xl px-3.5 py-2.5 text-sm"
                    style={{
                      backgroundColor: msg.type === 'sent' ? 'var(--theme-primary)' : 'var(--theme-surface)',
                      color: msg.type === 'sent' ? 'var(--theme-on-primary)' : 'var(--theme-on-surface)',
                    }}
                  >
                    {msg.text && <span>{msg.text}</span>}
                    <div className="text-[10px] opacity-60 mt-1">{formatTime(msg.time)}</div>
                  </div>
                ))}
              {activeMessages.filter((m) => m.text?.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                <p className="text-center text-sm py-4" style={{ color: 'var(--theme-text-sub)' }}>No messages found</p>
              )}
            </div>
          ) : (
            <p className="text-center text-sm py-4" style={{ color: 'var(--theme-text-sub)' }}>Type to search messages</p>
          )}
        </div>
      </Modal>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   MEMORIES SCREEN
   ═══════════════════════════════════════════════════════ */
function MemoriesScreen() {
  const store = useAppStore();
  const [showAdd, setShowAdd] = useState(false);
  const [viewMemory, setViewMemory] = useState<string | null>(null);
  const [newText, setNewText] = useState('');
  const [newCategory, setNewCategory] = useState<'General' | 'Joke' | 'Favorite' | 'Date' | 'Important'>('General');
  const [newReminder, setNewReminder] = useState<'none' | '1M' | '1Y'>('none');
  const [newRevealDate, setNewRevealDate] = useState('');

  const addMemory = () => {
    if (!newText.trim()) return;
    store.addMemoryEntry({
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

  const viewingMemory = store.memoryEntries.find((m) => m.id === viewMemory);

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

      {store.memoryEntries.length === 0 ? (
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
          {store.memoryEntries.map((mem, i) => (
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
  const store = useAppStore();
  const subTabs: { key: SanctuarySubTab; label: string; icon: React.ElementType }[] = [
    { key: 'ai', label: 'AI', icon: Sparkles },
    { key: 'dark', label: 'Dark', icon: Moon },
    { key: 'plan', label: 'Plan', icon: Calendar },
    { key: 'vault', label: 'Vault', icon: Lock },
    { key: 'memory', label: 'Memory', icon: Brain },
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
            onClick={() => store.setSanctuarySubTab(key)}
            className="flex-1 flex flex-col items-center gap-0.5 py-2 rounded-xl text-xs font-medium transition-colors"
            style={{
              backgroundColor: store.sanctuarySubTab === key ? 'var(--theme-surface)' : 'transparent',
              color: store.sanctuarySubTab === key ? 'var(--theme-primary)' : 'var(--theme-text-sub)',
              boxShadow: store.sanctuarySubTab === key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            <Icon size={16} />
            {label}
          </motion.button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {store.sanctuarySubTab === 'ai' && <AITab key="ai" />}
        {store.sanctuarySubTab === 'dark' && <DarkTab key="dark" />}
        {store.sanctuarySubTab === 'plan' && <PlanTab key="plan" />}
        {store.sanctuarySubTab === 'vault' && <VaultTab key="vault" />}
        {store.sanctuarySubTab === 'memory' && <MemoryTab key="memory" />}
      </AnimatePresence>
    </div>
  );
}

/* AI Tab */
function AITab() {
  const store = useAppStore();
  const [chatInput, setChatInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const suggestions = [
    { icon: Heart, title: 'Date Night Ideas', desc: 'Get creative date suggestions tailored to you both' },
    { icon: Sparkles, title: 'Love Languages', desc: 'Discover and understand each other\'s love languages' },
    { icon: Flame, title: 'Spice Things Up', desc: 'Fun and flirty ideas to keep the spark alive' },
    { icon: Star, title: 'Appreciation Note', desc: 'AI helps you craft the perfect love note' },
  ];

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [store.sanctuaryChat.length]);

  const sendToAI = async () => {
    if (!chatInput.trim()) return;
    const userMsg = chatInput.trim();
    setChatInput('');
    store.addSanctuaryChatMessage({ role: 'user', text: userMsg });
    setAiLoading(true);

    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg }),
      });
      const data = await res.json();
      store.addSanctuaryChatMessage({ role: 'ai', text: data.reply || data.error || 'Something went wrong 💔' });
    } catch {
      store.addSanctuaryChatMessage({ role: 'ai', text: 'I\'m having trouble connecting right now. Please try again! 💕' });
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
                store.addSanctuaryChatMessage({ role: 'user', text: `Suggest: ${s.title}` });
                store.addSanctuaryChatMessage({ role: 'ai', text: `Great choice! Let me think about ${s.title.toLowerCase()} for you... How about trying something new together this weekend? Whether it's a cooking class, a scenic hike, or just a cozy movie night with a twist - the key is making it special! 💕` });
              }}
            >
              Choose
            </motion.button>
          </motion.div>
        ))}
      </div>

      {/* Chosen Interactions */}
      {store.aiMemory.chosenInteractions.length > 0 && (
        <SectionCard>
          <div className="text-xs font-medium mb-2" style={{ color: 'var(--theme-text-sub)' }}>Chosen Interactions</div>
          <div className="flex flex-wrap gap-1.5">
            {store.aiMemory.chosenInteractions.map((ci, i) => (
              <span key={i} className="px-2 py-1 rounded-full text-xs" style={{ backgroundColor: 'var(--theme-primary-container)', color: 'var(--theme-on-primary-container)' }}>
                {ci}
              </span>
            ))}
          </div>
        </SectionCard>
      )}

      {/* AI Chat */}
      <SectionCard>
        <div className="text-xs font-medium mb-3" style={{ color: 'var(--theme-text-sub)' }}>Chat with Oracle</div>
        <div className="max-h-64 overflow-y-auto space-y-2 mb-3">
          {store.sanctuaryChat.length === 0 && (
            <p className="text-xs text-center py-4" style={{ color: 'var(--theme-text-sub)' }}>Ask me anything about your relationship! 💬</p>
          )}
          {store.sanctuaryChat.map((msg, i) => (
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
            placeholder="Ask the Oracle..."
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
  const [playerAnswer, setPlayerAnswer] = useState<string | null>(null);
  const [partnerAnswer, setPartnerAnswer] = useState<string | null>(null);
  const [showMatch, setShowMatch] = useState(false);

  const games = [
    { id: 'compromise', title: 'The Ultimate Compromise', icon: Wine, color: '#E84393' },
    { id: 'taboo', title: 'Taboo Roulette', icon: Flame, color: '#FD79A8' },
    { id: 'dice', title: 'Desire Dice', icon: Dice1, color: '#A29BFE' },
  ];

  const questions = {
    compromise: [
      { q: 'Stay in or go out tonight?', a: ['Cozy night in', 'Adventure out'] },
      { q: 'Movie or music?', a: ['Movie marathon', 'Playlist session'] },
      { q: 'Cook together or order in?', a: ['Home-cooked meal', 'Takeout treat'] },
    ],
    taboo: [
      { q: 'What\'s a secret fantasy you haven\'t shared?', a: ['Tell me 👀', 'Keep it secret 🤫'] },
      { q: 'Truth or dare right now?', a: ['Truth', 'Dare'] },
      { q: 'Most adventurous place for a date?', a: ['Somewhere public', 'Somewhere private'] },
    ],
    dice: [
      { q: 'Give your partner a 30-second massage', a: ['Shoulders', 'Hands'] },
      { q: 'Whisper something sweet in their ear', a: ['A compliment', 'A promise'] },
      { q: 'Share your favorite memory together', a: ['First date', 'Best trip'] },
    ],
  };

  const game = games.find((g) => g.id === activeGame);
  const gameQuestions = activeGame ? questions[activeGame as keyof typeof questions] : null;

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
    if (currentQuestion < 2) setCurrentQuestion((c) => c + 1);
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
        games.map((g) => (
          <motion.button
            key={g.id}
            whileTap={{ scale: 0.97 }}
            onClick={() => setActiveGame(g.id)}
            className="w-full rounded-2xl p-4 flex items-center gap-3 text-left"
            style={{ backgroundColor: 'var(--theme-surface)' }}
          >
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: g.color + '20', color: g.color }}>
              <g.icon size={22} />
            </div>
            <div>
              <div className="font-semibold text-sm" style={{ color: 'var(--theme-text-main)' }}>{g.title}</div>
              <div className="text-xs" style={{ color: 'var(--theme-text-sub)' }}>Tap to play</div>
            </div>
          </motion.button>
        ))
      ) : (
        <SectionCard>
          <div className="text-center space-y-4">
            <div className="text-xs font-medium" style={{ color: 'var(--theme-primary)' }}>{game?.title}</div>

            <div className="text-lg font-semibold py-4" style={{ color: 'var(--theme-text-main)' }}>
              {gameQuestions?.[currentQuestion].q}
            </div>

            {!showMatch ? (
              <div className="flex gap-3 justify-center">
                {gameQuestions?.[currentQuestion].a.map((opt) => (
                  <motion.button
                    key={opt}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => answerQuestion(opt)}
                    className="px-6 py-3 rounded-2xl text-sm font-medium"
                    style={{
                      backgroundColor: playerAnswer === opt ? 'var(--theme-primary)' : 'var(--theme-surface-container)',
                      color: playerAnswer === opt ? 'var(--theme-on-primary)' : 'var(--theme-on-surface)',
                    }}
                  >
                    {opt}
                  </motion.button>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex justify-center gap-6">
                  <div className="text-center">
                    <div className="text-xs mb-1" style={{ color: 'var(--theme-text-sub)' }}>You</div>
                    <div className="px-3 py-2 rounded-xl text-sm" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-on-primary)' }}>
                      {playerAnswer}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs mb-1" style={{ color: 'var(--theme-text-sub)' }}>Partner</div>
                    <div className="px-3 py-2 rounded-xl text-sm" style={{ backgroundColor: 'var(--theme-surface-container)', color: 'var(--theme-on-surface)' }}>
                      {partnerAnswer}
                    </div>
                  </div>
                </div>
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="text-2xl"
                >
                  {playerAnswer === partnerAnswer ? '💕 Match!' : '😊 Different but cute!'}
                </motion.div>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={nextQuestion}
                  className="px-6 py-2.5 rounded-full text-sm font-semibold text-white"
                  style={{ backgroundColor: 'var(--theme-primary)' }}
                >
                  {currentQuestion < 2 ? 'Next' : 'Finish'}
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
  const store = useAppStore();
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newType, setNewType] = useState<'Date' | 'Goal' | 'Anniversary'>('Date');

  const typeIcons: Record<string, React.ElementType> = { Date: Heart, Goal: Target, Anniversary: Gift };

  const addEvent = () => {
    if (!newTitle.trim() || !newDate) return;
    store.setEvents([
      ...store.events,
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

      {store.events.length === 0 ? (
        <div className="text-center py-12">
          <Calendar size={40} className="mx-auto mb-3 opacity-30" style={{ color: 'var(--theme-text-sub)' }} />
          <p className="text-sm" style={{ color: 'var(--theme-text-sub)' }}>No events planned yet</p>
        </div>
      ) : (
        store.events.map((evt) => {
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
  const store = useAppStore();
  const [showWrite, setShowWrite] = useState(false);
  const [letterContent, setLetterContent] = useState('');

  const writeLetter = () => {
    if (!letterContent.trim()) return;
    const myName = store.identity === 'Batman' ? store.batmanName : store.princessName;
    const partnerName = store.identity === 'Batman' ? store.princessName : store.batmanName;
    store.setLetters([
      ...store.letters,
      { id: `let-${Date.now()}`, from: myName, to: partnerName, content: letterContent, timestamp: new Date().toISOString() },
    ]);
    setLetterContent('');
    setShowWrite(false);
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

      {store.letters.length === 0 ? (
        <div className="text-center py-12">
          <BookOpen size={40} className="mx-auto mb-3 opacity-30" style={{ color: 'var(--theme-text-sub)' }} />
          <p className="text-sm" style={{ color: 'var(--theme-text-sub)' }}>No love letters yet</p>
          <p className="text-xs mt-1" style={{ color: 'var(--theme-text-sub)' }}>Write your first letter to your partner</p>
        </div>
      ) : (
        store.letters.map((letter) => (
          <motion.div key={letter.id} whileTap={{ scale: 0.98 }} className="rounded-2xl p-4" style={{ backgroundColor: 'var(--theme-surface)' }}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-medium" style={{ color: 'var(--theme-primary)' }}>From {letter.from}</span>
              <span className="text-xs" style={{ color: 'var(--theme-text-sub)' }}>→</span>
              <span className="text-xs font-medium" style={{ color: 'var(--theme-primary)' }}>{letter.to}</span>
              <span className="text-[10px] ml-auto" style={{ color: 'var(--theme-text-sub)' }}>{timeAgo(letter.timestamp)}</span>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--theme-on-surface)' }}>{letter.content}</p>
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
  const store = useAppStore();
  const [showAdd, setShowAdd] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [newCategory, setNewCategory] = useState<string>('General');
  const [newRevealDate, setNewRevealDate] = useState('');

  const addAIMemory = () => {
    if (!newContent.trim()) return;
    store.setAiMemory({
      ...store.aiMemory,
      explicitMemories: [
        ...store.aiMemory.explicitMemories,
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

      {store.aiMemory.explicitMemories.length === 0 ? (
        <div className="text-center py-12">
          <Brain size={40} className="mx-auto mb-3 opacity-30" style={{ color: 'var(--theme-text-sub)' }} />
          <p className="text-sm" style={{ color: 'var(--theme-text-sub)' }}>No AI memories stored</p>
          <p className="text-xs mt-1" style={{ color: 'var(--theme-text-sub)' }}>Help the AI learn about your relationship</p>
        </div>
      ) : (
        store.aiMemory.explicitMemories.map((mem) => (
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

/* ═══════════════════════════════════════════════════════
   SETTINGS SCREEN
   ═══════════════════════════════════════════════════════ */
function SettingsScreen() {
  const store = useAppStore();
  const [showReset, setShowReset] = useState(false);
  const [editingBatmanName, setEditingBatmanName] = useState(false);
  const [editingPrincessName, setEditingPrincessName] = useState(false);
  const [batmanNameVal, setBatmanNameVal] = useState(store.batmanName);
  const [princessNameVal, setPrincessNameVal] = useState(store.princessName);

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
    navigator.clipboard.writeText(store.vaultId);
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
            {store.vaultId}
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
          {/* Batman / You */}
          <div
            className="flex-1 rounded-2xl p-3 text-center cursor-pointer"
            style={{ backgroundColor: store.identity === 'Batman' ? 'var(--theme-primary-container)' : 'var(--theme-surface-container)' }}
            onClick={() => store.setIdentity('Batman')}
          >
            <ProfileAvatar name={store.batmanName} photo={store.batmanPhoto} size={48} />
            <div className="text-xs font-semibold mt-2" style={{ color: 'var(--theme-text-main)' }}>
              {store.batmanName}
            </div>
            {store.identity === 'Batman' && (
              <span className="text-[10px] px-2 py-0.5 rounded-full mt-1 inline-block" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-on-primary)' }}>You</span>
            )}
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={(e) => { e.stopPropagation(); setEditingBatmanName(true); setBatmanNameVal(store.batmanName); }}
              className="mt-1 text-[10px] flex items-center gap-0.5 mx-auto"
              style={{ color: 'var(--theme-primary)' }}
            >
              <Edit3 size={10} /> Edit
            </motion.button>
          </div>

          {/* Princess / Partner */}
          <div
            className="flex-1 rounded-2xl p-3 text-center cursor-pointer"
            style={{ backgroundColor: store.identity === 'Princess' ? 'var(--theme-primary-container)' : 'var(--theme-surface-container)' }}
            onClick={() => store.setIdentity('Princess')}
          >
            <ProfileAvatar name={store.princessName} photo={store.princessPhoto} size={48} />
            <div className="text-xs font-semibold mt-2" style={{ color: 'var(--theme-text-main)' }}>
              {store.princessName}
            </div>
            {store.identity === 'Princess' && (
              <span className="text-[10px] px-2 py-0.5 rounded-full mt-1 inline-block" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-on-primary)' }}>You</span>
            )}
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={(e) => { e.stopPropagation(); setEditingPrincessName(true); setPrincessNameVal(store.princessName); }}
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
              onClick={() => store.setTheme(name)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium"
              style={{
                backgroundColor: store.theme === name ? THEMES[name].primary + '20' : 'var(--theme-surface-container)',
                color: store.theme === name ? THEMES[name].primary : 'var(--theme-text-sub)',
                border: store.theme === name ? `2px solid ${THEMES[name].primary}` : '2px solid transparent',
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
              onClick={() => store.setFont(f)}
              className="flex-1 py-2.5 rounded-xl text-xs font-medium"
              style={{
                backgroundColor: store.font === f ? 'var(--theme-primary)' : 'var(--theme-surface-container)',
                color: store.font === f ? 'var(--theme-on-primary)' : 'var(--theme-text-sub)',
                fontFamily: f === 'Serif' ? 'serif' : f === 'Monospace' ? 'monospace' : 'sans-serif',
              }}
            >
              {f}
            </motion.button>
          ))}
        </div>
      </SectionCard>

      {/* Chat Wallpaper */}
      <SectionCard>
        <div className="text-xs font-medium mb-3 flex items-center gap-2" style={{ color: 'var(--theme-text-sub)' }}>
          <ImageIcon size={14} /> Chat Wallpaper
        </div>
        <div
          className="h-20 rounded-2xl flex items-center justify-center cursor-pointer"
          style={{ background: store.chatWallpaper ? `url(${store.chatWallpaper}) center/cover` : 'var(--theme-surface-container)' }}
          onClick={() => {
            const url = prompt('Enter wallpaper URL (or leave empty to reset):');
            if (url !== null) store.setChatWallpaper(url);
          }}
        >
          {!store.chatWallpaper && (
            <span className="text-xs" style={{ color: 'var(--theme-text-sub)' }}>Tap to set wallpaper URL</span>
          )}
        </div>
      </SectionCard>

      {/* AI API Key */}
      <SectionCard>
        <div className="text-xs font-medium mb-3 flex items-center gap-2" style={{ color: 'var(--theme-text-sub)' }}>
          <Key size={14} /> AI API Key
        </div>
        <input
          type="password"
          value={store.aiApiKey}
          onChange={(e) => store.setAiApiKey(e.target.value)}
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
                onClick={() => store.setNotificationSettings({ ...store.notificationSettings, [key]: !store.notificationSettings[key] })}
                className="w-11 h-6 rounded-full p-0.5 transition-colors"
                style={{ backgroundColor: store.notificationSettings[key] ? 'var(--theme-primary)' : 'var(--theme-surface-container)' }}
              >
                <motion.div
                  className="w-5 h-5 rounded-full bg-white shadow-sm"
                  animate={{ x: store.notificationSettings[key] ? 20 : 0 }}
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
              onClick={() => store.setAutoSync(!store.autoSync)}
              className="w-11 h-6 rounded-full p-0.5 transition-colors"
              style={{ backgroundColor: store.autoSync ? 'var(--theme-primary)' : 'var(--theme-surface-container)' }}
            >
              <motion.div
                className="w-5 h-5 rounded-full bg-white shadow-sm"
                animate={{ x: store.autoSync ? 20 : 0 }}
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

      {/* Security */}
      <SectionCard>
        <div className="text-xs font-medium mb-3 flex items-center gap-2" style={{ color: 'var(--theme-text-sub)' }}>
          <Lock size={14} /> Security
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm" style={{ color: 'var(--theme-text-main)' }}>End-to-End Encryption</span>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => store.setEncryptionEnabled(!store.encryptionEnabled)}
            className="w-11 h-6 rounded-full p-0.5 transition-colors"
            style={{ backgroundColor: store.encryptionEnabled ? 'var(--theme-primary)' : 'var(--theme-surface-container)' }}
          >
            <motion.div
              className="w-5 h-5 rounded-full bg-white shadow-sm"
              animate={{ x: store.encryptionEnabled ? 20 : 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            />
          </motion.button>
        </div>
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
              onClick={() => { store.resetApp(); setShowReset(false); }}
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
            onClick={() => { store.setBatmanName(batmanNameVal); setEditingBatmanName(false); }}
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
            onClick={() => { store.setPrincessName(princessNameVal); setEditingPrincessName(false); }}
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
   BOTTOM NAVIGATION
   ═══════════════════════════════════════════════════════ */
function BottomNav() {
  const store = useAppStore();
  const tabs: { key: TabName; icon: React.ElementType; label: string }[] = [
    { key: 'home', icon: Home, label: 'Home' },
    { key: 'chat', icon: MessageCircle, label: 'Chat' },
    { key: 'memories', icon: ImageIcon, label: 'Memories' },
    { key: 'sanctuary', icon: Sparkles, label: 'Sanctuary' },
    { key: 'settings', icon: Settings, label: 'Settings' },
  ];

  const isDark = ['Dracula', 'Midnight'].includes(store.theme);

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
          const active = store.currentTab === key;
          return (
            <motion.button
              key={key}
              whileTap={{ scale: 0.85 }}
              onClick={() => { store.setTab(key); if (key === 'chat') store.setChatOpen(false); }}
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
  const store = useAppStore();
  useThemeCSS();

  // Load data from server on mount
  useEffect(() => {
    store.loadFromServer().catch(() => {});
  }, []);

  const fontFamily = store.font === 'Serif' ? '"Playfair Display", serif' : store.font === 'Monospace' ? '"JetBrains Mono", monospace' : 'system-ui, sans-serif';

  const renderScreen = () => {
    switch (store.currentTab) {
      case 'home': return <HomeScreen />;
      case 'chat': return <ChatScreen />;
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
      {/* Header */}
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
            {store.daysTogether} days
          </span>
        </div>
      </div>

      {/* Screen Content */}
      <div className={`flex-1 overscroll-contain ${store.chatOpen && store.currentTab === 'chat' ? 'flex flex-col overflow-hidden' : 'overflow-y-auto'}`}>
        <AnimatePresence mode="wait">
          <motion.div
            key={store.currentTab + (store.chatOpen ? '-chat-open' : '')}
            variants={pageVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className={store.chatOpen && store.currentTab === 'chat' ? 'flex-1 flex flex-col overflow-hidden' : ''}
          >
            {renderScreen()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  );
}
