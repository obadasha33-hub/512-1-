import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Send, Loader2 } from 'lucide-react';
import PullToRefresh from './PullToRefresh';

interface ImportedMessage {
  id: number;
  sender: string;
  text: string;
  timestamp: string;
  time: string;
}

interface ImportedChatViewerProps {
  messages: ImportedMessage[];
  onClose: () => void;
}

export default function ImportedChatViewer({ messages, onClose }: ImportedChatViewerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const filtered = searchQuery.trim()
    ? messages.filter(m => m.text?.toLowerCase().includes(searchQuery.toLowerCase()))
    : messages;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 20, opacity: 0 }}
        className="w-full max-w-lg mx-4 h-[80vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 border-b border-gray-100 flex items-center gap-3">
          <h3 className="font-bold text-lg flex-1">Imported Chat History</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <div className="p-3 border-b border-gray-50">
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search imported messages..."
            className="w-full px-4 py-2 bg-gray-50 rounded-full text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
          />
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2">
          {filtered.length === 0 ? (
            <div className="text-center text-gray-400 py-8 text-sm">No messages found</div>
          ) : (
            filtered.map((msg, i) => (
              <div
                key={msg.id || i}
                className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                  msg.sender === 'Obada Shabanieh'
                    ? 'bg-[var(--color-primary-container)] ml-auto'
                    : 'bg-gray-100 mr-auto'
                }`}
              >
                <p className="text-gray-700 whitespace-pre-wrap">{msg.text}</p>
                <span className="text-[10px] text-gray-400 mt-1 block">{msg.time}</span>
              </div>
            ))
          )}
        </div>

        <div className="p-2 border-t border-gray-100 text-center text-[10px] text-gray-400">
          {filtered.length} of {messages.length} messages
        </div>
      </motion.div>
    </motion.div>
  );
}
