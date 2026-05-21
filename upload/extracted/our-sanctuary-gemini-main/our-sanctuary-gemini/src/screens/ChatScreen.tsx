/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import EmojiPicker, { Theme, EmojiStyle, SuggestionMode } from 'emoji-picker-react';
import { doc, setDoc, db } from '../lib/supabaseFirestoreCompat';
import { AppState, Message } from '../types';
import { ASSETS } from '../constants';
import { uploadMedia } from '../lib/media';
import { sendRemoteNotification } from '../lib/remoteNotifications';
import { queueMessage, dequeueMessage, getQueue } from '../lib/messageQueue';
import { getNetworkStatus as isNetworkOnline, onNetworkStatusChange } from '../lib/networkDetection';
import { PlusCircle, Mic, Send, MoreHorizontal, Smile, ChevronLeft, Image, Video, X, Camera, Reply, Check, CheckCheck, Play, Pause, Volume2, ChevronDown, Trash2 } from 'lucide-react';
import AdvancedMediaPlayer from '../components/AdvancedMediaPlayer';
import { Keyboard } from '@capacitor/keyboard';

// --- Helper Components ---
const MessageReceipt = React.memo(({ status, isMe }: { status?: 'sent' | 'received' | 'seen', isMe: boolean }) => {
  if (!isMe || !status) return null;
  return (
    <div className="flex items-center ms-1">
      {status === 'sent' && <Check size={10} className="text-gray-400" />}
      {status === 'received' && <CheckCheck size={10} className="text-gray-400" />}
      {status === 'seen' && <CheckCheck size={10} className="text-blue-500" />}
    </div>
  );
});

const WAVEFORM_BARS = Array.from({ length: 15 }, (_, i) => i);

const VoiceMessage = React.memo(({ url }: { url: string }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-3 py-1 pe-2 min-w-[160px]">
      <button 
        onClick={togglePlay}
        className="w-10 h-10 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-md"
      >
        {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ms-0.5" />}
      </button>
      
      <div className="flex-1 flex flex-col gap-1">
        <div className="flex items-center gap-1">
          {WAVEFORM_BARS.map((i) => (
            <div 
              key={i} 
              className={`w-0.5 rounded-full transition-all duration-300 ${
                currentTime / (duration || 1) > i / 15 
                  ? 'bg-[var(--color-primary)] h-4' 
                  : 'bg-gray-300 h-2'
              }`} 
            />
          ))}
        </div>
        <div className="flex justify-between items-center text-[9px] font-bold tracking-widest opacity-60 uppercase">
          <span>{formatTime(isPlaying ? currentTime : (duration || 0))}</span>
          <Volume2 size={10} />
        </div>
      </div>

      <audio 
        ref={audioRef}
        src={url} 
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onEnded={() => setIsPlaying(false)}
        className="hidden" 
      />
    </div>
  );
});

