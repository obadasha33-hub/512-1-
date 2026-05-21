import { LocalNotifications, Channel } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import type { NotificationItem, NotificationSettings } from '../types';
import { DEFAULT_NOTIFICATION_SETTINGS } from '../types';
import { sendRemoteNotification } from './remoteNotifications';

let toastCallback: ((n: NotificationItem) => void) | null = null;
let badgeCallback: ((count: number) => void) | null = null;
let notificationHistory: NotificationItem[] = [];
let settings: NotificationSettings = { ...DEFAULT_NOTIFICATION_SETTINGS };

const CHANNEL_ID = 'sanctuary-general';

export async function ensureNotificationChannel() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const existing = await LocalNotifications.listChannels();
    if (existing.channels?.some((c: { id: string }) => c.id === CHANNEL_ID)) return;
    await LocalNotifications.createChannel({
      id: CHANNEL_ID,
      name: 'Sanctuary Notifications',
      description: 'Messages, signals, and memories from your partner',
      importance: 5,
      visibility: 1,
      sound: 'default',
      vibration: true,
    });
  } catch (e) {
    console.error('Failed to create notification channel:', e);
  }
}

export function setNotificationSettings(s: NotificationSettings) {
  settings = { ...s };
}

export function getNotificationSettings(): NotificationSettings {
  return { ...settings };
}

export function onToast(cb: (n: NotificationItem) => void) {
  toastCallback = cb;
}

export function onBadgeUpdate(cb: (count: number) => void) {
  badgeCallback = cb;
}

export function getUnreadCount(): number {
  return notificationHistory.filter(n => !n.read).length;
}

export function getNotificationHistory(): NotificationItem[] {
  return [...notificationHistory];
}

export function markAllRead() {
  notificationHistory = notificationHistory.map(n => ({ ...n, read: true }));
  badgeCallback?.(0);
}

export function markRead(id: string) {
  notificationHistory = notificationHistory.map(n => n.id === id ? { ...n, read: true } : n);
  badgeCallback?.(getUnreadCount());
}

export function resetNotificationService() {
  notificationHistory = [];
  settings = { ...DEFAULT_NOTIFICATION_SETTINGS };
  toastCallback = null;
  badgeCallback = null;
}

function addToHistory(item: NotificationItem) {
  notificationHistory = [item, ...notificationHistory].slice(0, 200);
  badgeCallback?.(getUnreadCount());
}

function shouldNotify(notifType: NotificationItem['type']): boolean {
  switch (notifType) {
    case 'message': return settings.messages;
    case 'signal': return settings.signals;
    case 'memory': return settings.memories;
    case 'mood': return settings.moodUpdates;
    default: return true;
  }
}

export async function showLocalNotification(title: string, body: string, icon?: string) {
  try {
    if (Capacitor.isNativePlatform()) {
      if (settings.vibration) {
        await Haptics.vibrate({ duration: 300 });
      }
      const perm = await LocalNotifications.checkPermissions();
      if (perm.display !== 'granted') {
        const req = await LocalNotifications.requestPermissions();
        if (req.display !== 'granted') return;
      }
      await LocalNotifications.schedule({
        notifications: [{
          title,
          body,
          id: Date.now(),
          schedule: { at: new Date(Date.now() + 100) },
          channelId: CHANNEL_ID,
          ...(icon ? { largeBody: icon } : {}),
          sound: settings.sound ? 'default' : undefined,
        }],
      });
    } else {
      if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
        new Notification(title, { body, icon: icon || '/icon-512x512.svg' });
      }
    }
  } catch (error) {
    console.error('Failed to show notification:', error);
  }
}

export async function dispatchNotification(
  type: NotificationItem['type'],
  title: string,
  body: string,
  options?: {
    imageUrl?: string;
    data?: Record<string, string>;
    vaultId?: string;
    senderId?: string;
    partnerPhoto?: string;
    skipRemote?: boolean;
  },
) {
  if (!shouldNotify(type)) return;

  const item: NotificationItem = {
    id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type,
    title,
    body,
    timestamp: new Date().toISOString(),
    read: false,
    imageUrl: options?.imageUrl,
    data: options?.data,
  };

  addToHistory(item);
  toastCallback?.(item);

  const previewBody = settings.showPreview ? body : 'New notification';
  await showLocalNotification(title, previewBody, options?.imageUrl);

  if (!options?.skipRemote && options?.vaultId && options?.senderId) {
    sendRemoteNotification(
      options.vaultId,
      options.senderId,
      title,
      body,
      { type, ...options.data },
      options.partnerPhoto,
    );
  }
}

export async function requestNotificationPermission() {
  await ensureNotificationChannel();
  if (Capacitor.isNativePlatform()) {
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== 'granted') {
      const req = await LocalNotifications.requestPermissions();
      return req.display === 'granted';
    }
    return true;
  }
  if ('Notification' in window) {
    const perm = await Notification.requestPermission();
    return perm === 'granted';
  }
  return false;
}
