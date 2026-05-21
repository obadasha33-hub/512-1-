import { supabase } from './supabase'

export async function sendRemoteNotification(vaultId: string, senderId: string, title: string, body: string, data?: any, imageUrl?: string) {
  console.log('[RemoteNotify] Sending:', { vaultId, senderId, title, body, imageUrl })
  try {
    const { data: res, error } = await supabase.functions.invoke('push-notification', {
      body: { vaultId, senderId, title, body, data, imageUrl },
    })
    if (error) {
      console.error('[RemoteNotify] Edge Function error:', error)
      return false
    }
    console.log('[RemoteNotify] Edge Function response:', res)
    return true
  } catch (e) {
    console.error('[RemoteNotify] Failed:', e)
    return false
  }
}
