/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AppState, MemoryEntry } from '../types';
import { ASSETS } from '../constants';
import { Camera, MapPin, Share2, X, Plus, Calendar, Bell, Loader2, Sparkles, Check, Heart } from 'lucide-react';
import { doc, setDoc, db } from '../lib/supabaseFirestoreCompat';
import AdvancedMediaPlayer from '../components/AdvancedMediaPlayer';
import PullToRefresh from '../components/PullToRefresh';

export const MemoriesScreen = React.memo(function MemoriesScreen({ state, setState, onRefresh }: { state: AppState, setState: React.Dispatch<React.SetStateAction<AppState>>, onRefresh?: () => Promise<void> }) {
  const [isAdding, setIsAdding] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<{ url: string, text: string, date: string } | null>(null);
  
  const [newText, setNewText] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [remindOption, setRemindOption] = useState<'none' | '1m' | '1y'>('none');
  const [memoryDate, setMemoryDate] = useState(new Date().toISOString().split('T')[0]);

  const allMemories = state.aiMemory.explicitMemories
    .map(m => ({
      id: m.id,
      tag: 'Memory',
      date: new Date(m.timestamp).toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: 'numeric' }).toUpperCase(),
      text: m.content,
      image: m.imageUrl || ASSETS.memories.paris,
    }));

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const { uploadMedia } = await import('../lib/media');
      const url = await uploadMedia(file, state.vaultId);
      setImageUrl(url);
    } catch (err) {
      console.error(err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleAddMemory = async () => {
    if (!newText.trim() && !imageUrl) return;

    let revealDate: string | undefined = undefined;
    if (remindOption !== 'none') {
      const rDate = new Date();
      if (remindOption === '1m') rDate.setMonth(rDate.getMonth() + 1);
      if (remindOption === '1y') rDate.setFullYear(rDate.getFullYear() + 1);
      revealDate = rDate.toISOString();
    }

    const newMemory: MemoryEntry = {
      id: Date.now().toString(),
      content: newText,
      imageUrl: imageUrl || undefined,
      timestamp: new Date(memoryDate).toISOString(),
      revealDate
    };

    const updatedMemories = [newMemory, ...state.aiMemory.explicitMemories];

    setState(s => ({
      ...s,
      aiMemory: {
        ...s.aiMemory,
        explicitMemories: updatedMemories
      }
    }));

    if (state.vaultId) {
      try {
        await setDoc(doc(db, "couples", state.vaultId), {
          aiMemory: {
            ...state.aiMemory,
            explicitMemories: updatedMemories
          }
        }, { merge: true });
      } catch (err) {
        console.error("Sync failed", err);
      }
    }

    setNewText('');
    setImageUrl(null);
    setRemindOption('none');
    setIsAdding(false);
  };

  return (
    <PullToRefresh onRefresh={onRefresh || (() => Promise.resolve())}>
    <div className="flex flex-col gap-6 relative">
      <div className="mb-4">
        <h2 className="font-serif text-3xl font-bold mb-2">Shared Moments</h2>
        <p className="text-[var(--color-text-sub)] text-sm">A collection of our favorite memories together.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {allMemories.length === 0 && (
          <div className="col-span-full py-20 text-center">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-dashed border-gray-200">
               <Camera size={24} className="text-gray-300" />
            </div>
            <p className="text-sm text-gray-400">No memories captured yet. Start your story!</p>
          </div>
        )}

        {allMemories.map((mem, idx) => (
          <motion.article 
            key={mem.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="group relative rounded-[2.5rem] overflow-hidden shadow-2xl bg-white border border-black/[0.03] flex flex-col cursor-pointer transition-transform active:scale-[0.98]"
            onClick={() => setSelectedMedia({ url: mem.image, text: mem.text, date: mem.date })}
          >
            <div className="absolute top-5 start-5 z-10 bg-black/30 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/20 flex items-center gap-2">
              <span className="text-[10px]"></span>
              <span className="text-[10px] font-black uppercase tracking-widest text-white">{mem.tag}</span>
            </div>

            <div className="aspect-[4/5] overflow-hidden">
              <img 
                src={mem.image} 
                alt={mem.tag} 
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000" 
              />
            </div>

            <div className="p-6 bg-white flex flex-col relative">
              <p className="text-[15px] font-medium leading-[1.4] text-[var(--color-text-main)] mb-3 pe-8">{mem.text}</p>
              
              <div className="flex justify-between items-center mt-auto">
                <time className="text-[11px] font-black text-gray-500 uppercase tracking-widest">{mem.date}</time>
                <button 
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (navigator.share) {
                      try {
                        await navigator.share({
                          title: 'Our Memory',
                          text: mem.text,
                        });
                      } catch (err) {
                        if ((err as Error).name !== 'AbortError') {
                          navigator.clipboard.writeText(mem.text);
                        }
                      }
                    } else {
                      navigator.clipboard.writeText(mem.text);
                    }
                  }} 
                  className="text-gray-200 hover:text-[var(--color-primary)] transition-colors"
                >
                  <Share2 size={18} strokeWidth={2.5} />
                </button>
              </div>
              
              <div className="absolute top-0 end-0 w-16 h-16 bg-gradient-to-bl from-gray-50 to-transparent opacity-50 rounded-tr-3xl" />
            </div>
          </motion.article>
        ))}
      </div>

      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsAdding(true)}
        className="fixed bottom-32 end-8 w-16 h-16 rounded-full bg-gradient-to-br from-pink-400 to-rose-600 text-white shadow-2xl flex items-center justify-center z-40 border-4 border-white"
      >
        <Camera size={26} strokeWidth={2.5} />
      </motion.button>

      <AnimatePresence>
        {isAdding && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60]"
              onClick={() => setIsAdding(false)}
            />
            <motion.div 
              initial={{ height: 0, opacity: 0, scale: 0.9, y: 100 }}
              animate={{ height: 'auto', opacity: 1, scale: 1, y: 0 }}
              exit={{ height: 0, opacity: 0, scale: 0.9, y: 100 }}
              className="fixed bottom-4 start-4 end-4 bg-white rounded-[2.5rem] z-[70] shadow-2xl flex flex-col overflow-hidden max-w-lg mx-auto"
            >
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="font-serif text-xl font-bold flex items-center gap-2">
                    <Sparkles className="text-pink-500" size={18} />
                    Capture a Moment
                  </h3>
                  <button onClick={() => setIsAdding(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400">
                    <X size={20} />
                  </button>
                </div>

                <div className="space-y-6">
                  <div 
                    onClick={() => document.getElementById('memory-photo')?.click()}
                    className="relative aspect-video rounded-3xl bg-gray-50 border-2 border-dashed border-gray-100 flex items-center justify-center overflow-hidden cursor-pointer group transition-all hover:border-pink-200"
                  >
                    {imageUrl ? (
                      <>
                        <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <Camera className="text-white" size={32} />
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center gap-3 text-gray-400">
                        {isUploading ? <Loader2 size={32} className="animate-spin text-pink-400" /> : <Camera size={32} />}
                        <span className="text-xs font-bold uppercase tracking-widest">Add Photo</span>
                      </div>
                    )}
                  </div>
                  <input id="memory-photo" type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} />

                  <textarea 
                    value={newText}
                    onChange={(e) => setNewText(e.target.value)}
                    placeholder="Tell the story of this moment..."
                    className="w-full bg-transparent border-none focus:ring-0 text-sm italic resize-none p-0 h-20 placeholder:text-gray-300"
                  />

                  <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-50">
                    <div className="flex-1 min-w-[140px] flex items-center gap-3 bg-gray-50/50 p-3 rounded-2xl border border-gray-100">
                      <Calendar size={16} className="text-pink-400" />
                      <input 
                        type="date" 
                        value={memoryDate}
                        onChange={(e) => setMemoryDate(e.target.value)}
                        className="bg-transparent border-none text-[11px] font-bold uppercase p-0 focus:ring-0 text-gray-600 w-full"
                      />
                    </div>

                    <div className="flex-1 min-w-[140px] flex items-center gap-2 bg-gray-50/50 p-2 rounded-2xl border border-gray-100">
                      <Bell size={16} className="text-pink-400 ms-1" />
                      <div className="flex gap-1 flex-1">
                        {[
                          { id: 'none', label: 'None' },
                          { id: '1m', label: '1M' },
                          { id: '1y', label: '1Y' }
                        ].map(opt => (
                          <button
                            key={opt.id}
                            onClick={() => setRemindOption(opt.id as any)}
                            className={`flex-1 py-1 rounded-xl text-[9px] font-bold transition-all ${
                              remindOption === opt.id 
                                ? 'bg-pink-500 text-white' 
                                : 'text-gray-400 hover:text-gray-600'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <button 
                    onClick={handleAddMemory}
                    disabled={(!newText.trim() && !imageUrl) || isUploading}
                    className="w-full py-4 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-[1.5rem] text-sm font-black uppercase tracking-widest shadow-xl shadow-pink-200 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isUploading ? <Loader2 size={18} className="animate-spin" /> : <Heart size={18} fill="currentColor" />}
                    Store This Forever
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedMedia && (
          <AdvancedMediaPlayer 
            src={selectedMedia.url}
            title={selectedMedia.text}
            date={selectedMedia.date}
            onClose={() => setSelectedMedia(null)}
          />
        )}
      </AnimatePresence>
    </div>
    </PullToRefresh>
  );
});

export default MemoriesScreen;
