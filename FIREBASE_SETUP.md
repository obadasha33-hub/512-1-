# Firebase Integration Guide

## Architecture Decision: Hybrid Approach

This app uses a hybrid Firebase + Custom backend approach:
- **Custom backend (server.js)**: Socket.IO real-time, Game engine, Custom auth
- **Firebase Admin**: Push notifications, Storage (optional)
- **Firebase Client**: Storage, Real-time vault sync (optional)

## Setup Steps

### 1. Create Firebase Project
```bash
# Go to Firebase Console > Project Settings
# Copy the config values to .env.local
```

### 2. Environment Variables
Copy `.env.example` to `.env.local` and fill in:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123...
NEXT_PUBLIC_FCM_VAPID_KEY=your-vapid-key

# Admin SDK (Service Account JSON)
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
```

### 3. Enable Firebase Services

**Cloud Messaging:**
- Go to Project Settings > Cloud Messaging
- Copy Web Push certificate key (VAPID key) to `NEXT_PUBLIC_FCM_VAPID_KEY`

**Firebase Storage:**
- Go to Storage > Rules
```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /vaults/{vaultId}/{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### 4. Deploy Push Notification Updates

Replace in `server.js` line 9:
```javascript
const { sendPushToPartner } = require('./src/lib/firebase/push');
```

Replace `lib/fcm.js` usage with:
```javascript
// Old: sendFCMPushToPartner(prisma, vaultId, partnerIdentity, { title, body, data })
// New: 
sendPushToPartner(prisma, vaultId, partnerIdentity, { title, body, data })
```

### 5. Optional: Enable Firebase Storage

In `src/app/api/upload/route.ts`, add Firebase Storage fallback:
```typescript
import { uploadMediaFile } from '@/lib/firebase/storage';
// After line 111 in upload/route.ts:
// let url = await uploadToCloudinary(...);
// if (!url) url = await uploadMediaFile(auth.vault.id, blob, ...);
```

### 6. Add Real-time Vault Sync (Optional Enhancement)

In your app component:
```typescript
import { useVaultSync } from '@/hooks/use-firebase-vault';

function App() {
  const vaultId = useAppStore(s => s.vaultId);
  const setVaultData = useAppStore(s => s.setVaultData);
  
  useVaultSync({
    vaultId,
    onData: (data) => setVaultData(data),
  });
}
```

## Key Files Created

- `src/lib/firebase/client.ts` - Client SDK initialization
- `src/lib/firebase/admin.ts` - Admin SDK with FCM, DB, Auth
- `src/lib/firebase/push.ts` - Push notification helpers
- `src/lib/firebase/storage.ts` - File upload helpers
- `src/hooks/use-firebase-vault.ts` - Real-time vault sync hook
- `.env.example` - Environment variable template

## Migration Path (Future)

To fully migrate to Firebase:
1. Add Firebase Auth web SDK
2. Replace Socket.IO with Firestore real-time listeners
3. Move all data to Firestore collections
4. Use Firebase Storage for all uploads
5. Remove Prisma and server.js

## Security Notes

- Service account JSON contains sensitive keys - never commit to repo
- FCM tokens should be refreshed on each app launch
- Vault data is protected by custom session tokens; add Firebase ID token verification as additional security layer