import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, X, Heart, MessageCircle, Sparkles, Smile, CheckCheck } from 'lucide-react';
import { getNotificationHistory, getUnreadCount, markAllRead, onBadgeUpdate } from '../lib/notificationService';
import type { NotificationItem } from '../types';

const ICONS: Record<string, React.ReactNode> = {
  message: <MessageCircle size={14} />,
  signal: <Heart size={14} />,
  memory: <Sparkles size={14} />,
  mood: <Smile size={14} />,
  system: <Bell size={14} />,
};

const COLORS: Record<string, string> = {
  message: 'bg-blue-500',
  signal: 'bg-pink-500',
  memory: 'bg-purple-500',
  mood: 'bg-amber-500',
  system: 'bg-gray-500',
};

type TimeAgo = string;

function timeAgo(iso: string): TimeAgo {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString();
}

export default function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [history, setHistory] = useState<NotificationItem[]>([]);

  useEffect(() => {
    setUnread(getUnreadCount());
    setHistory(getNotificationHistory());
    onBadgeUpdate((count) => {
      setUnread(count);
      setHistory(getNotificationHistory());
    });
  }, []);

  const refresh = () => {
    setUnread(getUnreadCount());
    setHistory(getNotificationHistory());
  };

  return (
    <>
      <button
        onClick={() => { setOpen(v => !v); refresh(); }}
        className="relative p-2 rounded-full hover:bg-black/5 transition-colors"
      >
        <Bell size={22} className="text-gray-600" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150] bg-black/30 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ y: -20, opacity: 0, scale: 0.95 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: -20, opacity: 0, scale: 0.95 }}
              className="absolute top-16 left-2 right-2 mx-auto max-w-md bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <h2 className="text-sm font-bold text-gray-800">Notifications</h2>
                <div className="flex items-center gap-2">
                  {unread > 0 && (
                    <button
                      onClick={() => { markAllRead(); refresh(); }}
                      className="text-[10px] font-semibold text-blue-600 flex items-center gap-1"
                    >
                      <CheckCheck size={12} /> Mark all read
                    </button>
                  )}
                  <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
                    <X size={18} />
                  </button>
                </div>
              </div>
              <div className="max-h-[60vh] overflow-y-auto">
                {history.length === 0 ? (
                  <div className="p-8 text-center text-gray-400 text-sm">No notifications yet</div>
                ) : (
                  history.map((item) => (
                    <div
                      key={item.id}
                      className={`flex items-start gap-3 px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${!item.read ? 'bg-blue-50/50' : ''}`}
                    >
                      <div className={`w-7 h-7 rounded-full ${COLORS[item.type] || 'bg-gray-500'} flex items-center justify-center text-white shrink-0 mt-0.5`}>
                        {ICONS[item.type] || <Bell size={12} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-bold text-gray-800">{item.title}</p>
                        <p className="text-[11px] text-gray-600 mt-0.5 line-clamp-2">{item.body}</p>
                      </div>
                      <span className="text-[9px] text-gray-400 whitespace-nowrap mt-1">{timeAgo(item.timestamp)}</span>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
