// FCM push notification helper — CommonJS for server.js
const SERVER_KEY = typeof process !== 'undefined' ? process.env.FCM_SERVER_KEY : null;

async function sendFCMPush(token, { title, body, data = {} }) {
  if (!SERVER_KEY || !token) return false;
  try {
    const res = await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `key=${SERVER_KEY}`,
      },
      body: JSON.stringify({
        to: token,
        notification: { title, body, sound: 'default' },
        data,
        priority: 'high',
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error('[FCM] send failed:', text);
    }
    return res.ok;
  } catch (err) {
    console.error('[FCM] send error:', err);
    return false;
  }
}

async function sendFCMPushToPartner(prisma, vaultId, partnerIdentity, { title, body, data = {} }) {
  try {
    const partnerRole = partnerIdentity === 'Batman' ? 'partner1' : 'partner2';
    const member = await prisma.vaultMember.findFirst({
      where: { vaultId, role: partnerRole, pushToken: { not: null } },
      select: { pushToken: true },
    });
    if (!member?.pushToken) return false;
    return sendFCMPush(member.pushToken, { title, body, data });
  } catch (err) {
    console.error('[FCM] send to partner error:', err);
    return false;
  }
}

module.exports = { sendFCMPush, sendFCMPushToPartner };
