import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { useAppStore } from './sanctuary-store';

const CHANNEL_ID = 'sanctuary-messages';
const CHANNEL_NAME = 'Sanctuary Messages';
const CHANNEL_DESCRIPTION = 'Messages, signals, and memory anniversaries from your partner';

let initialized = false;
let permissionGranted = false;

function isNative(): boolean {
  return typeof window !== 'undefined' && Capacitor.isNativePlatform();
}

function shortId(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % 2_000_000_000;
}

export async function initNotifications(): Promise<boolean> {
  if (initialized) return permissionGranted;
  initialized = true;

  if (typeof window === 'undefined') return false;

  if (!isNative()) {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') {
      permissionGranted = true;
      return true;
    }
    if (Notification.permission === 'denied') return false;
    const result = await Notification.requestPermission();
    permissionGranted = result === 'granted';
    return permissionGranted;
  }

  try {
    const perm = await LocalNotifications.requestPermissions();
    permissionGranted = perm.display === 'granted';
    if (!permissionGranted) return false;

    await LocalNotifications.createChannel({
      id: CHANNEL_ID,
      name: CHANNEL_NAME,
      description: CHANNEL_DESCRIPTION,
      importance: 4,
      visibility: 1,
      sound: 'default',
      vibration: true,
    });

    LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
      const extra = action.notification.extra;
      if (extra?.type === 'memory' || extra?.type === 'message' || extra?.type === 'signal') {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('sanctuary:notification-tap', { detail: extra }));
        }
      }
    });

    return true;
  } catch (e) {
    console.warn('[Notifications] init failed:', e);
    return false;
  }
}

export function shouldNotifyMessage(): boolean {
  const s = useAppStore.getState();
  if (!s.notificationSettings.messages) return false;
  if (s.chatMuted) return false;
  if (s.chatOpen && s.currentTab === 'chat') return false;
  return true;
}

export function shouldNotifySignal(): boolean {
  const s = useAppStore.getState();
  if (!s.notificationSettings.signals) return false;
  return true;
}

export function shouldNotifyMemory(): boolean {
  const s = useAppStore.getState();
  if (!s.notificationSettings.memories) return false;
  return true;
}

export async function notifyMessage(opts: {
  partnerName: string;
  partnerPhoto?: string;
  text?: string;
  hasAudio?: boolean;
  hasImage?: boolean;
  hasVideo?: boolean;
}): Promise<void> {
  if (!permissionGranted) return;
  if (!shouldNotifyMessage()) return;
  const s = useAppStore.getState();

  const preview = opts.text
    || (opts.hasAudio ? 'Voice message' 
    : opts.hasImage ? 'Photo' 
    : opts.hasVideo ? 'Video' 
    : 'Sent you a message');

  await dispatchLocal({
    id: shortId(`msg-${Date.now()}-${Math.random()}`),
    title: opts.partnerName,
    body: s.notificationSettings.showPreview ? preview : 'New message',
    photoUrl: opts.partnerPhoto,
    extra: { type: 'message' },
  });

  if (s.notificationSettings.vibration && typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate([100, 50, 100]);
  }
}

export async function notifySignal(opts: {
  partnerName: string;
  partnerPhoto?: string;
  type: 'miss' | 'hug' | 'kiss';
}): Promise<void> {
  if (!permissionGranted) return;
  if (!shouldNotifySignal()) return;
  const s = useAppStore.getState();

  const labels: Record<string, { text: string; emoji: string }> = {
    miss: { text: 'Miss You', emoji: '💕' },
    hug: { text: 'a Hug', emoji: '🤗' },
    kiss: { text: 'a Kiss', emoji: '💋' },
  };
  const l = labels[opts.type] || { text: 'a signal', emoji: '💌' };

  await dispatchLocal({
    id: shortId(`signal-${opts.type}-${Date.now()}`),
    title: `${opts.partnerName} ${l.emoji}`,
    body: `Sent you ${l.text}`,
    photoUrl: opts.partnerPhoto,
    extra: { type: 'signal', subtype: opts.type },
  });

  if (s.notificationSettings.vibration && typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate([200, 100, 200]);
  }
}

export async function notifyMoodUpdate(opts: {
  partnerName: string;
  partnerPhoto?: string;
  mood: string;
}): Promise<void> {
  if (!permissionGranted) return;
  const s = useAppStore.getState();
  if (!s.notificationSettings.moodUpdates) return;

  await dispatchLocal({
    id: shortId(`mood-${Date.now()}`),
    title: opts.partnerName,
    body: `Updated mood to ${opts.mood}`,
    photoUrl: opts.partnerPhoto,
    extra: { type: 'mood' },
  });
}

