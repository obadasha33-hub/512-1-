import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, MessageCircle, Heart, Sparkles, Smile, Bell } from 'lucide-react';
import type { NotificationItem } from '../types';
import { onToast } from '../lib/notificationService';

const ICONS: Record<string, React.ReactNode> = {
  message: <MessageCircle size={16} />,
  signal: <Heart size={16} />,
  memory: <Sparkles size={16} />,
  mood: <Smile size={16} />,
  system: <Bell size={16} />,
};

const COLORS: Record<string, string> = {
  message: 'bg-blue-500',
  signal: 'bg-pink-500',
  memory: 'bg-purple-500',
  mood: 'bg-amber-500',
  system: 'bg-gray-500',
};

export default function InAppToast() {
  const [queue, setQueue] = useState<NotificationItem[]>([]);

  useEffect(() => {
    onToast((item) => {
      setQueue(prev => [...prev, item]);
    });
  }, []);

  const dismiss = useCallback((id: string) => {
    setQueue(prev => prev.filter(n => n.id !== id));
  }, []);

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[200] flex flex-col gap-2 w-[90%] max-w-sm pointer-events-none">
      <AnimatePresence>
        {queue.slice(0, 3).map((item) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: -40, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 100, scale: 0.9 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className="pointer-events-auto bg-white/95 backdrop-blur-lg rounded-2xl shadow-2xl border border-white/30 p-3 flex items-start gap-3"
            onClick={() => dismiss(item.id)}
          >
            <div className={`w-8 h-8 rounded-full ${COLORS[item.type] || 'bg-gray-500'} flex items-center justify-center text-white shrink-0`}>
              {ICONS[item.type] || <Bell size={16} />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold text-gray-800 leading-tight">{item.title}</p>
              <p className="text-[12px] text-gray-600 mt-0.5 line-clamp-2 leading-snug">{item.body}</p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); dismiss(item.id); }}
              className="text-gray-400 hover:text-gray-600 shrink-0"
            >
              <X size={14} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
