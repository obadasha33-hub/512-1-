/**
 * Firebase Cloud Messaging helper for server-side push notifications
 * Replaces lib/fcm.js with Firebase Admin SDK
 */
import { getAdminMessaging } from './admin';

interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
}

/**
 * Send push notification to a specific FCM token
 */
export async function sendPush(token: string | null | undefined, payload: PushPayload): Promise<boolean> {
  if (!token) return false;
  const messaging = getAdminMessaging();
  if (!messaging) {
    console.error('[Push] Firebase Admin Messaging not initialized');
    return false;
  }

  try {
    await messaging.send({
      token,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: payload.data,
      android: {
        priority: 'high',
        notification: {
          channelId: 'sanctuary-messages',
          icon: 'ic_stat_icon_configurable',
          color: '#FF4D94',
        },
      },
    });
    return true;
  } catch (error: any) {
    console.error('[Push] Failed to send:', error?.message || error);
    if (error?.code === 'messaging/token-unregistered' || error?.code === 'messaging/registration-token-not-registered') {
      // Token is invalid - caller should remove it
      return false;
    }
    return false;
  }
}

/**
 * Send push notification to partner in a vault
 */
export async function sendPushToPartner(prisma: any, vaultId: string, partnerIdentity: 'Batman' | 'Princess', payload: PushPayload): Promise<boolean> {
  const partnerRole = partnerIdentity === 'Batman' ? 'partner1' : 'partner2';
  try {
    const member = await prisma.vaultMember.findFirst({
      where: { vaultId, role: partnerRole },
      select: { pushToken: true },
    });
    if (!member?.pushToken) return false;
    return sendPush(member.pushToken, payload);
  } catch (error: any) {
    console.error('[Push] Failed to send to partner:', error?.message || error);
    return false;
  }
}