export async function scheduleMemoryAnniversary(opts: {
  memoryId: string;
  content: string;
  imageUrl?: string;
  memoryDate: string;
}): Promise<void> {
  if (!permissionGranted) return;
  if (!shouldNotifyMemory()) return;
  if (!isNative()) return;

  const memoryDate = new Date(opts.memoryDate);
  if (isNaN(memoryDate.getTime())) return;

  const now = new Date();
  const firstAnniversary = new Date(memoryDate);
  firstAnniversary.setFullYear(firstAnniversary.getFullYear() + 1);

  let nextDate = new Date(firstAnniversary);
  while (nextDate <= now) {
    nextDate.setFullYear(nextDate.getFullYear() + 1);
  }

  const id = shortId(`memory-${opts.memoryId}`);
  const partnerName = await getPartnerName();

  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          id,
          title: `Memory Anniversary ${partnerName ? '💕' : '💝'}`,
          body: partnerName
            ? `${partnerName}: ${truncate(opts.content, 100)}`
            : truncate(opts.content, 100),
          smallIcon: 'ic_stat_icon_configurable',
          iconColor: '#9b87f5',
          attachments: opts.imageUrl
            ? [{ id: 'memory-img', url: opts.imageUrl, options: {} }]
            : undefined,
          schedule: { at: nextDate, allowWhileIdle: true },
          channelId: CHANNEL_ID,
          extra: { type: 'memory', memoryId: opts.memoryId },
        },
      ],
    });
  } catch (e) {
    console.warn('[Notifications] schedule memory failed:', e);
  }
}

export async function cancelMemoryAnniversary(memoryId: string): Promise<void> {
  if (!isNative()) return;
  const id = shortId(`memory-${memoryId}`);
  try {
    await LocalNotifications.cancel({ notifications: [{ id }] });
  } catch {}
}

export async function cancelAllMemoryAnniversaries(): Promise<void> {
  if (!isNative()) return;
  try {
    const pending = await LocalNotifications.getPending();
    const memoryNotifs = pending.notifications
      .filter((n) => n.extra?.type === 'memory')
      .map((n) => ({ id: n.id }));
    if (memoryNotifs.length > 0) {
      await LocalNotifications.cancel({ notifications: memoryNotifs });
    }
  } catch {}
}

export async function rescheduleAllMemoryAnniversaries(memories: Array<{
  id: string;
  content: string;
  imageUrl?: string;
  timestamp: string;
}>): Promise<void> {
  if (!isNative()) return;
  await cancelAllMemoryAnniversaries();
  for (const m of memories) {
    if (!m.timestamp) continue;
    await scheduleMemoryAnniversary({
      memoryId: m.id,
      content: m.content,
      imageUrl: m.imageUrl,
      memoryDate: m.timestamp,
    });
  }
}

async function dispatchLocal(opts: {
  id: number;
  title: string;
  body: string;
  photoUrl?: string;
  extra?: Record<string, string>;
}): Promise<void> {
  if (isNative()) {
    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: opts.id,
            title: opts.title,
            body: opts.body,
            smallIcon: 'ic_stat_icon_configurable',
            iconColor: '#9b87f5',
            attachments: opts.photoUrl
              ? [{ id: 'partner-photo', url: opts.photoUrl, options: {} }]
              : undefined,
            channelId: CHANNEL_ID,
            extra: opts.extra,
          },
        ],
      });
    } catch (e) {
      console.warn('[Notifications] local dispatch failed:', e);
    }
  } else {
    if (typeof window === 'undefined' || Notification.permission !== 'granted') return;
    try {
      new Notification(opts.title, {
        body: opts.body,
        icon: opts.photoUrl || '/logo.svg',
        badge: '/logo.svg',
        tag: opts.extra?.type || 'sanctuary',
        data: opts.extra,
      });
    } catch (e) {
      console.warn('[Notifications] web dispatch failed:', e);
    }
  }
}

async function getPartnerName(): Promise<string | null> {
  const s = useAppStore.getState();
  if (s.identity === 'Batman') return s.princessName;
  return s.batmanName;
}

function truncate(str: string, n: number): string {
  if (!str) return '';
  return str.length > n ? str.slice(0, n) + '…' : str;
}
