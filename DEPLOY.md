# Deploy Our Sanctuary — Full Guide

## What You're Deploying

- **Web App** — Next.js couple's chat app with API routes, Socket.IO real-time
- **Android APK** — Capacitor wrapper that loads from local files, connects to your server

## PART 1: Deploy the Server to Railway (Free)

### Step 1: Create a GitHub Account
1. Go to https://github.com and sign up (free)

### Step 2: Install Git
1. Download from https://git-scm.com/download/win
2. Install with default settings

### Step 3: Upload Your Code to GitHub
Open PowerShell and run these commands one by one:

```powershell
cd C:\Users\LENOVO\Documents\CPY_SAVES\CPY

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

### Step 4: Deploy to Railway
1. Go to https://railway.app
2. Click "Start a New Project" → "Deploy from GitHub repo"
3. Sign in with your GitHub account
4. Select your `our-sanctuary` repository
5. Railway will auto-detect the Dockerfile and start building
6. Wait for the build to complete (2-5 minutes)

### Step 5: Set Environment Variables
In Railway dashboard, go to your project → Variables tab, add:

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | `file:./prod.db` |
| `NEXTAUTH_SECRET` | `your-random-secret-here` |
| `CORS_ORIGINS` | `http://localhost:3000,http://localhost:81,https://your-app.up.railway.app` |
| `NODE_ENV` | `production` |

### Step 6: Get Your Server URL
1. In Railway, go to Settings → Networking
2. Click "Generate Domain"
3. You'll get a URL like: `https://our-sanctuary.up.railway.app`
4. **Copy this URL** — you'll need it for the APK

### Step 7: Set Up the Database
In Railway, go to your project → Variables tab, add:

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | `file:./prod.db` |

The SQLite database will be created automatically on first run.

---

## PART 2: Build the Android APK

### Step 1: Prerequisites
- Android Studio installed (you have this)
- ADB installed (comes with Android Studio)

### Step 2: Build the APK
Open PowerShell and run:

```powershell
cd C:\Users\LENOVO\Documents\CPY_SAVES\CPY

# Build the static client for APK
scripts\build-capacitor.ps1
```

Or manually:
```powershell
# 1. Move API routes aside
Move-Item src\app\api src\_api_backup

# 2. Temporarily change config
# Edit next.config.ts: output: "export"

# 3. Remove manifest.ts
Move-Item src\app\manifest.ts src\_manifest_backup

# 4. Build
npx next build

# 5. Restore everything
Move-Item src\_api_backup src\app\api
Move-Item src\_manifest_backup src\app\manifest.ts
# Restore next.config.ts: output: "standalone"

# 6. Sync and build APK
npx cap sync android
cd android
set JAVA_HOME=C:\Program Files\Android\Android Studio\jbr
.\gradlew.bat assembleDebug
```

### Step 3: Install the APK
```powershell
adb install android\app\build\outputs\apk\debug\app-debug.apk
```

---

## PART 3: Connect the APK to Your Server

1. Open the app on your phone
2. Go to **Settings** tab
3. Scroll to **"Server URL (for app sync)"**
4. Enter your Railway URL: `https://your-app.up.railway.app`
5. Tap **Save**

That's it! The app will now:
- Load instantly from local files (no blank screen)
- Connect to your server for real-time chat
- Sync messages, moods, signals, memories via API
- Work offline for cached data

---

## Troubleshooting

### "Blank screen on APK"
- Make sure you entered the correct Server URL in Settings
- Make sure the Railway server is running

### "API calls fail"
- Check the Server URL doesn't have a trailing slash
- Make sure `DATABASE_URL` is set in Railway

### "Socket.IO won't connect"
- The app connects to the same URL for both HTTP and Socket.IO
- Make sure Railway's domain allows WebSocket connections

### "Build fails"
- Make sure Prisma is generated: `npx prisma generate`
- Make sure all dependencies are installed: `npm install`
