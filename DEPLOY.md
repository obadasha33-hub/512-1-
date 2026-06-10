# Deploy Our Sanctuary — Full Guide

## What You're Deploying

- **Web App** — Next.js couple's chat app with API routes, Socket.IO real-time
- **Android APK** — Capacitor wrapper that loads from local files, connects to your server

## PART 1: Deploy the Server to Render (Free)

### Step 1: Create a GitHub Account
1. Go to https://github.com and sign up (free)

### Step 2: Install Git
1. Download from https://git-scm.com/download/win
2. Install with default settings

### Step 3: Upload Your Code to GitHub
Open PowerShell and run these commands one by one:

```powershell
cd C:\Users\LENOVO\Documents\CPY_SAVES\CPY

# Tell Git who you are (replace with your info)
git config user.email "your@email.com"
git config user.name "Your Name"

# Initialize git (first time only)
git init
git add .
git commit -m "Initial commit"

# Create a GitHub repo and push
# First, go to https://github.com/new
# Name it: our-sanctuary
# Do NOT add README or .gitignore
# Click "Create repository"

# Then run (replace YOUR_USERNAME):
git remote add origin https://github.com/YOUR_USERNAME/our-sanctuary.git
git branch -M main
git push -u origin main
```

### Step 4: Deploy to Render
1. Go to https://dashboard.render.com
2. Click "Sign Up" and sign in with your GitHub account
3. Click "New +" → "Blueprint" (this reads the `render.yaml` file)
4. Select your `our-sanctuary` repository
5. Click "Apply" — Render will automatically:
   - Build the Docker image
   - Create a PostgreSQL database
   - Set the environment variables
   - Deploy your app
6. Wait for the build to complete (3-5 minutes)

### Step 5: Get Your Server URL
1. In Render dashboard, go to your Web Service
2. You'll see a URL like: `https://our-sanctuary.onrender.com`
3. **Copy this URL** — you'll need it for the APK

### Step 6: Set Environment Variables (if needed)
In Render dashboard, go to your Web Service → Environment tab.
These are already set by `render.yaml`, but you can override:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Set automatically by Render PostgreSQL |
| `NEXT_PUBLIC_SANCTUARY_SERVER_URL` | Your Render URL (e.g., `https://our-sanctuary.onrender.com`) |
| `NODE_ENV` | `production` |

---

## PART 2: Build the Android APK

### Step 1: Prerequisites
- Android Studio installed
- ADB installed (comes with Android Studio)

### Step 2: Set Your Server URL in the Config
Edit `src/lib/api.ts` and change the `DEFAULT_SERVER_URL` to your Render URL:
```ts
export const DEFAULT_SERVER_URL = 'https://our-sanctuary.onrender.com'.replace(/\/$/, '');
```

### Step 3: Build the APK
```powershell
cd C:\Users\LENOVO\Documents\CPY_SAVES\CPY

# Build the APK
npm run build:apk
```

Or manually:
```powershell
# Move API routes aside
Move-Item src\app\api src\_api_backup

# Build static export
npx next build

# Restore API routes
Move-Item src\_api_backup src\app\api

# Sync and build APK
npx cap sync android
cd android
.\gradlew.bat assembleDebug
```

### Step 4: Install the APK on Your Phone
```powershell
adb install android\app\build\outputs\apk\debug\app-debug.apk
```

---

## PART 3: Connect the APK to Your Server

1. Open the app on your phone
2. Go to **Settings** tab
3. Scroll to **"Server URL (for app sync)"**
4. Enter your Render URL: `https://your-app.onrender.com`
5. Tap **Save**

That's it! The app will now:
- Load instantly from local files
- Connect to your server for real-time chat
- Sync messages, moods, signals, memories

---

## Troubleshooting

### "App won't load / blank screen"
- Make sure you entered the correct Server URL in Settings
- Make sure the Render server is running (check dashboard)

### "API calls fail / 500 errors"
- Run `npm run dev` locally and test first
- Check Render logs: Dashboard → Web Service → Logs
- Common issue: `DATABASE_URL` not set (Render sets it automatically)

### "Socket.IO won't connect"
- Render supports WebSockets by default — no special config needed
- The app connects to the same URL for both HTTP and Socket.IO

### "Build fails"
- Make sure Prisma is generated: `npx prisma generate`
- Make sure all dependencies are installed: `npm install`

### "Database errors"
- On first deploy, Render creates the database automatically
- Tables are created automatically by `start.sh` on startup
