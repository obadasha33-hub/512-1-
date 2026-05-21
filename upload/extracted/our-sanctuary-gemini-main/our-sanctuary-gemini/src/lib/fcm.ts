import { initializeApp } from 'firebase/app'
import { getMessaging, getToken, onMessage } from 'firebase/messaging'
import { supabase } from './supabase'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

let messaging: ReturnType<typeof getMessaging> | null = null

export async function initFCM() {
  try {
    const app = initializeApp(firebaseConfig)
    messaging = getMessaging(app)
    return true
  } catch (e) {
    console.error('FCM init failed:', e)
    return false
  }
}

export async function requestFCMPermission(): Promise<string | null> {
  if (!messaging) {
    console.log('[FCM] Messaging not initialized')
    return null
  }

  try {
    console.log('[FCM] Requesting notification permission...')
    const permission = await Notification.requestPermission()
    console.log('[FCM] Permission:', permission)
    if (permission !== 'granted') return null

    console.log('[FCM] Getting token...')
    const token = await getToken(messaging, {
      vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
    })
    console.log('[FCM] Token received:', token ? token.substring(0, 20) + '...' : 'null')
    return token
  } catch (e) {
    console.error('[FCM] Token request failed:', e)
    return null
  }
}

export async function registerDeviceToken(vaultId: string, userId: string, fcmToken: string) {
  try {
    const platform = 'web'
    const { error } = await supabase
      .from('device_tokens')
      .upsert(
        { vault_id: vaultId, user_id: userId, fcm_token: fcmToken, platform },
        { onConflict: 'vault_id,user_id,fcm_token' }
      )
    if (error) console.error('Token registration failed:', error)
  } catch (e) {
    console.error('Token registration error:', e)
  }
}

export function onForegroundMessage(callback: (payload: any) => void) {
  if (!messaging) return () => {}
  return onMessage(messaging, callback)
}
