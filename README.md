# Our Sanctuary 💕

A private, intimate space for couples to connect, share memories, and stay close.

## Features

- **Private Chat** - End-to-end encrypted messaging
- **Memories** - Capture and time-lock special moments
- **Love Signals** - Send misses, hugs, and kisses
- **Mood Tracking** - Share daily feelings
- **Relationship Stats** - Days together counter
- **AI Companion** - Relationship advice and conversation
- **Real-time Sync** - Live presence and typing indicators
- **Push Notifications** - Firebase-powered alerts
- **Offline Support** - Works without internet

## Tech Stack

- Next.js 16 + TypeScript + Tailwind CSS
- Prisma (SQLite) + Socket.IO
- Firebase (FCM + optional Firestore)
- Capacitor (mobile app)

## Setup

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env.local
# Fill in Firebase and database values

# Initialize database
npx prisma db push

# Run development
npm run dev
```

## Environment Variables

```env
# Firebase (required for push notifications)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FCM_VAPID_KEY=
FIREBASE_SERVICE_ACCOUNT_JSON=
```

## Mobile App

```bash
# Build APK
npm run build:apk
```

## License

MIT - Private use for couples