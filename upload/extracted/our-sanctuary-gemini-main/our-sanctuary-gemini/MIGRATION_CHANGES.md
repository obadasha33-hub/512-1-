# Firebase to Supabase Migration Changes

## Overview
Migrated the project from Firebase to Supabase in the `our-sanctuary-gemini` folder.

## Files Added

### New Supabase Integration
- `src/lib/supabase.ts` - Supabase client configuration
- `src/lib/supabaseFirestoreCompat.ts` - Supabase realtime compatibility layer
- `src/lib/media.ts` - Replaced Firebase Storage with Supabase photos bucket upload
- `supabase-setup.sql` - Database schema setup for Supabase
- `storage.rules` - Supabase storage rules

## Files Modified

### package.json
- Removed Firebase packages
- Removed Firebase Admin packages
- Added Supabase client dependencies

### Configuration Changes
- Disabled old Firebase FCM remote push code
- Updated environment configuration for Supabase

## Database Schema Changes

### New Tables Created (via supabase-setup.sql)
- `couple_state` - App-wide synced state (theme, names, profile photos, wallpaper, AI memory, chat state, etc.)
- `game_sessions` - Game session data

### Realtime Setup
- Enabled replica identity full for both tables
- Added tables to supabase_realtime publication
- Configured Row Level Security policies

## Security Changes

### Key Rotation Required
- Supabase secret key (service_role) was exposed and needs rotation
- App uses only publishable anon key for client-side operations
- Secret key should be rotated in Supabase dashboard

## Verification Completed

### Build & Lint
- ✅ `npm run lint` passed
- ✅ `npm run build` passed
- ✅ `npx cap sync android` passed
- ✅ Debug APK build passed

### New Build Artifact
- `app-debug.apk` generated successfully

## Remaining Tasks

### High Priority
- [ ] Run `supabase-setup.sql` in Supabase SQL Editor to create database tables
- [ ] Rotate Supabase secret key in Supabase dashboard

### Medium Priority
- [ ] Set up hosted backend or Supabase Edge Function for true remote push notifications
  - Local notifications and realtime sync remain functional
  - FCM remote push requires backend infrastructure

## Functionality Status

### Working
- ✅ Local notifications
- ✅ Realtime sync via Supabase
- ✅ Photo uploads to Supabase storage
- ✅ App state synchronization

### Needs Backend Setup
- ⏳ True remote push notifications (FCM)

## Migration Date
May 19, 2026
