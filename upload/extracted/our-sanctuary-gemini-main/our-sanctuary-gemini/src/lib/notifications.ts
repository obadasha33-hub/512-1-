import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

export async function showSystemNotification(title: string, body: string, icon?: string) {
  try {
    if (Capacitor.isNativePlatform()) {
      await Haptics.vibrate({ duration: 500 });
      
      const perm = await LocalNotifications.checkPermissions();
      if (perm.display !== 'granted') {
        const req = await LocalNotifications.requestPermissions();
        if (req.display !== 'granted') return;
      }
      
      await LocalNotifications.schedule({
        notifications: [
          {
            title,
            body,
            id: new Date().getTime(),
            schedule: { at: new Date(Date.now() + 100) },
            ...(icon ? { largeBody: icon } : {})
          }
        ]
      });
    } else {
      if ("Notification" in window && Notification.permission === "granted" && document.hidden) {
        new Notification(title, { body, icon: icon || '/icon-512x512.svg' });
      }
    }
  } catch (error) {
    console.error("Failed to show notification:", error);
  }
}
