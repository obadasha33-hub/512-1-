// FCM push notification helper — supports Service Account (v1 API) and Legacy key
const raw = typeof process !== 'undefined' ? process.env.FCM_SERVER_KEY : null;

// Parse credentials — could be a JSON service account or a plain legacy key
let serviceAccount = null;
let legacyKey = null;

if (raw) {
  try {
    serviceAccount = JSON.parse(raw);
  } catch {
    legacyKey = raw;
  }
}

async function getAccessToken() {
  if (!serviceAccount) return null;
  const { client_email, private_key } = serviceAccount;
  try {
    const { sign } = require('crypto');
    const header = { alg: 'RS256', typ: 'JWT' };
    const now = Math.floor(Date.now() / 1000);
    const claim = {
      iss: client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now,
    };
    const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
    const signatureInput = `${b64(header)}.${b64(claim)}`;
    const sig = sign('sha256', Buffer.from(signatureInput), private_key);
    const jwt = `${signatureInput}.${sig.toString('base64url')}`;

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error('[FCM] Token exchange failed:', errText);
      return null;
    }
    const json = await res.json();
    return json.access_token;
  } catch (err) {
    console.error('[FCM] getAccessToken error:', err);
    return null;
  }
}

async function sendFCMPush(token, { title, body, data = {} }) {
  if (!token) return false;

  try {
    if (serviceAccount) {
      // FCM HTTP v1 API
      const accessToken = await getAccessToken();
      if (!accessToken) return false;
      const res = await fetch(`https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          message: {
            token,
            notification: { title, body },
            data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
            android: { priority: 'high' },
          },
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        console.error('[FCM v1] send failed:', text);
      }
      return res.ok;
    } else if (legacyKey) {
      // Legacy HTTP API
      const res = await fetch('https://fcm.googleapis.com/fcm/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `key=${legacyKey}`,
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
        console.error('[FCM legacy] send failed:', text);
      }
      return res.ok;
    }
    return false;
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