const VideoMessage = React.memo(({ url, onExpand }: { url: string, onExpand: () => void }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [showControls, setShowControls] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return;
    const time = Number(e.target.value);
    videoRef.current.currentTime = time;
    setCurrentTime(time);
  };

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div 
      className="relative aspect-square w-full min-w-[200px] mb-1 overflow-hidden rounded-lg bg-black group"
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
      onClick={(e) => {
         e.stopPropagation();
         setShowControls(!showControls);
      }}
    >
      <video 
        ref={videoRef}
        src={url} 
        className="w-full h-full object-cover"
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onEnded={() => setIsPlaying(false)}
        playsInline
      />
      
      {/* Overlay controls */}
      <AnimatePresence>
        {(showControls || !isPlaying) && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/40 flex flex-col justify-between p-3 transition-opacity"
          >
            <div className="flex justify-between items-start">
               <button 
                 onClick={(e) => {
                   e.stopPropagation();
                   onExpand();
                 }}
                 className="p-1.5 bg-black/20 hover:bg-black/40 backdrop-blur-md rounded-lg text-white border border-white/10 transition-all active:scale-95"
               >
                 <MoreHorizontal size={14} />
               </button>
               <div className="bg-black/60 backdrop-blur-md px-2 py-0.5 rounded text-[8px] font-black text-white uppercase tracking-widest border border-white/10">
                 Video
               </div>
            </div>

            <div className="flex items-center justify-center flex-1">
              <button 
                onClick={togglePlay}
                className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md text-white flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-xl border border-white/20"
              >
                {isPlaying ? <Pause size={24} fill="white" /> : <Play size={24} fill="white" className="ms-1" />}
              </button>
            </div>

            <div className="flex flex-col gap-1.5">
              <input 
                type="range" 
                min={0} 
                max={duration || 0} 
                step={0.1}
                value={currentTime} 
                onChange={handleSeek}
                onClick={(e) => e.stopPropagation()}
                className="w-full h-1 bg-white/30 rounded-lg appearance-none cursor-pointer accent-white"
              />
              <div className="flex justify-between items-center text-[9px] font-black text-white uppercase tracking-widest drop-shadow-sm">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

export const ChatScreen = React.memo(function ChatScreen({ 
  state, 
  setState, 
  setIsNavHidden 
}: { 
  state: AppState, 
  setState: React.Dispatch<React.SetStateAction<AppState>>,
  setIsNavHidden: (val: boolean) => void 
}) {
  const [selectedChat, setSelectedChat] = useState<boolean>(false);
  const [isFocused, setIsFocused] = useState(false);
  const [inputText, setInputText] = useState('');
  const [reactingTo, setReactingTo] = useState<number | null>(null);
  const [deletingMsg, setDeletingMsg] = useState<number | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<{ url: string, title?: string, date?: string } | null>(null);
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [importedMessages, setImportedMessages] = useState<Record<number, { from: string; text: string }>>({});
  const [importedCount, setImportedCount] = useState(0);
  const [loadedPage, setLoadedPage] = useState(-1);
  const [totalPages, setTotalPages] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadingMoreRef = useRef(false);

  // Parse a WhatsApp message tuple into {ts, from, text}
  function parseMsg(m: any[]): { ts: number; from: string; text: string } | null {
    const [day, month, year] = m[0].split('/');
    const timeParts = m[1].match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (!timeParts) return null;
    let h = parseInt(timeParts[1]);
    const min = parseInt(timeParts[2]);
    if (timeParts[3].toUpperCase() === 'PM' && h !== 12) h += 12;
    if (timeParts[3].toUpperCase() === 'AM' && h === 12) h = 0;
    const ts = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), h, min).getTime();
    return { ts, from: m[2], text: m[3] };
  }

  // Load and merge imported WhatsApp chat via pages
  useEffect(() => {
    fetch('/imported-pages/index.json')
      .then(r => r.json())
      .then(meta => {
        setImportedCount(meta.total);
        setTotalPages(meta.totalPages);
        // Load initial page (p0 = most recent 500)
        return fetch('/imported-pages/p0.json');
      })
      .then(r => r.json())
      .then(msgs => {
        const map: Record<number, { from: string; text: string }> = {};
        for (const m of msgs) {
          const parsed = parseMsg(m);
          if (!parsed) continue;
          const key = map[parsed.ts] ? parsed.ts + Object.keys(map).filter(k => parseInt(k) === parsed.ts).length : parsed.ts;
          map[key] = { from: parsed.from, text: parsed.text };
        }
        setImportedMessages(map);
        setLoadedPage(0);
      })
      .catch(() => {});
  }, []);

  async function loadMoreMessages() {
    if (loadingMoreRef.current || loadedPage < 0) return;
    const nextPage = loadedPage + 1;
    if (nextPage >= totalPages) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const res = await fetch(`/imported-pages/p${nextPage}.json`);
      const msgs = await res.json();
      setImportedMessages(prev => {
        const map = { ...prev };
        for (const m of msgs) {
          const parsed = parseMsg(m);
          if (!parsed) continue;
          const key = map[parsed.ts] ? parsed.ts + Object.keys(map).filter(k => parseInt(k) === parsed.ts).length : parsed.ts;
          map[key] = { from: parsed.from, text: parsed.text };
        }
        return map;
      });
      setLoadedPage(nextPage);
    } catch {}
    setLoadingMore(false);
    loadingMoreRef.current = false;
  }

  const myName = state.identity === 'Batman' ? state.batmanName : state.princessName;
  const partnerName = state.identity === 'Batman' ? state.princessName : state.batmanName;
  const myPhoto = state.identity === 'Batman' ? state.batmanPhoto : state.princessPhoto;
  const partnerPhoto = state.identity === 'Batman' ? state.princessPhoto : state.batmanPhoto;
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const longPressTimer = useRef<NodeJS.Timeout| null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const syncInflightRef = useRef(false); // Prevent concurrent message syncs
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const prevMessageCount = useRef(state.messages.length);
  const seenMessageIds = useRef<Set<number>>(new Set());
  const loadedPageRef = useRef(loadedPage);
  const totalPagesRef = useRef(totalPages);

  useEffect(() => { loadedPageRef.current = loadedPage; }, [loadedPage]);
  useEffect(() => { totalPagesRef.current = totalPages; }, [totalPages]);

  const sortedMessages = useMemo(() => {
    const appMsgs = [...state.messages].filter(m => !m.deleted).sort((a, b) => (a.id || 0) - (b.id || 0));

    // Merge imported WhatsApp messages
    const importedEntries = Object.entries(importedMessages);
    if (importedEntries.length === 0) return appMsgs;

    const obadaName = 'Obada Shabanieh';
    const wifeName = 'My Lovely Wife👸🏻❤️';

    const converted = importedEntries.map(([key, val]) => {
      const ts = parseInt(key);
      const isMe = state.identity === 'Batman' ? val.from === obadaName : val.from === wifeName;
      return {
        id: ts,
        type: isMe ? 'sent' as const : 'received' as const,
        senderId: (val.from === obadaName ? 'Batman' : 'Princess') as 'Batman' | 'Princess',
        text: val.text,
        time: new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }),
        imported: true as const,
      };
    });

    const merged = [...appMsgs, ...converted].sort((a, b) => (a.id || 0) - (b.id || 0));
    return merged;
  }, [state.messages, importedMessages, state.identity]);

  const checkNearBottom = () => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
    setIsNearBottom(near);
    if (near) setUnreadCount(0);

    // Detect scroll to top → load more imported messages
    if (el.scrollTop < 100 && loadedPageRef.current >= 0 && loadedPageRef.current + 1 < totalPagesRef.current) {
      loadMoreMessages();
    }
  };

  useEffect(() => {
    const newMsgs = state.messages.length - prevMessageCount.current;
    if (newMsgs > 0 && !isNearBottom) {
      setUnreadCount(prev => prev + newMsgs);
    }
    prevMessageCount.current = state.messages.length;
  }, [state.messages.length]);

  useEffect(() => {
    if (isNearBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: state.messages.length > 5 ? 'auto' : 'smooth' });
    }
  }, [state.messages, isPartnerTyping]);

  useEffect(() => {
    if (!selectedChat) return;
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [selectedChat]);

  useEffect(() => {
    if (!selectedChat) return;
    let listener: any;
    Keyboard.addListener('keyboardWillShow', () => {
      if (showEmojiPicker) setShowEmojiPicker(false);
    }).then(l => { listener = l; }).catch(() => {});
    return () => { listener?.remove?.().catch(() => {}); };
  }, [selectedChat, showEmojiPicker]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setUnreadCount(0);
    setIsNearBottom(true);
  };

  // Sync "seen" status when chat is active (only mark unseen messages once)
  useEffect(() => {
    if (!selectedChat || state.messages.length === 0) return;
    
    const unseenReceived = state.messages.filter(m => 
      m.senderId !== state.identity && m.status !== 'seen' && !seenMessageIds.current.has(m.id)
    );
    
    if (unseenReceived.length > 0) {
      unseenReceived.forEach(m => seenMessageIds.current.add(m.id));
      const updatedMessages = state.messages.map(m => 
        unseenReceived.some(u => u.id === m.id) ? { ...m, status: 'seen' as const } : m
      );
      setState(s => ({ ...s, messages: updatedMessages }));
      syncMessages(updatedMessages);
    }
  }, [selectedChat, state.messages]);

  // Handle Typing Indicator
  useEffect(() => {
    if (inputText && state.identity) {
      updateTypingStatus(true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        updateTypingStatus(false);
      }, 3000);
    } else if (!inputText && state.identity) {
      updateTypingStatus(false);
    }

    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [inputText]);

  // Monitor Partner Typing
  useEffect(() => {
    const partnerId = state.identity === 'Batman' ? 'Princess' : 'Batman';
    const partnerTyping = state.typingStatus?.find(t => t.userId === partnerId);
    if (partnerTyping) {
      // Only show as typing if it was updated in the last 10 seconds (to avoid stuck indicators)
      const lastUpdate = new Date(partnerTyping.lastUpdated).getTime();
      const now = new Date().getTime();
      setIsPartnerTyping(partnerTyping.isTyping && (now - lastUpdate < 10000));
    } else {
      setIsPartnerTyping(false);
    }
  }, [state.typingStatus, state.identity]);

  // Handle offline message queue retry
  useEffect(() => {
    const retryQueued = async () => {
      const queue = getQueue();
      if (queue.length > 0 && isNetworkOnline()) {
        console.log(`[ChatScreen] Retrying ${queue.length} queued messages...`);
        const allMessages = [...state.messages];
        try {
          await syncMessages(allMessages);
        } catch (e) {
          console.error('[ChatScreen] Queue retry failed:', e);
        }
      }
    };
    
    const unsubscribe = onNetworkStatusChange((isOnline) => {
      if (isOnline) {
        retryQueued();
      }
    });
    
    return unsubscribe;
  }, [state.messages]);

  const updateTypingStatus = async (isTyping: boolean) => {
    const currentVaultId = state.vaultId;
    const currentIdentity = state.identity;
    if (!currentVaultId || !currentIdentity) return;
    
    const typingData = state.typingStatus || [];
    const myIndex = typingData.findIndex(t => t.userId === currentIdentity);
    
    let newTypingData = [...typingData];
    const entry = { userId: currentIdentity as 'Batman' | 'Princess', isTyping, lastUpdated: new Date().toISOString() };
    
    if (myIndex > -1) {
      if (newTypingData[myIndex].isTyping === isTyping) return; // No change
      newTypingData[myIndex] = entry;
    } else {
      newTypingData.push(entry);
    }

    try {
      await setDoc(doc(db, "couples", currentVaultId), {
        typingStatus: newTypingData
      }, { merge: true });
    } catch (e) {
      console.error("Typing status update failed:", e);
    }
  };

  const syncMessages = async (newMessages: Message[]) => {
    if (!state.vaultId || syncInflightRef.current) return; // Skip if already syncing
    syncInflightRef.current = true;
    try {
      await setDoc(doc(db, "couples", state.vaultId), {
        messages: newMessages,
        lastUpdated: new Date().toISOString()
      }, { merge: true });
      
      // Dequeue any messages that were successfully synced
      const queue = getQueue();
      queue.forEach(qMsg => {
        const inSync = newMessages.find(m => m.id === qMsg.id);
        if (inSync) dequeueMessage(qMsg.id);
      });
    } catch (e) {
      console.error("Message sync failed:", e);
      
      // If network is down, queue the unsent messages
      if (!isNetworkOnline()) {
        newMessages.forEach(msg => {
          queueMessage(msg);
        });
      }
    } finally {
      syncInflightRef.current = false;
    }
  };

  // Helper to format time consistently
  const formatMsgTime = (msg: Message) => {
    if (!msg.time) return '';
    // If it's already a nicely formatted string from a previous version, return it
    if (msg.time.includes('AM') || msg.time.includes('PM')) return msg.time;
    
    // Otherwise, try to parse it if it looks like "HH:MM"
    try {
      const parts = msg.time.split(':');
      if (parts.length >= 2) {
        let hh = parseInt(parts[0]);
        const mm = parts[1].substring(0, 2);
        if (!isNaN(hh)) {
          const suffix = hh >= 12 ? 'PM' : 'AM';
          hh = hh % 12 || 12;
          return `${hh}:${mm} ${suffix}`;
        }
      }
    } catch (e) {}
    return msg.time;
  };

  const sendMessage = async (overrides: Partial<Message> = {}) => {
    if (!inputText.trim() && !overrides.image && !overrides.audio && !overrides.video) return;
    
    const now = new Date();
    const newMessage: Message = {
      id: Date.now() + Math.floor(Math.random() * 1000), // More unique ID
      type: 'sent', 
      senderId: state.identity as 'Batman' | 'Princess',
      text: inputText,
      time: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
      status: 'sent',
      reactions: [],
      ...overrides
    };

    if (replyingTo) {
      newMessage.replyTo = {
        id: replyingTo.id,
        text: replyingTo.text,
        sender: replyingTo.type === 'sent' ? myName : partnerName
      };
    }
    
    const updatedMessages = [...state.messages, newMessage];
    setState(s => ({ ...s, messages: updatedMessages }));
    setInputText('');
    setReplyingTo(null);
    await syncMessages(updatedMessages);
    setTimeout(() => chatInputRef.current?.focus(), 50);

    // Optional remote push hook. Disabled until a Supabase Edge Function is added.
    if (state.vaultId && state.identity) {
      const title = state.identity === 'Batman' ? state.batmanName : state.princessName;
      const body = newMessage.text || (newMessage.image ? '📷 Sent an image' : newMessage.audio ? '🎤 Sent a voice message' : newMessage.video ? '🎥 Sent a video' : '📎 Sent media');
      const partnerPhoto = state.identity === 'Batman' ? state.princessPhoto : state.batmanPhoto;
      sendRemoteNotification(state.vaultId, state.identity, title, body, { type: 'chat', messageId: String(newMessage.id) }, partnerPhoto || undefined);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const url = await uploadMedia(file, state.vaultId);
      const isVideo = file.type.startsWith('video/');
      const isImage = file.type.startsWith('image/');
      
      if (isVideo) {
        await sendMessage({ video: url });
      } else if (isImage) {
        await sendMessage({ image: url });
      }
    } catch (err) {
      console.error("Upload failed", err);
      alert("Failed to upload media. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const startRecording = async () => {
    if (isRecording) return;
    try {
      // Check Capacitor permissions
      try {
        const { Capacitor } = await import('@capacitor/core');
        if (Capacitor.isNativePlatform()) {
          const { CapacitorAudioRecorder } = await import('@capgo/capacitor-audio-recorder');
          const permissions = await CapacitorAudioRecorder.checkPermissions();
          if (permissions.recordAudio !== 'granted') {
            const req = await CapacitorAudioRecorder.requestPermissions();
            if (req.recordAudio !== 'granted') {
              alert("Microphone permission denied");
              return;
            }
          }
          await CapacitorAudioRecorder.startRecording();
          setIsRecording(true);
          return;
        }
      } catch (e) {
        console.warn("Capacitor recording failed, trying web", e);
      }

      // Web MediaRecorder logic
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Recording start failed", err);
      if (err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'SecurityError')) {
        alert("Microphone access denied. Please allow microphone permissions or open in a new tab.");
      } else {
        alert("Failed to start recording. Please check your mic connection.");
      }
    }
  };

  const stopRecording = async () => {
    if (!isRecording) return;
    setIsRecording(false);
    setIsUploading(true);

    try {
      let file: File | null = null;
      
      // Try Capacitor first
      try {
        const { Capacitor } = await import('@capacitor/core');
        if (Capacitor.isNativePlatform()) {
          const { CapacitorAudioRecorder } = await import('@capgo/capacitor-audio-recorder');
          const result = await CapacitorAudioRecorder.stopRecording();
          
          if (result.blob) {
            file = new File([result.blob], `voice_${Date.now()}.webm`, { type: 'audio/webm' });
          } else if (result.uri) {
            const uri = result.uri;
            const path = (uri && typeof uri === 'string') ? Capacitor.convertFileSrc(uri) : '';
            if (path) {
              const response = await fetch(path);
              const blob = await response.blob();
              file = new File([blob], `voice_${Date.now()}.m4a`, { type: blob.type || 'audio/m4a' });
            }
          }
        }
      } catch (e) {
        console.warn("Capacitor recording stop failed, trying web fallback", e);
      }

      // Web fallback
      if (!file && mediaRecorderRef.current) {
        const mr = mediaRecorderRef.current;
        if (mr.state !== 'inactive') {
          await new Promise<void>((resolve) => {
            mr.onstop = () => {
              const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
              file = new File([audioBlob], `voice_${Date.now()}.webm`, { type: 'audio/webm' });
              mr.stream.getTracks().forEach(track => track.stop());
              resolve();
            };
            mr.stop();
          });
        }
      }

      if (file) {
        console.log("[Mic] Voice recording complete, uploading...", file.size);
        const url = await uploadMedia(file, state.vaultId);
        await sendMessage({ audio: url });
      } else {
        console.warn("[Mic] No file produced from recording");
      }
    } catch (err) {
      console.error("[Chat] Recording/Upload error:", err);
    } finally {
      setIsUploading(false);
    }
  };

  const openChat = () => {
    setSelectedChat(true);
    setIsNavHidden(true);
  };

  const closeChat = () => {
    setSelectedChat(false);
    setIsNavHidden(false);
  };

  const handleLongPressStart = (id: number) => {
    longPressTimer.current = setTimeout(() => {
      setReactingTo(id);
    }, 500);
  };

  const handleLongPressEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  };

  const addReaction = (messageId: number, emoji: string) => {
    const updatedMessages = state.messages.map(m => {
      if (m.id === messageId) {
        const currentReactions = m.reactions || [];
        if (currentReactions.includes(emoji)) {
          return { ...m, reactions: currentReactions.filter(r => r !== emoji) };
        }
        return { ...m, reactions: [...currentReactions, emoji] };
      }
      return m;
    });
    setState(s => ({ ...s, messages: updatedMessages }));
    syncMessages(updatedMessages);
    setReactingTo(null);
  };

  const deleteMessage = async (messageId: number) => {
    const updatedMessages = state.messages.map(m => {
      if (m.id === messageId) {
        return { ...m, deleted: true };
      }
      return m;
    });
    setState(s => ({ ...s, messages: updatedMessages }));
    syncMessages(updatedMessages);
    setDeletingMsg(null);
  };

  if (!selectedChat) {
    return (
      <div className="flex flex-col h-full bg-[var(--color-background)] p-6">
        <h2 className="font-serif text-2xl font-bold mb-6 text-[var(--color-primary)]">Messages</h2>
        <div className="flex flex-col gap-2">
          <button 
            onClick={openChat}
            className="flex items-center gap-4 p-4 bg-white rounded-[2rem] border border-black/5 shadow-sm active:scale-[0.98] transition-all text-left"
          >
            <div className="w-12 h-12 rounded-full bg-pink-100 flex items-center justify-center text-xl shrink-0">
              💖
            </div>
            <div className="flex-1 overflow-hidden">
              <div className="flex justify-between items-center mb-0.5">
                <span className="font-bold text-sm">{partnerName} & {myName}</span>
                <span className="text-[10px] text-gray-400 capitalize">Just Now</span>
              </div>
              <p className="text-xs text-[var(--color-text-sub)] truncate italic">
                {isPartnerTyping ? (
                  <span className="text-[var(--color-primary)] font-medium tracking-wide animate-pulse">Typing...</span>
                ) : (
                  state.messages.length > 0 ? state.messages[state.messages.length - 1].text || 'Media Sent' : 'Start your story...'
                )}
              </p>
            </div>
          </button>
        </div>
    </div>
  );
  }

  return (
    <div 
      className="fixed inset-0 z-50 flex flex-col bg-[var(--color-background)]"
      style={{
        backgroundImage: state.chatWallpaper ? `url(${state.chatWallpaper})` : 'none',
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      }}
    >
      {/* Photo/Video Picker */}
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept="image/*,video/*" 
        onChange={handleFileUpload}
      />

      {/* Header */}
      <div className="shrink-0 relative z-40 bg-white/80 backdrop-blur-xl border-b border-black/5 px-4 pb-3 pt-6 flex items-center shadow-sm w-full">
        <button 
          onClick={closeChat} 
          className="p-2 me-2 text-[var(--color-text-sub)] hover:text-[var(--color-primary)] transition-all bg-white/50 rounded-full"
        >
          <ChevronLeft size={24} />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full overflow-hidden border border-black/10 relative">
            <img 
              src={(state.identity === 'Batman' ? state.princessPhoto : state.batmanPhoto) || (state.identity === 'Batman' ? ASSETS.profiles.princess : ASSETS.profiles.batman)} 
              alt="partner profile"
              className="w-full h-full object-cover" 
            />
            {state.presenceStatus && state.presenceStatus.length ? (() => {
              const partnerId = state.identity === 'Batman' ? 'Princess' : 'Batman';
              const p = state.presenceStatus?.find(x => x && x.userId === partnerId);
              if (p?.isOnline) {
                return <div className="absolute bottom-0 end-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>;
              }
              return null;
            })() : null}
          </div>
          <div className="flex flex-col">
            <h2 className="font-bold text-sm text-[#101C2B] leading-none mb-1">{partnerName}</h2>
            <div className="h-3 flex items-center">
              {isPartnerTyping ? (
                <span className="text-[11px] text-[var(--color-primary)] font-medium animate-pulse">typing...</span>
              ) : (() => {
                  const partnerId = state.identity === 'Batman' ? 'Princess' : 'Batman';
                  const p = state.presenceStatus?.find(x => x && x.userId === partnerId);
                  if (!p) return null;
                  if (p.isOnline) return <span className="text-[10px] text-green-600 font-medium tracking-wide">Online</span>;
                  
                  try {
                    const ls = new Date(p.lastSeen);
                    const isToday = ls.toDateString() === new Date().toDateString();
                    const t = isToday ? ls.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : ls.toLocaleDateString([], { month: 'short', day: 'numeric' });
                    return <span className="text-[10px] text-gray-400">Last seen {t}</span>;
                  } catch(e) {
                    return null;
                  }
              })()}
                {importedCount > 0 && <span className="text-[9px] ms-2 text-gray-300">· {importedCount.toLocaleString()} WA msgs</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto overflow-x-hidden p-6 flex flex-col gap-4 relative isolate" onScroll={checkNearBottom}>
        {loadingMore && (
          <div className="flex items-center justify-center py-3">
            <div className="w-5 h-5 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
            <span className="text-[10px] text-gray-400 ms-2">Loading older messages...</span>
          </div>
        )}
        {sortedMessages.map((msg, idx) => {
          const isMe = msg.senderId ? msg.senderId === state.identity : msg.type === 'sent';
          const prevMsg = idx > 0 ? sortedMessages[idx - 1] : null;
          
          // Basic day detection (comparing time strings is tricky without real timestamps, but we use Date.now() for IDs)
          const msgDate = new Date(msg.id).toLocaleDateString();
          const prevDate = prevMsg ? new Date(prevMsg.id).toLocaleDateString() : null;
          const showDate = msgDate !== prevDate;

          const myPhoto = (state.identity === 'Batman' ? state.batmanPhoto : state.princessPhoto) || (state.identity === 'Batman' ? ASSETS.profiles.batman : ASSETS.profiles.princess);
          const partnerPhoto = (state.identity === 'Batman' ? state.princessPhoto : state.batmanPhoto) || (state.identity === 'Batman' ? ASSETS.profiles.princess : ASSETS.profiles.batman);
          const senderPhoto = isMe ? myPhoto : partnerPhoto;

          return (
            <React.Fragment key={msg.id}>
              {showDate && (
                <div className="flex justify-center my-4 sticky top-0 z-20">
                  <span className="bg-white/60 backdrop-blur-md px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-sub)] shadow-sm border border-black/5">
                    {msgDate === new Date().toLocaleDateString() ? 'Today' : msgDate}
                  </span>
                </div>
              )}
              <div 
                className={`flex items-end gap-2 ${isMe ? 'flex-row-reverse self-end' : 'flex-row self-start'} max-w-[95%]`}
              >
              {/* Profile Photo */}
              <div className="w-7 h-7 rounded-full overflow-hidden border border-black/5 shadow-sm shrink-0 mb-1 bg-white">
                <img 
                  src={senderPhoto} 
                  alt="sender" 
                  className="w-full h-full object-cover" 
                />
              </div>

              <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[85%]`}>
                <div className="relative">
                  <AnimatePresence>
                    {(reactingTo === msg.id || deletingMsg === msg.id) && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.8 }}
                        animate={{ opacity: 1, y: -45, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.8 }}
                        className={`absolute z-50 bg-white shadow-xl border border-black/5 p-1 rounded-full flex gap-1 ${
                          isMe ? 'end-0' : 'start-0'
                        }`}
                      >
                        {['❤️', '👍', '😂', '😮', '🔥', '🎀'].map(emoji => (
                          <button
                            key={emoji}
                            onClick={() => addReaction(msg.id, emoji)}
                            className="w-7 h-7 flex items-center justify-center hover:bg-gray-100 rounded-full transition-colors text-base"
                          >
                            {emoji}
                          </button>
                        ))}
                        {isMe && (
                          <button
                            onClick={() => setDeletingMsg(msg.id)}
                            className="w-7 h-7 flex items-center justify-center hover:bg-red-50 rounded-full transition-colors text-red-500"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                        {deletingMsg === msg.id && (
                          <div className="absolute top-full mt-1 bg-white border border-black/10 rounded-lg shadow-xl p-2 flex gap-1">
                            <button
                              onClick={() => deleteMessage(msg.id)}
                              className="px-3 py-1 bg-red-500 text-white text-xs font-bold rounded-full hover:bg-red-600"
                            >
                              Delete
                            </button>
                            <button
                              onClick={() => setDeletingMsg(null)}
                              className="px-3 py-1 bg-gray-100 text-gray-600 text-xs font-bold rounded-full hover:bg-gray-200"
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ duration: 0.15 }}
                    drag={!msg.imported ? "x" : false}
                    dragSnapToOrigin={!msg.imported}
                    dragConstraints={!msg.imported ? { left: 0, right: 70 } : undefined}
                    dragElastic={!msg.imported ? 0.2 : undefined}
                    onDragEnd={(_, info) => {
                      if (info.offset.x > 50) {
                        setReplyingTo(msg);
                        if ('vibrate' in navigator) navigator.vibrate(10);
                      }
                    }}
                    onPointerDown={() => handleLongPressStart(msg.id)}
                    onPointerUp={handleLongPressEnd}
                    onPointerLeave={handleLongPressEnd}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setReactingTo(msg.id);
                    }}
                    className={`
                      py-2 px-3 rounded-[1.25rem] shadow-sm relative transition-all active:scale-[0.98] w-full
                      ${isMe 
                        ? 'bg-[#101C2B] text-white rounded-br-none' 
                        : 'bg-[var(--color-primary-container)] text-[var(--color-on-primary-container)] rounded-bl-none'
                      }
                      ${reactingTo === msg.id ? 'ring-2 ring-[var(--color-primary)]' : ''}
                    `}
                  >
                    {/* Swipe to reply indicator */}
                    <div className="absolute -left-10 top-1/2 -translate-y-1/2 opacity-0 group-drag:opacity-100 transition-opacity">
                       <Reply size={16} className="text-[var(--color-primary)]" />
                    </div>
                    {msg.replyTo && (
                      <div className={`
                        mb-1 p-1.5 rounded-lg text-[9px] border-l-[3px] relative
                        ${isMe 
                          ? 'bg-white/10 border-white/60 text-white/90' 
                          : 'bg-black/5 border-black/30 text-black/80'
                        }
                      `}>
                         <div className="flex items-center justify-between mb-0.5">
                           <p className="font-black uppercase tracking-tighter opacity-70 leading-none">{msg.replyTo.sender}</p>
                           <Reply size={8} className="opacity-50" />
                         </div>
                         <p className="line-clamp-1 italic text-[9px] leading-tight font-medium">{msg.replyTo.text || 'Media'}</p>
                      </div>
                    )}
                    {msg.image && (
                      <div className="aspect-square w-full min-w-[200px] mb-1 overflow-hidden rounded-lg bg-black/5">
                        <img 
                          src={msg.image} 
                          alt="Media" 
                          className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity" 
                          referrerPolicy="no-referrer" 
                          loading="lazy"
                          onClick={() => setSelectedMedia({ url: msg.image!, title: msg.text, date: msg.time })}
                        />
                      </div>
                    )}
                    {msg.video && (
                      <VideoMessage 
                        url={msg.video} 
                        onExpand={() => setSelectedMedia({ url: msg.video!, title: msg.text, date: msg.time })} 
                      />
                    )}
                    {msg.audio && <VoiceMessage url={msg.audio} />}
                    
                    {msg.text && (
                      <div className="text-[15px] font-normal leading-[1.6] chat-markdown">
                        <ReactMarkdown>{msg.text}</ReactMarkdown>
                      </div>
                    )}
                    
                    {/* Reactions display */}
                    {msg.imported && (
                      <div className={`absolute -bottom-2 ${isMe ? 'end-0' : 'start-0'} bg-green-100 text-green-700 text-[7px] font-bold px-1 rounded-full border border-green-200 leading-none py-0.5`}>
                        WA
                      </div>
                    )}                    
                    {msg.reactions && msg.reactions.length > 0 && (
                      <div className={`absolute -bottom-2 ${isMe ? 'start-0' : 'end-0'} flex gap-0.5`}>
                        {msg.reactions.map((r, idx) => (
                          <div key={idx} className="bg-white/90 backdrop-blur-sm border border-black/5 shadow-sm rounded-full w-3.5 h-3.5 flex items-center justify-center text-[8px]">
                            {r}
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                </div>
                <div className={`flex items-center gap-1 mt-0.5 ${isMe ? 'justify-end pe-1' : 'ps-1'}`}>
                  <span className="text-[8px] opacity-40 uppercase tracking-widest leading-none">
                    {formatMsgTime(msg)}
                  </span>
                  <MessageReceipt status={msg.status} isMe={isMe} />
                </div>
              </div>
            </div>
          </React.Fragment>
          );
        })}

        {isPartnerTyping && (
          <motion.div 
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2 self-start"
          >
            <div className="w-6 h-6 rounded-full overflow-hidden border border-black/5 shadow-sm shrink-0 bg-white">
              <img 
                src={(state.identity === 'Batman' ? state.princessPhoto : state.batmanPhoto) || (state.identity === 'Batman' ? ASSETS.profiles.princess : ASSETS.profiles.batman)} 
                alt="partner" 
                className="w-full h-full object-cover" 
              />
            </div>
            <div className="bg-[var(--color-primary-container)] px-3 py-2 rounded-2xl rounded-bl-none flex gap-1 items-center">
              <span className="w-1 h-1 bg-[var(--color-on-primary-container)] rounded-full animate-bounce [animation-delay:-0.3s]" />
              <span className="w-1 h-1 bg-[var(--color-on-primary-container)] rounded-full animate-bounce [animation-delay:-0.15s]" />
              <span className="w-1 h-1 bg-[var(--color-on-primary-container)] rounded-full animate-bounce" />
            </div>
          </motion.div>
        )}
        <div ref={messagesEndRef} className="h-24" />
      </div>

      <AnimatePresence>
        {!isNearBottom && unreadCount > 0 && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={scrollToBottom}
            className="absolute bottom-28 end-6 z-40 bg-white shadow-xl rounded-full w-10 h-10 flex items-center justify-center border border-black/5 active:scale-90 transition-transform"
          >
            <ChevronDown size={20} className="text-[var(--color-primary)]" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -end-1 bg-[var(--color-primary)] text-white text-[8px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Input Bar */}
      <div className="shrink-0 relative z-40 w-full max-w-2xl mx-auto px-4 pb-6 pt-2 transition-all duration-200 ease-out flex flex-col">
        <AnimatePresence>
          {showEmojiPicker && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 300, opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="overflow-hidden mb-2 bg-white rounded-t-2xl shadow-lg border-t border-gray-100"
            >
              <div className="h-full flex flex-col">
                <div className="flex justify-between items-center px-3 py-1.5 border-b border-gray-50">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Emojis</span>
                  <button onClick={() => { setShowEmojiPicker(false); setTimeout(() => chatInputRef.current?.focus(), 50); }} className="text-gray-400 hover:text-[var(--color-primary)] p-1">
                    <X size={16} />
                  </button>
                </div>
                <div className="flex-1 overflow-hidden">
                  <EmojiPicker
                    emojiStyle={EmojiStyle.NATIVE}
                    onEmojiClick={(emojiData) => setInputText(prev => prev + emojiData.emoji)}
                    theme={Theme.LIGHT}
                    suggestedEmojisMode={SuggestionMode.RECENT}
                    width="100%"
                    height="100%"
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {replyingTo && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="mb-2 bg-white/80 backdrop-blur-xl p-3 rounded-[1.5rem] border border-black/5 shadow-lg flex items-center gap-3"
            >
              <div className="w-1 h-8 bg-[var(--color-primary)] rounded-full" />
              <div className="flex-1 overflow-hidden">
                <p className="text-[10px] font-bold text-[var(--color-primary)] uppercase tracking-widest">
                  Replying to {replyingTo.type === 'sent' ? myName : partnerName}
                </p>
                <p className="text-xs text-[var(--color-text-sub)] line-clamp-1 italic">{replyingTo.text || 'Media'}</p>
              </div>
              <button 
                onClick={() => setReplyingTo(null)}
                className="p-1 hover:bg-black/5 rounded-full text-gray-400"
              >
                <X size={16} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {isRecording && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute -top-12 start-0 end-0 flex justify-center"
          >
            <div className="bg-red-500 text-white px-4 py-1 rounded-full text-xs font-bold flex items-center gap-2 animate-pulse shadow-lg">
              <div className="w-2 h-2 rounded-full bg-white animate-ping" />
              Recording Voice...
            </div>
          </motion.div>
        )}
        
        {isUploading && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute -top-12 start-0 end-0 flex justify-center"
          >
            <div className="bg-blue-500 text-white px-4 py-1 rounded-full text-xs font-bold flex items-center gap-2 shadow-lg">
              <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Uploading Media...
            </div>
          </motion.div>
        )}

        <div className="bg-white/90 backdrop-blur-2xl p-3 rounded-full shadow-2xl border border-black/5 flex items-center gap-2 max-w-full overflow-hidden">
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="p-2 text-gray-400 hover:text-[var(--color-primary)] transition-colors active:scale-95 shrink-0"
          >
            <PlusCircle size={24} />
          </button>
          
          <button 
            onClick={() => {
              if (showEmojiPicker) {
                setShowEmojiPicker(false);
                setTimeout(() => chatInputRef.current?.focus(), 100);
              } else {
                setShowEmojiPicker(true);
                chatInputRef.current?.blur();
              }
            }}
            className={`p-2 transition-colors active:scale-95 shrink-0 ${showEmojiPicker ? 'text-[var(--color-primary)]' : 'text-gray-400 hover:text-[var(--color-primary)]'}`}
          >
            <Smile size={24} />
          </button>

          <input 
            ref={chatInputRef}
            type="text" 
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            placeholder={isRecording ? "Release mic to send..." : "Write a letter..."} 
            className="flex-1 min-w-0 bg-transparent border-none focus:ring-0 text-sm py-2 appearance-none"
            onFocus={() => { setIsFocused(true); if (showEmojiPicker) setShowEmojiPicker(false); }}
            onBlur={() => setTimeout(() => setIsFocused(false), 100)}
            disabled={isRecording}
          />
          
          <button 
            onMouseDown={(e) => { e.preventDefault(); startRecording(); }}
            onMouseUp={(e) => { e.preventDefault(); stopRecording(); }}
            onTouchStart={(e) => { e.preventDefault(); startRecording(); }}
            onTouchEnd={(e) => { e.preventDefault(); stopRecording(); }}
            className={`p-2 transition-all active:scale-125 shrink-0 ${isRecording ? 'text-red-500' : 'text-gray-400 hover:text-[var(--color-primary)]'}`}
          >
            <Mic size={22} className={isRecording ? 'fill-red-500' : ''} />
          </button>

          <button 
            onClick={() => sendMessage()}
            onMouseDown={(e) => e.preventDefault()}
            onTouchStart={(e) => e.preventDefault()}
            className="bg-[var(--color-primary)] text-white p-2 rounded-full shadow-lg hover:scale-105 active:scale-95 transition-all shrink-0"
          >
            <Send size={20} fill="white" />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {selectedMedia && (
          <AdvancedMediaPlayer 
            src={selectedMedia.url}
            title={selectedMedia.title}
            date={selectedMedia.date}
            onClose={() => setSelectedMedia(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
});

export default ChatScreen;
