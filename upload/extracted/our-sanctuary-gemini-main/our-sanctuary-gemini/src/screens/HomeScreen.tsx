/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { ReactNode, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AppState } from '../types';
import { ASSETS } from '../constants';
import { Heart, Bell, Smile, Waves, ChevronRight, Sparkles, Calendar } from 'lucide-react';
import { sendRemoteNotification } from '../lib/remoteNotifications';
import PullToRefresh from '../components/PullToRefresh';

const HomeScreen = React.memo(function HomeScreen({ 
  state, 
  setState,
  onRefresh 
}: { 
  state: AppState, 
  setState: React.Dispatch<React.SetStateAction<AppState>>,
  onRefresh?: () => Promise<void>
}) {
  const [isEditingDate, setIsEditingDate] = useState(false);
  const myMood = state.moods.find(m => m.userId === state.identity)?.mood || '😊';
  const partnerMood = state.moods.find(m => m.userId !== state.identity)?.mood || '💖';

  const myName = state.identity === 'Batman' ? state.batmanName : state.princessName;
  const partnerName = state.identity === 'Batman' ? state.princessName : state.batmanName;
  const myPhoto = state.identity === 'Batman' ? state.batmanPhoto : state.princessPhoto;
  const partnerPhoto = state.identity === 'Batman' ? state.princessPhoto : state.batmanPhoto;

  const daysTogether = useMemo(() => {
    if (!state.relationshipStartDate) return state.daysTogether;
    const start = new Date(state.relationshipStartDate);
    start.setHours(0, 0, 0, 0);
    const now = new Date();
    const diffTime = now.getTime() - start.getTime();
    return Math.max(1, Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1);
  }, [state.relationshipStartDate, state.daysTogether]);

  const unlockedMemories = state.aiMemory.explicitMemories.filter(m => 
    m.revealDate && new Date(m.revealDate) <= new Date() && 
    // Only show if it was revealed in the last 7 days to keep it fresh
    (new Date().getTime() - new Date(m.revealDate).getTime()) < 7 * 24 * 60 * 60 * 1000
  );

  const updateMood = async (newMood: string) => {
    const newMoods = state.moods.map(m => m.userId === state.identity ? { ...m, mood: newMood, timestamp: new Date().toISOString() } : m);
    if (!newMoods.find(m => m.userId === state.identity)) {
      newMoods.push({ userId: state.identity as any, mood: newMood, timestamp: new Date().toISOString() });
    }

    setState(s => ({
      ...s,
      moods: newMoods
    }));

    if (!state.vaultId) return;

    // Sync to Server
    const { doc, setDoc } = await import('../lib/supabaseFirestoreCompat');
    const { db } = await import('../lib/supabaseFirestoreCompat');
    await setDoc(doc(db, "couples", state.vaultId), {
      moods: newMoods,
      lastUpdated: new Date().toISOString()
    }, { merge: true });

    // Notify Partner about mood change
    if (state.vaultId && state.identity) {
      const title = state.identity === 'Batman' ? state.batmanName : state.princessName;
      const body = `Mood updated: ${newMood}`;
      const partnerPhoto = state.identity === 'Batman' ? state.princessPhoto : state.batmanPhoto;
      sendRemoteNotification(state.vaultId, state.identity, title, body, { type: 'mood' }, partnerPhoto || undefined);
    }
  };

  const updateStartDate = async (dateStr: string) => {
    const iso = new Date(dateStr).toISOString();
    setState(s => ({ ...s, relationshipStartDate: iso }));
    if (!state.vaultId) return;
    
    // Sync to Server
    const { doc, setDoc } = await import('../lib/supabaseFirestoreCompat');
    const { db } = await import('../lib/supabaseFirestoreCompat');
    await setDoc(doc(db, "couples", state.vaultId), {
      relationshipStartDate: iso,
      lastUpdated: new Date().toISOString()
    }, { merge: true });
    setIsEditingDate(false);
  };

  const sendSignal = async (type: 'miss' | 'hug' | 'kiss') => {
    if (!state.vaultId) return;
    const { doc, setDoc } = await import('../lib/supabaseFirestoreCompat');
    const { db } = await import('../lib/supabaseFirestoreCompat');
    
    const signal = {
      type,
      senderId: state.identity as 'Batman' | 'Princess',
      timestamp: new Date().toISOString()
    };

    await setDoc(doc(db, "couples", state.vaultId), {
      activeSignal: signal,
      lastUpdated: new Date().toISOString()
    }, { merge: true });

    // Notify Partner
    if (state.vaultId && state.identity) {
      const signalNames = { miss: 'Misses You', hug: 'Sent a Hug', kiss: 'Blows a Kiss' };
      const title = state.identity === 'Batman' ? state.batmanName : state.princessName;
      const body = signalNames[type];
      const partnerPhoto = state.identity === 'Batman' ? state.princessPhoto : state.batmanPhoto;
      sendRemoteNotification(state.vaultId, state.identity, title, body, { type: 'signal' }, partnerPhoto || undefined);
    }
  };

  return (
    <PullToRefresh onRefresh={onRefresh || (() => Promise.resolve())}>
    <div className="flex flex-col gap-8">
      {/* Time Capsule Notification */}
      <AnimatePresence>
        {unlockedMemories.length > 0 && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 p-4 rounded-3xl text-white shadow-xl flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center animate-bounce">
                  <Sparkles size={20} />
                </div>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-tighter">Time Capsule Unlocked</h4>
                  <p className="text-[10px] opacity-80">A memory from the past is now visible in your Sanctuary.</p>
                </div>
              </div>
              <button 
                onClick={() => setState(s => ({ ...s, currentTab: 'sanctuary' }))}
                className="px-4 py-2 bg-white text-purple-600 rounded-full text-[10px] font-bold shadow-sm whitespace-nowrap active:scale-95 transition-all"
              >
                Open Vault
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Profiles */}
      <section className="flex justify-center items-center gap-8 py-4">
        <div className="flex flex-col items-center gap-2">
          <div className="w-20 h-20 md:w-24 md:h-24 rounded-full border-4 border-[var(--color-primary)] bg-white shadow-lg relative overflow-hidden">
            <img 
              src={myPhoto || (state.identity === 'Batman' ? ASSETS.profiles.batman : ASSETS.profiles.princess)} 
              alt="Me" 
              className="w-full h-full object-cover" 
            />
          </div>
          <span className="text-sm font-bold text-[var(--color-primary)]">{myName}</span>
          <span className="text-[10px] font-bold uppercase opacity-40">Me</span>
        </div>
        
        <motion.div 
          animate={{ scale: [1, 1.2, 1] }} 
          transition={{ repeat: Infinity, duration: 2 }}
          className="text-[var(--color-primary)]"
        >
          <Heart fill="currentColor" size={32} />
        </motion.div>

        <div className="flex flex-col items-center gap-2">
          <div className="w-20 h-20 md:w-24 md:h-24 rounded-full border-4 border-[var(--color-on-primary-container)] bg-white shadow-lg relative overflow-hidden opacity-90">
            <img 
              src={partnerPhoto || (state.identity === 'Batman' ? ASSETS.profiles.princess : ASSETS.profiles.batman)} 
              alt="Partner" 
              className="w-full h-full object-cover" 
            />
          </div>
          <span className="text-sm font-bold text-gray-700">{partnerName}</span>
          <span className="text-[10px] font-bold uppercase opacity-40">Partner</span>
        </div>
      </section>

      {/* Counter Card */}
      <motion.section 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-[2.5rem] bg-gradient-to-br from-[var(--color-primary-container)] to-[var(--color-primary)] p-8 text-center shadow-xl relative overflow-hidden text-white cursor-pointer group"
        onClick={() => setIsEditingDate(true)}
      >
        <div className="absolute inset-0 bg-white/10 backdrop-blur-[2px] group-hover:bg-white/20 transition-all"></div>
        <div className="relative z-10 flex flex-col items-center gap-2">
          <span className="text-xs uppercase tracking-[0.2em] font-semibold opacity-80 flex items-center gap-2">
            Our Great Story <Sparkles size={12} />
          </span>
          <span className="italic text-sm opacity-70">in a great love since...</span>
          <h2 className="font-serif text-8xl leading-none drop-shadow-lg my-4 relative">
            {daysTogether}
            <div className="absolute -top-4 -end-4 opacity-0 group-hover:opacity-100 transition-opacity">
              <Calendar size={24} className="text-white/50" />
            </div>
          </h2>
          <p className="text-lg opacity-90 font-medium">days together</p>
          <div className="mt-6 px-6 py-2 bg-white/20 backdrop-blur-md rounded-full border border-white/30 text-sm font-semibold flex items-center gap-2">
            <Heart size={16} fill="currentColor" />
            Forever & Always
          </div>
        </div>
      </motion.section>

      {/* Date Editor Modal */}
      <AnimatePresence>
        {isEditingDate && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6"
            onClick={() => setIsEditingDate(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white rounded-[2rem] p-8 w-full max-w-sm shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="font-serif text-2xl font-bold mb-2 text-[var(--color-primary)]">When did it start?</h3>
              <p className="text-sm text-[var(--color-text-sub)] mb-6">Select the day yours and her hearts became one.</p>
              
              <input 
                type="date" 
                defaultValue={state.relationshipStartDate ? new Date(state.relationshipStartDate).toISOString().split('T')[0] : ''}
                className="w-full p-4 rounded-2xl bg-gray-50 border-2 border-gray-100 focus:border-[var(--color-primary)] outline-none transition-all mb-6 text-lg font-semibold"
                onChange={(e) => {
                  if (e.target.value) updateStartDate(e.target.value);
                }}
              />

              <button 
                onClick={() => setIsEditingDate(false)}
                className="w-full py-4 bg-[var(--color-primary)] text-white rounded-2xl font-bold active:scale-95 transition-all shadow-lg"
              >
                Save Forever
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mood Tracker */}
      <section className="flex flex-col gap-4">
        <h3 className="font-serif text-xl font-bold px-2">How are we today?</h3>
        <div className="flex gap-4">
          <div className="flex-1 bg-white p-4 rounded-3xl border border-black/5 shadow-sm flex flex-col items-center gap-2">
            <span className="text-[10px] font-bold uppercase text-gray-400">My Mood</span>
            <div className="text-3xl">{myMood}</div>
            <div className="flex flex-wrap justify-center gap-1 mt-1">
              {['😊', '💖', '😴', '🥺', '😈'].map(m => (
                <button 
                  key={m} 
                  onClick={() => updateMood(m)}
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all ${
                    myMood === m ? 'bg-[var(--color-primary-container)] scale-110 shadow-sm' : 'bg-gray-50 hover:bg-pink-100'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 bg-white p-4 rounded-3xl border border-black/5 shadow-sm flex flex-col items-center gap-2">
            <span className="text-[10px] font-bold uppercase text-gray-400">{partnerName}'s Mood</span>
            <div className="text-3xl">{partnerMood}</div>
            <span className="text-[10px] font-medium text-gray-400 italic">
              {(() => {
                const partnerMoodEntry = state.moods.find(m => m.userId !== state.identity);
                if (!partnerMoodEntry?.timestamp) return 'no mood yet';
                const t = new Date(partnerMoodEntry.timestamp);
                const now = new Date();
                const diffMs = now.getTime() - t.getTime();
                const diffMins = Math.floor(diffMs / 60000);
                if (diffMins < 1) return 'just now';
                if (diffMins < 60) return `${diffMins}m ago`;
                const diffHrs = Math.floor(diffMins / 60);
                if (diffHrs < 24) return `${diffHrs}h ago`;
                return t.toLocaleDateString([], { month: 'short', day: 'numeric' });
              })()}
            </span>
          </div>
        </div>
      </section>

      {/* Signal Panel */}
      <section className="flex flex-col gap-3">
        <h3 className="font-serif text-xl font-bold px-2 mb-2">Signal Panel</h3>
        
        <SignalButton 
          icon={<Bell size={20} />} 
          label="Miss You" 
          primary 
          onClick={() => sendSignal('miss')}
        />
        <SignalButton 
          icon={<Smile size={20} />} 
          label="Send a Hug" 
          onClick={() => sendSignal('hug')}
        />
        <SignalButton 
          icon={<Waves size={20} />} 
          label="Blow a Kiss" 
          onClick={() => sendSignal('kiss')}
        />
      </section>
    </div>
    </PullToRefresh>
  );
});

export default HomeScreen;

const SignalButton = React.memo(function SignalButton({ icon, label, primary, onClick }: { icon: ReactNode, label: string, primary?: boolean, onClick?: () => void }) {
  return (
    <motion.button
      whileHover={{ x: 5 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`
        w-full p-4 rounded-2xl flex items-center justify-between transition-all shadow-sm
        ${primary 
          ? 'bg-[var(--color-primary)] text-white' 
          : 'bg-[var(--color-surface)] border-2 border-[var(--color-primary-container)] text-[var(--color-on-surface)]'
        }
      `}
    >
      <div className="flex items-center gap-4">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${primary ? 'bg-white/20' : 'bg-[var(--color-primary-container)] text-[var(--color-on-primary-container)]'}`}>
          {icon}
        </div>
        <span className="font-semibold">{label}</span>
      </div>
      <ChevronRight className={primary ? 'opacity-50' : 'text-gray-400'} size={20} />
    </motion.button>
  );
});
