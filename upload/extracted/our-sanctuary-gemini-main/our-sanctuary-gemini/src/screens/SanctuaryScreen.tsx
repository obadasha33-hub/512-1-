/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { doc, onSnapshot, setDoc, updateDoc, serverTimestamp, db } from '../lib/supabaseFirestoreCompat';
import { AppState, SanctuaryEvent, LoveLetter } from '../types';
import { Sparkles, Calendar, BookHeart, Plus, Trash2, Send, Loader2, Moon, Flame, Heart, Share2, Lock, Brain, MessageSquare } from 'lucide-react';
import AdvancedMediaPlayer from '../components/AdvancedMediaPlayer';
import ImportedChatViewer from '../components/ImportedChatViewer';
import { fetchAiChat, fetchAiSuggestions, fetchAiGameCards } from '../lib/geminiClient';
import PullToRefresh from '../components/PullToRefresh';

interface AISuggestion {
  title: string;
  description: string;
  icon: string;
}

interface GameSession {
  currentCardIndex: number;
  status: 'idle' | 'playing';
  p1Answer: string | null;
  p2Answer: string | null;
  p1Name: string | null;
  p2Name: string | null;
  p1Uid: string | null;
  reveal: boolean;
  updatedBy: string;
  gameMode?: 'compromise' | 'taboo' | 'desire';
  generatedDeck?: any[];
}

const tabooCards = [
  { category: 'Roulette: No Secrets 🔓', question: "Truth: Look me in the eyes and tell me the straight-up filthiest thing you've imagined us doing since we got married.", type: 'open' },
  { category: 'Roulette: Total Submission ⛓️', question: "Dare: Hand me your phone unlocked and let me open any app, OR drop to your knees right now and beg to serve me.", choices: ["Hand over the phone 📱", "Drop to my knees 🧎"], type: 'choice' },
  { category: 'Roulette: The Command 😈', question: "Dare: For the next 10 minutes, you are my absolute toy. You must ask permission before you speak, move, or touch me.", choices: ["I Accept My Position 🖤", "I Demand a Punishment ⛓️"], type: 'choice' },
  { category: 'Roulette: Fantasies Unleashed 🔥', question: "Truth: If you could introduce one new extreme element into our bed tonight with absolutely zero judgment, what would it be?", type: 'open' },
  { category: 'Roulette: Immediate Action ⏳', question: "Dare: You must remove one piece of my clothing using only your teeth, right wherever we are sitting, without using your hands.", choices: ["Challenge Accepted 🦷", "Take a Penalty (Lose a garment yourself) 👙"], type: 'choice' },
  { category: 'Roulette: The Edge 🌋', question: "Dare: Let me edge you to the absolute brink of climax, and then I decide if you get to finish or wait until tomorrow.", choices: ["Submit to the Tease 🥵", "Take a Disciplinary Action ❌"], type: 'choice' }
];

const compromiseCards = [
  { category: 'The Compromise: Power Play 🎭', question: "Scenario: We have an hour alone. I get to choose exactly what happens, but you must accept a condition. What's your compromise?", choices: ["I submit completely, but I must remain blindfolded the entire time.", "You take full control, but my hands must be bound.", "We play it sensual, but you determine when and if I finish."], type: 'choice' },
  { category: 'The Compromise: Limits 🚫', question: "Scenario: I want to push a boundary tonight. How far are we going?", choices: ["You film a short private video of us, but I hold the camera.", "We try that one intense thing I've been hesitating on, but I get a strict safe word.", "We do it somewhere totally exposed, but you take the lead."], type: 'choice' },
  { category: 'The Compromise: Role Reversal 🔄', question: "Scenario: We are roleplaying strangers meeting at a bar. Who are you?", choices: ["The dominant stranger who takes me to a hotel room.", "The submissive who does exactly what I whisper in your ear.", "The tease who makes me work for it all night long."], type: 'choice' },
  { category: 'The Compromise: The Bet 🎲', question: "Scenario: Let's make a high-stakes bet on who can stay silent the longest while being teased.", choices: ["If I lose, I am your servant for the whole weekend.", "If you lose, you owe me an uninterrupted hour of oral.", "If we both crack, we dive right into the main event."], type: 'choice' },
  { category: 'The Compromise: Public Secrets 🤫', question: "Scenario: We are at a crowded dinner party. What's our secret objective?", choices: ["You slip off your underwear and hand them to me under the table.", "We sneak away for 5 minutes of high-risk groping.", "You text me exactly what you're going to do to me when we get home."], type: 'choice' }
];

const desireCards = [
  { category: 'Desire: Body Worship 🙏', question: "Dare: Spend 5 minutes worshipping one body part of your partner's choice using only your lips and tongue. No hands allowed.", type: 'open' },
  { category: 'Desire: Temperature Play 🌡️', question: "Dare: Use an ice cube to trace a slow path from your partner's neck down to their navel. Then warm the same path with your breath.", choices: ["I'll be the artist 🎨", "I'll be the canvas 🖼️"], type: 'choice' },
  { category: 'Desire: Sensory Deprivation 🙈', question: "Dare: Blindfold your partner and feed them 3 different foods. They must guess each one while you whisper what you want to do to them after.", type: 'open' },
  { category: 'Desire: Power Exchange 👑', question: "Dare: For the next 15 minutes, one of you is the Master/Mistress. The other must obey every command without question. Choose your role.", choices: ["I take the crown 👑", "I kneel and serve "], type: 'choice' },
  { category: 'Desire: Tease & Denial 😏', question: "Dare: Touch your partner everywhere except where they want it most. Make them beg for release. The first one to break loses.", choices: ["I have iron will 🗿", "I'll make them beg first 😈"], type: 'choice' },
  { category: 'Desire: Fantasy Confession 📖', question: "Truth: Whisper your most forbidden fantasy into your partner's ear. If they blush, you get to act it out tonight.", type: 'open' }
];

export const SanctuaryScreen = React.memo(function SanctuaryScreen({ 
  state, 
  setState,
  onRefresh 
}: { 
  state: AppState, 
  setState: React.Dispatch<React.SetStateAction<AppState>>,
  onRefresh?: () => Promise<void>
}) {
  const [activeTab, setActiveTab] = useState<'ai' | 'after-dark' | 'events' | 'letters' | 'memory'>('ai');
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGeneratingGame, setIsGeneratingGame] = useState(false);
  const [newLetter, setNewLetter] = useState('');
  const [newMemory, setNewMemory] = useState('');
  const [newMemoryCategory, setNewMemoryCategory] = useState<'General' | 'Joke' | 'Favorite' | 'Date' | 'Important'>('General');
  const [pendingImageUrl, setPendingImageUrl] = useState<string | null>(null);
  const [revealOption, setRevealOption] = useState<'now' | '1m' | '6m' | '1y'>('now');
  const [moodAnalysis, setMoodAnalysis] = useState('');
  const [chatInput, setChatInput] = useState('');
  const aiChatMessages = state.sanctuaryChat || [];
  const [isTyping, setIsTyping] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<{ url: string, title?: string, date?: string } | null>(null);
  const aiChatScrollRef = React.useRef<HTMLDivElement>(null);
  const [isAddingEvent, setIsAddingEvent] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventDate, setNewEventDate] = useState('');
  const [newEventType, setNewEventType] = useState<'Date' | 'Goal' | 'Anniversary'>('Date');
  const [showImportedChat, setShowImportedChat] = useState(false);

  const myName = state.identity === 'Batman' ? state.batmanName : state.princessName;
  const partnerName = state.identity === 'Batman' ? state.princessName : state.batmanName;
  const myPhoto = state.identity === 'Batman' ? state.batmanPhoto : state.princessPhoto;
  const partnerPhoto = state.identity === 'Batman' ? state.princessPhoto : state.batmanPhoto;

  useEffect(() => {
    if (aiChatScrollRef.current) {
      aiChatScrollRef.current.scrollTop = aiChatScrollRef.current.scrollHeight;
    }
  }, [aiChatMessages, isTyping]);

  const addAiChatMessage = (updater: (prev: { role: 'user' | 'ai', text: string }[]) => { role: 'user' | 'ai', text: string }[]) => {
    setState(s => {
      const currentChat = s.sanctuaryChat || [];
      const newChat = updater(currentChat);
      if (s.vaultId) {
        setDoc(doc(db, "couples", s.vaultId), { sanctuaryChat: newChat }, { merge: true }).catch(console.error);
      }
      return { ...s, sanctuaryChat: newChat };
    });
  };

  const [gameSession, setGameSession] = useState<GameSession | null>(null);
  const sessionId = state.vaultId ? `game-${state.vaultId}` : null; 
  const playerId = state.identity || 'anonymous';

  useEffect(() => {
    if (!playerId || !sessionId) return;
    const unsub = onSnapshot(doc(db, "sessions", sessionId), (snapshot) => {
      if (snapshot.exists()) {
        setGameSession(snapshot.data() as GameSession);
      } else {
        const initialDetails = {
          currentCardIndex: 0, status: 'idle', p1Answer: null, p2Answer: null,
          p1Uid: playerId, p1Name: myName, p2Name: partnerName, reveal: false, updatedBy: playerId
        };
        setDoc(doc(db, "sessions", sessionId), initialDetails);
      }
    });
    return () => unsub();
  }, [playerId, myName, partnerName]);

  const updateGame = async (updates: Partial<GameSession>) => {
    if (!playerId || !sessionId) return;
    try {
      await setDoc(doc(db, "sessions", sessionId), { ...updates, updatedBy: playerId, updatedAt: serverTimestamp() }, { merge: true });
    } catch (err) { console.error("Update session failed:", err); }
  };

  const activeDeck = gameSession?.generatedDeck || (gameSession?.gameMode === 'taboo' ? tabooCards : gameSession?.gameMode === 'desire' ? desireCards : compromiseCards);

  const nextCard = () => {
    if (!gameSession) return;
    const nextIdx = (gameSession.currentCardIndex + 1) % activeDeck.length;
    updateGame({ currentCardIndex: nextIdx, p1Answer: null, p2Answer: null, reveal: false });
  };

  const submitAnswer = (choice: string) => {
    if (!gameSession || !playerId) return;
    const isP1 = gameSession.p1Uid === playerId;
    if (isP1) { updateGame({ p1Answer: choice, p1Name: myName }); }
    else { updateGame({ p2Answer: choice, p2Name: myName, reveal: !!gameSession.p1Answer }); }
    if (isP1 && gameSession.p2Answer) updateGame({ reveal: true });
    if (!isP1 && gameSession.p1Answer) updateGame({ reveal: true });
  };

  const resetGame = () => {
    updateGame({ currentCardIndex: 0, status: 'idle', p1Answer: null, p2Answer: null, reveal: false });
  };

  const startGame = async (mode: 'compromise' | 'taboo' | 'desire') => {
    setIsGeneratingGame(true);
    try {
      const cards = await fetchAiGameCards(mode, state.aiMemory, state.geminiApiKey);
      updateGame({ status: 'playing', currentCardIndex: 0, p1Uid: playerId, p1Name: myName, p2Name: partnerName, p1Answer: null, p2Answer: null, reveal: false, gameMode: mode, generatedDeck: cards });
    } catch (error) {
      console.error("Failed to generate game, using fallback:", error);
      updateGame({ status: 'playing', currentCardIndex: 0, p1Uid: playerId, p1Name: myName, p2Name: partnerName, p1Answer: null, p2Answer: null, reveal: false, gameMode: mode, generatedDeck: null });
    }
    finally { setIsGeneratingGame(false); }
  };

  const fetchSuggestions = async () => {
    setIsAnalyzing(true);
    try {
      const moodValues = state.moods.map(m => m.mood);
      const result = await fetchAiSuggestions(state.aiMemory, moodValues, state.geminiApiKey);
      setSuggestions(result.suggestions || []);
      setMoodAnalysis(result.moodAnalysis || '');
    } catch (e) {
      console.error(e);
      setSuggestions([]);
      setMoodAnalysis('');
    }
    finally { setIsAnalyzing(false); }
  };
  
  const chooseInteraction = async (title: string) => {
    const updatedInteractions = Array.from(new Set([...state.aiMemory.chosenInteractions, title])).slice(-30);
    setState(s => ({ ...s, aiMemory: { ...s.aiMemory, chosenInteractions: updatedInteractions } }));
    if (state.vaultId) {
      await setDoc(doc(db, "couples", state.vaultId), { aiMemory: { ...state.aiMemory, chosenInteractions: updatedInteractions } }, { merge: true });
    }
  };
  
  const removeChosenInteraction = async (title: string) => {
    const updatedInteractions = state.aiMemory.chosenInteractions.filter(t => t !== title);
    setState(s => ({ ...s, aiMemory: { ...s.aiMemory, chosenInteractions: updatedInteractions } }));
    if (state.vaultId) {
      await setDoc(doc(db, "couples", state.vaultId), { aiMemory: { ...state.aiMemory, chosenInteractions: updatedInteractions } }, { merge: true });
    }
  };

  useEffect(() => {
    if (activeTab === 'ai' && suggestions.length === 0) { fetchSuggestions(); }
  }, [activeTab]);

  const addLetter = async () => {
    if (!newLetter.trim()) return;
    const letter: LoveLetter = { id: Date.now().toString(), from: state.identity || 'Batman', to: state.identity === 'Batman' ? 'Princess' : 'Batman', content: newLetter, timestamp: new Date().toLocaleDateString() };
    const updatedLetters = [letter, ...state.letters];
    setState(s => ({ ...s, letters: updatedLetters }));
    setNewLetter('');
    if (state.vaultId) { await setDoc(doc(db, "couples", state.vaultId), { letters: updatedLetters }, { merge: true }); }
  };

  const handleChatSend = async () => {
    if (!chatInput.trim()) return;
    const userMsg = chatInput.trim();
    setChatInput('');
    addAiChatMessage(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsTyping(true);
    try {
      const data = await fetchAiChat({ userMessage: userMsg, names: { me: myName, partner: partnerName }, aiMemory: state.aiMemory, apiKey: state.geminiApiKey });
      const fullReply = data.reply;
      addAiChatMessage(prev => {
        const check = [...prev];
        if (check[check.length - 1]?.role === 'ai') { check[check.length - 1] = { ...check[check.length - 1], text: fullReply }; return check; }
        return [...prev, { role: 'ai', text: fullReply }];
      });
      setIsTyping(false);
    } catch (e: any) {
      console.error(e);
      addAiChatMessage(prev => {
        const check = [...prev];
        let errText = "I'm sorry, I couldn't connect to my wisdom just now.";
        if (e.message) { if (e.message.includes("API Error")) errText = "I'm sorry, the AI service seems busy or unavailable right now."; else errText = e.message; }
        const errorMsg = errText;
        if (check[check.length - 1]?.role === 'ai' && !check[check.length - 1].text) { check[check.length - 1] = { ...check[check.length - 1], text: errorMsg }; return check; }
        return [...prev, { role: 'ai', text: errorMsg }];
      });
    } finally { setIsTyping(false); }
  };

  const handleMemoryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsAnalyzing(true);
    try { const { uploadMedia } = await import('../lib/media'); const url = await uploadMedia(file, state.vaultId); setPendingImageUrl(url); }
    catch (err) { console.error(err); }
    finally { setIsAnalyzing(false); }
  };

  const addMemory = async () => {
    if (!newMemory.trim() && !pendingImageUrl) return;
    let revealDate: string | undefined = undefined;
    if (revealOption !== 'now') {
      const date = new Date();
      if (revealOption === '1m') date.setMonth(date.getMonth() + 1);
      if (revealOption === '6m') date.setMonth(date.getMonth() + 6);
      if (revealOption === '1y') date.setFullYear(date.getFullYear() + 1);
      revealDate = date.toISOString();
    }
    const memoryEntry: any = { id: Date.now().toString(), content: newMemory, imageUrl: pendingImageUrl || undefined, timestamp: new Date().toISOString(), category: newMemoryCategory, revealDate };
    const updatedMemories = [memoryEntry, ...(state.aiMemory?.explicitMemories || [])];
    setState(s => ({ ...s, aiMemory: { ...s.aiMemory, explicitMemories: updatedMemories } }));
    if (state.vaultId) { await setDoc(doc(db, "couples", state.vaultId), { aiMemory: { ...state.aiMemory, explicitMemories: updatedMemories } }, { merge: true }); }
    setNewMemory(''); setPendingImageUrl(null); setRevealOption('now');
  };

  const removeMemory = async (id: string) => {
    const updatedMemories = (state.aiMemory?.explicitMemories || []).filter(m => m.id !== id);
    setState(s => ({ ...s, aiMemory: { ...s.aiMemory, explicitMemories: updatedMemories } }));
    if (state.vaultId) { await setDoc(doc(db, "couples", state.vaultId), { aiMemory: { ...state.aiMemory, explicitMemories: updatedMemories } }, { merge: true }); }
  };

  const addEvent = async () => {
    if (!newEventTitle.trim() || !newEventDate) return;
    const newEvent: SanctuaryEvent = { id: Date.now().toString(), title: newEventTitle, date: new Date(newEventDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }), type: newEventType };
    const updatedEvents = [...state.events, newEvent];
    setState(s => ({ ...s, events: updatedEvents }));
    setIsAddingEvent(false); setNewEventTitle(''); setNewEventDate('');
    if (state.vaultId) { await setDoc(doc(db, "couples", state.vaultId), { events: updatedEvents }, { merge: true }); }
  };

  return (
    <PullToRefresh onRefresh={onRefresh || (() => Promise.resolve())}>
    <div className="w-full max-w-full overflow-x-hidden">
      <div className="flex gap-2 px-2 py-2 bg-white/40 backdrop-blur-xl rounded-2xl border border-black/5 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <TabButton active={activeTab === 'ai'} onClick={() => setActiveTab('ai')} icon={<Sparkles size={16} />} label="AI" />
        <TabButton active={activeTab === 'after-dark'} onClick={() => setActiveTab('after-dark')} icon={<Moon size={16} />} label="Dark" />
        <TabButton active={activeTab === 'events'} onClick={() => setActiveTab('events')} icon={<Calendar size={16} />} label="Plan" />
        <TabButton active={activeTab === 'letters'} onClick={() => setActiveTab('letters')} icon={<BookHeart size={16} />} label="Vault" />
        <TabButton active={activeTab === 'memory'} onClick={() => setActiveTab('memory')} icon={<Brain size={16} />} label="Memory" />
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'ai' && (
          <motion.div key="ai" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="w-full flex flex-col gap-4">
            <div className="flex justify-between items-center px-2">
              <h3 className="font-serif text-lg font-bold">Sanctuary Insights</h3>
              <button onClick={fetchSuggestions} disabled={isAnalyzing} className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-primary)] hover:opacity-70 flex items-center gap-1">
                {isAnalyzing ? <Loader2 className="animate-spin" size={12} /> : <Sparkles size={12} />} Refresh AI
              </button>
            </div>
            {moodAnalysis && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="px-4 py-2 bg-white/40 border border-[var(--color-primary)]/10 rounded-2xl italic text-[10px] text-gray-500 text-center">"{moodAnalysis}"</motion.div>
            )}
            {isAnalyzing ? (
              <div className="py-20 flex flex-col items-center gap-4 text-gray-400"><Loader2 className="animate-spin" size={32} /><p className="text-xs font-medium italic">Analyzing your emotional connection...</p></div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {suggestions.map((s, i) => {
                  const isChosen = state.aiMemory.chosenInteractions.includes(s.title);
                  return (
                    <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }} className="p-4 bg-white rounded-3xl border border-black/5 shadow-sm flex items-start gap-4 relative overflow-hidden group">
                      <div className="text-3xl p-3 bg-[var(--color-primary-container)] rounded-2xl">{s.icon}</div>
                      <div className="flex-1">
                        <h4 className="font-bold text-[var(--color-primary)]">{s.title}</h4>
                        <p className="text-xs text-gray-500 mt-1 leading-relaxed">{s.description}</p>
                        <button onClick={() => chooseInteraction(s.title)} disabled={isChosen} className={`mt-2 text-[10px] font-bold py-1 px-3 rounded-full transition-all ${isChosen ? 'bg-green-50 text-green-600 border border-green-100' : 'bg-[var(--color-primary)] text-white hover:scale-105 active:scale-95'}`}>
                          {isChosen ? 'Chosen Interaction' : 'Choose This'}
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
            {state.aiMemory.chosenInteractions.length > 0 && (
              <div className="bg-white/40 backdrop-blur-md rounded-3xl border border-black/5 p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between px-1">
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 flex items-center gap-2"><Flame size={12} className="text-[var(--color-primary)]" /> Chosen Interactions</h4>
                  <span className="text-[9px] font-bold text-gray-300">Affects Future Ideas</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {state.aiMemory.chosenInteractions.map((title, i) => (
                    <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="group flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-black/5 shadow-sm">
                      <span className="text-xs font-bold text-gray-700">{title}</span>
                      <button onClick={() => removeChosenInteraction(title)} className="text-gray-300 hover:text-red-500 transition-colors"><Trash2 size={12} /></button>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
            <div className="bg-white/60 backdrop-blur-md rounded-[2rem] border border-black/5 shadow-sm p-4 flex flex-col gap-3">
              <div className="flex items-center gap-2 px-2">
                <div className="w-6 h-6 rounded-full bg-[var(--color-primary)] flex items-center justify-center"><Sparkles size={12} className="text-white" /></div>
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-primary)]">Chat with Guide</h4>
              </div>
              <div ref={aiChatScrollRef} className="max-h-48 overflow-y-auto flex flex-col gap-3 px-2 custom-scrollbar">
                {aiChatMessages.length === 0 && (<p className="text-[10px] italic text-gray-400 text-center py-4">"Ask me anything about planning a night or reflecting on a memory..."</p>)}
                <AnimatePresence initial={false}>
                  {aiChatMessages.map((msg, i) => (
                    <motion.div key={i} initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[90%] p-3 rounded-2xl text-[11px] leading-relaxed shadow-sm ${msg.role === 'user' ? 'bg-[var(--color-primary)] text-white rounded-br-none' : 'bg-white border border-black/5 text-gray-700 rounded-bl-none'}`}>{msg.text}</div>
                    </motion.div>
                  ))}
                  {isTyping && (
                    <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="flex justify-start items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-[var(--color-primary-container)] flex items-center justify-center shrink-0"><Sparkles size={10} className="text-[var(--color-primary)] animate-pulse" /></div>
                      <div className="bg-white border border-black/5 p-3 rounded-2xl rounded-bl-none flex gap-1.5 items-center shadow-sm">
                        <div className="w-1.5 h-1.5 bg-[var(--color-primary)] rounded-full animate-bounce [animation-duration:0.6s]" />
                        <div className="w-1.5 h-1.5 bg-[var(--color-primary)] rounded-full animate-bounce [animation-duration:0.6s] [animation-delay:0.15s]" />
                        <div className="w-1.5 h-1.5 bg-[var(--color-primary)] rounded-full animate-bounce [animation-duration:0.6s] [animation-delay:0.3s]" />
                      </div>
                      <span className="text-[9px] font-bold uppercase tracking-widest text-[#E91E63]/40 animate-pulse">Oracle is reflecting...</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <div className="flex gap-2 items-center bg-black/5 rounded-full p-1 ps-4">
                <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleChatSend()} placeholder="Ask for an idea..." className="flex-1 min-w-0 bg-transparent border-none focus:ring-0 text-xs py-2" />
                <button onClick={handleChatSend} disabled={isTyping} className="p-2 bg-[var(--color-primary)] text-white rounded-full shadow-md shrink-0 active:scale-95 transition-all disabled:opacity-50"><Send size={14} /></button>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'after-dark' && (
          <motion.div key="after-dark" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="w-full flex flex-col gap-6">
            <div className="flex justify-between items-center px-2"><h3 className="font-serif text-lg font-bold text-[#E91E63]">After Dark 😈</h3><Flame className="text-[#E91E63] animate-pulse" size={20} /></div>
            {!gameSession || gameSession.status === 'idle' ? (
              <>
                <div className="mb-4">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2 mb-4 px-2"><Sparkles size={14} /> Spicy Ideas</h4>
                  <div className="grid grid-cols-1 gap-3 px-2">
                    {[{ title: "Sensory Journey", desc: "Use ice, silk, and heat for a tactile discovery night.", icon: "🕯️" }, { title: "Midnight Escape", desc: "A late-night drive to a secluded spot just to talk.", icon: "🚗" }].map((idea, i) => (
                      <div key={i} className="p-4 bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-3xl border border-white/10 shadow-lg flex items-start gap-4">
                        <div className="text-2xl p-2 bg-white/10 rounded-xl">{idea.icon}</div>
                        <div><h5 className="font-bold text-pink-300 text-sm">{idea.title}</h5><p className="text-[10px] text-slate-300 leading-relaxed">{idea.desc}</p></div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <button onClick={() => startGame('compromise')} disabled={isGeneratingGame} className="bg-black text-white w-full py-6 rounded-[2rem] shadow-xl font-bold flex flex-col items-center justify-center gap-2 group hover:scale-[1.02] active:scale-[0.98] transition-all relative overflow-hidden disabled:opacity-75">
                    <div className="absolute inset-0 bg-gradient-to-tr from-purple-900/20 to-transparent pointer-events-none" />
                    {isGeneratingGame ? <Loader2 size={24} className="text-[#E91E63] animate-spin" /> : <Flame size={24} className="text-[#E91E63]" />}
                    <div className="text-center"><span className="block text-sm">The Ultimate Compromise</span></div>
                  </button>
                  <button onClick={() => startGame('taboo')} disabled={isGeneratingGame} className="bg-[#E91E63] text-white w-full py-6 rounded-[2rem] shadow-xl font-bold flex flex-col items-center justify-center gap-2 group hover:scale-[1.02] active:scale-[0.98] transition-all relative overflow-hidden disabled:opacity-75">
                    <div className="absolute inset-0 bg-gradient-to-tr from-red-900/20 to-transparent pointer-events-none" />
                    {isGeneratingGame ? <Loader2 size={24} className="text-white animate-spin" /> : <Flame size={24} className="text-white" fill="white" />}
                    <div className="text-center"><span className="block text-sm">Taboo Roulette</span></div>
                  </button>
                </div>
                <button onClick={() => startGame('desire')} disabled={isGeneratingGame} className="w-full py-5 rounded-[2rem] shadow-xl font-bold flex items-center justify-center gap-3 group hover:scale-[1.02] active:scale-[0.98] transition-all relative overflow-hidden disabled:opacity-75 bg-gradient-to-r from-purple-600 via-pink-600 to-rose-600 text-white">
                  <div className="absolute inset-0 bg-gradient-to-tr from-black/10 to-transparent pointer-events-none" />
                  {isGeneratingGame ? <Loader2 size={24} className="text-white animate-spin" /> : <span className="text-2xl">🎲</span>}
                  <div className="text-center"><span className="block text-sm">Desire Dice</span><span className="block text-[10px] opacity-70">Roll for intimate dares</span></div>
                </button>
              </>
            ) : (
    <div className="flex flex-col gap-4 overflow-x-hidden">
                <div className="relative min-h-[300px] w-full">
                  <AnimatePresence mode="wait">
                    <motion.div key={gameSession.currentCardIndex} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="w-full bg-[#0F172A] rounded-[3rem] p-6 pb-8 flex flex-col items-center text-center shadow-2xl border border-white/10 relative overflow-hidden">
                      <div className="absolute top-0 start-0 w-full h-1 bg-white/5 overflow-hidden"><motion.div className="h-full bg-[#E91E63]" initial={{ width: 0 }} animate={{ width: activeDeck[gameSession.currentCardIndex] ? `${((gameSession.currentCardIndex + 1) / activeDeck.length) * 100}%` : 0 }} /></div>
                      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#E91E63] mb-6 p-2 bg-[#E91E63]/10 rounded-lg">{activeDeck[gameSession.currentCardIndex]?.category || 'Challenge'}</span>
                      <h4 className="text-xl font-serif text-white leading-relaxed italic mb-8 px-2">"{activeDeck[gameSession.currentCardIndex]?.question || 'Loading...'}"</h4>
                      <div className="w-full flex flex-col gap-3">
                        {activeDeck[gameSession.currentCardIndex]?.type === 'choice' ? (
                          <>
                            {!gameSession.p1Answer || !gameSession.p2Answer || !gameSession.reveal ? (
                              <div className="grid grid-cols-1 gap-2">
                                {activeDeck[gameSession.currentCardIndex]?.choices?.map((choice) => (
                                  <button key={choice} onClick={() => submitAnswer(choice)} disabled={!!((gameSession.p1Uid === playerId && gameSession.p1Answer) || (gameSession.p1Uid !== playerId && gameSession.p2Answer))} className={`py-3 px-6 rounded-2xl text-xs font-bold transition-all border ${(gameSession.p1Answer === choice || gameSession.p2Answer === choice) ? 'bg-[#E91E63] text-white border-[#E91E63]' : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10 shadow-inner'}`}>{choice}</button>
                                ))}
                              </div>
                            ) : null}
                          </>
                        ) : (
                          <div className="flex flex-col gap-2">
                            {(!((gameSession.p1Uid === playerId && gameSession.p1Answer) || (gameSession.p1Uid !== playerId && gameSession.p2Answer)) || !gameSession.reveal) ? (
                              <div className="flex flex-col gap-2">
                                <textarea placeholder="Share your heart..." onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitAnswer((e.target as HTMLTextAreaElement).value); } }} className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-xs text-white italic focus:ring-1 focus:ring-[#E91E63] resize-none h-20" />
                                <button onClick={(e) => { const textarea = (e.currentTarget.previousSibling as HTMLTextAreaElement); if (textarea && textarea.value) submitAnswer(textarea.value); }} className="bg-[#E91E63] text-white py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest">Submit Secret</button>
                              </div>
                            ) : null}
                          </div>
                        )}
                        <div className="flex justify-center gap-4 mt-4">
                          <div className={`flex flex-col items-center gap-1 opacity-50 ${gameSession.p1Answer ? 'opacity-100' : ''}`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs ${gameSession.p1Answer ? 'bg-green-500 text-white' : 'bg-white/10 text-white'}`}>{gameSession.p1Answer ? '✓' : '1'}</div>
                            <span className="text-[8px] text-white uppercase">{gameSession.p1Name || 'P1'}</span>
                          </div>
                          <div className={`flex flex-col items-center gap-1 opacity-50 ${gameSession.p2Answer ? 'opacity-100' : ''}`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs ${gameSession.p2Answer ? 'bg-green-500 text-white' : 'bg-white/10 text-white'}`}>{gameSession.p2Answer ? '✓' : '2'}</div>
                            <span className="text-[8px] text-white uppercase">{gameSession.p2Name || 'P2'}</span>
                          </div>
                        </div>
                        {gameSession.p1Answer && gameSession.p2Answer && (
                          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-6 p-4 bg-[#E91E63]/10 rounded-3xl border border-[#E91E63]/20 flex flex-col gap-4">
                            <div className="flex justify-between items-center">
                              <div className="text-left"><span className="text-[9px] text-[#E91E63] font-bold block uppercase">{gameSession.p1Name} picked:</span><span className="text-white text-sm font-bold">{gameSession.p1Answer}</span></div>
                              <div className="text-right"><span className="text-[9px] text-[#E91E63] font-bold block uppercase">{gameSession.p2Name} picked:</span><span className="text-white text-sm font-bold">{gameSession.p2Answer}</span></div>
                            </div>
                            {gameSession.p1Answer === gameSession.p2Answer ? (
                              <div className="flex items-center justify-center gap-2 py-2 text-pink-400 font-bold text-xs uppercase tracking-widest animate-pulse"><Heart size={14} fill="currentColor" /> It's a Match! <Heart size={14} fill="currentColor" /></div>
                            ) : (<p className="text-[10px] text-slate-400 italic">Beautifully different perspectives...</p>)}
                          </motion.div>
                        )}
                      </div>
                    </motion.div>
                  </AnimatePresence>
                </div>
                <div className="flex gap-4">
                  <button onClick={() => updateGame({ status: 'idle' })} className="flex-1 py-4 bg-white/5 text-slate-400 rounded-full text-xs font-bold shadow-sm border border-white/5">Exit</button>
                  <button onClick={nextCard} className="flex-[2] py-4 bg-[#E91E63] text-white rounded-full text-xs font-bold shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2">Next Prompt <Plus size={16} /></button>
                </div>
              </div>
            )}
            <p className="text-[10px] text-center text-gray-400 italic mb-4">"Connect your hearts, sync your desires."</p>
          </motion.div>
        )}

        {activeTab === 'events' && (
          <motion.div key="events" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="w-full flex flex-col gap-4">
            <div className="flex justify-between items-center px-2">
              <h3 className="font-serif text-lg font-bold">Upcoming Dates</h3>
              <button onClick={() => { setNewEventTitle(''); setNewEventDate(new Date().toISOString().split('T')[0]); setNewEventType('Date'); setIsAddingEvent(true); }} className="p-2 bg-[var(--color-primary-container)] text-[var(--color-on-primary-container)] rounded-full"><Plus size={16} /></button>
            </div>
            <div className="flex flex-col gap-3">
              {state.events.map((ev) => (
                <div key={ev.id} className="p-4 bg-white rounded-3xl border border-black/5 shadow-sm flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs ${ev.type === 'Date' ? 'bg-pink-100 text-pink-600' : 'bg-blue-100 text-blue-600'}`}>{ev.type?.[0] || 'E'}</div>
                    <div><p className="font-bold text-sm">{ev.title}</p><p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{ev.date}</p></div>
                  </div>
                  <button onClick={async () => { const updatedEvents = state.events.filter(e => e.id !== ev.id); setState(s => ({ ...s, events: updatedEvents })); if (state.vaultId) { await setDoc(doc(db, "couples", state.vaultId), { events: updatedEvents }, { merge: true }); } }} className="text-gray-300 hover:text-red-400"><Trash2 size={16} /></button>
                </div>
              ))}
              {state.events.length === 0 && (<div className="py-10 text-center opacity-30 italic text-sm">No upcoming dates yet.</div>)}
            </div>
            <AnimatePresence>
              {isAddingEvent && (
                <>
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60]" onClick={() => setIsAddingEvent(false)} />
                  <motion.div initial={{ scale: 0.9, y: 20, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.9, y: 20, opacity: 0 }} className="fixed inset-x-4 bottom-8 bg-white rounded-[2rem] z-[70] shadow-2xl p-6 max-w-md mx-auto" onClick={e => e.stopPropagation()}>
                    <h3 className="font-serif text-xl font-bold mb-4 text-[var(--color-primary)]">New Event</h3>
                    <input type="text" value={newEventTitle} onChange={(e) => setNewEventTitle(e.target.value)} placeholder="Event title..." className="w-full p-3 rounded-xl bg-gray-50 border border-gray-100 text-sm mb-3 focus:border-[var(--color-primary)] outline-none" autoFocus />
                    <input type="date" value={newEventDate} onChange={(e) => setNewEventDate(e.target.value)} className="w-full p-3 rounded-xl bg-gray-50 border border-gray-100 text-sm mb-3 focus:border-[var(--color-primary)] outline-none" />
                    <div className="flex gap-2 mb-4">
                      {(['Date', 'Goal', 'Anniversary'] as const).map(type => (
                        <button key={type} onClick={() => setNewEventType(type)} className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${newEventType === type ? 'bg-[var(--color-primary)] text-white' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>{type}</button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setIsAddingEvent(false)} className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-600 font-bold text-sm">Cancel</button>
                      <button onClick={addEvent} disabled={!newEventTitle.trim() || !newEventDate} className="flex-1 py-3 rounded-xl bg-[var(--color-primary)] text-white font-bold text-sm disabled:opacity-50">Add Event</button>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {activeTab === 'memory' && (
          <motion.div key="memory" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="w-full flex flex-col gap-6">
            <div className="flex justify-between items-center px-2"><h3 className="font-serif text-lg font-bold text-[var(--color-primary)]">AI Memory Bank</h3><Sparkles className="text-[var(--color-primary)] opacity-40" size={16} /></div>
            <p className="text-[10px] text-gray-500 italic px-2">Add details about past dates, favorite spots, or shared jokes. The AI will use these to personalize future date ideas.</p>
            <div className="bg-white p-4 rounded-[2rem] shadow-sm border border-black/5">
              {pendingImageUrl && (
                <div className="relative w-full aspect-video mb-4 rounded-2xl overflow-hidden group">
                  <img src={pendingImageUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" alt="Pending upload" />
                  <button onClick={() => setPendingImageUrl(null)} className="absolute top-2 end-2 bg-black/50 text-white p-1.5 rounded-full"><Trash2 size={14} /></button>
                </div>
              )}
              <textarea value={newMemory} onChange={(e) => setNewMemory(e.target.value)} placeholder="Write down a memory or reflection..." className="w-full h-24 bg-transparent border-none focus:ring-0 text-sm italic resize-none" />
              <div className="flex flex-col gap-4 mt-2 px-1">
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Category:</span>
                  <div className="flex flex-wrap gap-1">
                    {['General', 'Joke', 'Favorite', 'Date', 'Important'].map(cat => (
                      <button key={cat} onClick={() => setNewMemoryCategory(cat as any)} className={`text-[9px] px-2 py-1 rounded-full border transition-all ${newMemoryCategory === cat ? 'bg-black text-white border-black shadow-sm' : 'bg-gray-50 text-gray-500 border-gray-100 hover:bg-gray-100'}`}>{cat}</button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Reveal After:</span>
                  <div className="flex gap-1">
                    {[{ id: 'now', label: 'Now' }, { id: '1m', label: '1 Month' }, { id: '6m', label: '6 Months' }, { id: '1y', label: '1 Year' }].map(opt => (
                      <button key={opt.id} onClick={() => setRevealOption(opt.id as any)} className={`text-[9px] px-2 py-1 rounded-full border transition-all ${revealOption === opt.id ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)] shadow-sm' : 'bg-gray-50 text-gray-500 border-gray-100'}`}>{opt.label}</button>
                    ))}
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <button onClick={() => (document.getElementById('memory-upload') as HTMLInputElement)?.click()} disabled={isAnalyzing} className="p-2 text-gray-400 hover:text-[var(--color-primary)] transition-colors flex items-center gap-2">
                    {isAnalyzing ? <Loader2 size={20} className="animate-spin" /> : <Share2 size={20} />}
                    {pendingImageUrl && <span className="text-[10px] font-bold text-green-500">Photo Attached</span>}
                  </button>
                  <input id="memory-upload" type="file" className="hidden" accept="image/*" onChange={handleMemoryUpload} />
                  <button onClick={addMemory} disabled={(!newMemory.trim() && !pendingImageUrl) || isAnalyzing} className="bg-[var(--color-primary)] text-white px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 shadow-lg hover:scale-105 active:scale-95 transition-all disabled:opacity-50"><Plus size={14} /> {revealOption === 'now' ? 'Store Memory' : 'Create Time Capsule'}</button>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              {state.aiMemory.explicitMemories.length === 0 && (<div className="py-10 text-center opacity-30 italic text-sm">No memories in the vault yet.</div>)}
              {state.aiMemory.explicitMemories.map((mem, idx) => {
                const isLocked = mem.revealDate && new Date(mem.revealDate) > new Date();
                const revealDateObj = mem.revealDate ? new Date(mem.revealDate) : null;
                return (
                  <motion.div key={mem.id || idx} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`p-4 rounded-3xl border border-black/5 flex items-start gap-4 transition-all ${isLocked ? 'bg-gray-100 opacity-60 grayscale' : 'bg-white/60 backdrop-blur-md shadow-sm'}`}>
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${isLocked ? 'bg-gray-200 text-gray-400' : 'bg-[var(--color-primary-container)] text-[var(--color-primary)]'}`}>{isLocked ? <Lock size={18} /> : <Sparkles size={18} />}</div>
                    <div className="flex-1">
                      {isLocked ? (
                        <div><p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Time Capsule</p><p className="text-xs text-gray-500 italic">Encrypted until {revealDateObj?.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</p></div>
                      ) : (
                        <>{mem.imageUrl && (<div className="w-full aspect-video rounded-2xl overflow-hidden mb-3 border border-black/5 cursor-pointer hover:opacity-90 transition-opacity" onClick={() => setSelectedMedia({ url: mem.imageUrl, title: mem.content, date: mem.timestamp })}><img src={mem.imageUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" alt="Memory" /></div>)}<p className="text-xs text-gray-700 leading-relaxed font-medium">{mem.content}</p><p className="text-[9px] font-bold text-gray-400 mt-2 uppercase tracking-wide opacity-50">Stored: {new Date(mem.timestamp).toLocaleDateString()}</p></>
                      )}
                    </div>
                    <button onClick={() => removeMemory(mem.id)} className="text-gray-300 hover:text-red-400 p-1 self-start"><Trash2 size={14} /></button>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}

        {activeTab === 'letters' && (
          <motion.div key="letters" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="w-full flex flex-col gap-6">
            <div className="bg-white p-4 rounded-[2rem] shadow-sm border border-black/5">
              <textarea value={newLetter} onChange={(e) => setNewLetter(e.target.value)} placeholder="Write a private letter to your love..." className="w-full h-24 bg-transparent border-none focus:ring-0 text-sm italic resize-none" />
              <div className="flex justify-end mt-2"><button onClick={addLetter} className="bg-[var(--color-primary)] text-white px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 shadow-lg"><Send size={14} /> Send to Vault</button></div>
            </div>
            <div className="flex flex-col gap-4">
              {state.letters.map((letter) => (
                <div key={letter.id} className="p-6 bg-white/60 backdrop-blur-md rounded-[2.5rem] border border-black/5 shadow-md relative overflow-hidden">
                  <div className="absolute top-0 end-0 w-16 h-16 bg-[var(--color-primary-container)] rotate-45 translate-x-8 -translate-y-8 opacity-20" />
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-primary)] mb-2">{letter.from} → {letter.to}</p>
                  <p className="text-sm font-medium italic leading-relaxed text-gray-700">"{letter.content}"</p>
                  <p className="text-[9px] font-bold text-gray-400 mt-4 text-right">{letter.timestamp}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedMedia && (
          <AdvancedMediaPlayer src={selectedMedia.url} title={selectedMedia.title} date={selectedMedia.date ? new Date(selectedMedia.date).toLocaleDateString() : undefined} onClose={() => setSelectedMedia(null)} />
        )}
      </AnimatePresence>
    </div>
    </PullToRefresh>
  );
});

export default SanctuaryScreen;

const TabButton = React.memo(function TabButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button onClick={onClick} className={`shrink-0 flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-xl transition-all ${active ? 'bg-white shadow-sm text-[var(--color-primary)] font-bold' : 'text-gray-500 font-medium hover:bg-white/50'} text-[11px]`}>
      {icon}<span className="whitespace-nowrap">{label}</span>
    </button>
  );
});
