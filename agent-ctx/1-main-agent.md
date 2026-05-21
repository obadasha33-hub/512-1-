# Task: Fix and Complete the "Our Sanctuary" Chat Application

## Summary of Work Completed

### 1. API Helper Created (`/src/lib/api.ts`)
- Created comprehensive API helper with typed functions for all backend endpoints
- Vault CRUD: get, create, update
- Messages: list, send, update, delete
- Moods: get, update
- Signals: send, list
- Memories: list, add, update, delete
- All functions use relative paths with proper error handling

### 2. API Routes Created
- `/api/vault/route.ts` - GET (by vaultId), POST (create), PUT (update settings)
- `/api/vault/[vaultId]/messages/route.ts` - GET, POST, PUT, DELETE
- `/api/vault/[vaultId]/moods/route.ts` - GET, PUT
- `/api/vault/[vaultId]/signals/route.ts` - GET, POST
- `/api/vault/[vaultId]/memories/route.ts` - GET, POST, PUT, DELETE

### 3. Zustand Store Modified (`/src/lib/sanctuary-store.ts`)
- Added `loadFromServer()` action that:
  - Auto-creates vault if it doesn't exist (404 → create)
  - Loads messages, moods, signals, memories from server
  - Falls back to local data if server is unavailable
- Added background API sync with `tryApi()` helper (non-blocking, catches errors)
- All store actions (setTheme, setFont, setNames, addMessage, sendSignal, etc.) now sync to backend
- `starMessage` kept as local-only (no DB column for starred)

### 4. Frontend Fixes (`/src/app/page.tsx`)

#### Critical: Long-press now works on desktop
- Added `handleMouseDown`, `handleMouseUp`, `handleMouseLeave`, `handleMouseMove` handlers
- These mirror the touch handlers (`handleTouchStart`, `handleTouchMove`, `handleTouchEnd`)
- Long-press (500ms) with mouse triggers selection mode
- Mouse move cancels long-press timer (like touch move)
- `onClick` properly ignores clicks after long-press fires

#### Critical: Chat message sending fixed
- `sendMessage()` now properly validates input (must have non-empty trimmed text)
- Uses `useAppStore.getState()` inside setTimeout to avoid stale closure over messages
- Added partner typing indicator simulation (shows between 1.5s-2.5s after sending)

#### Typing indicator now conditional
- Only shows when `partnerTyping` state is true (simulated during partner reply)
- Previously was always visible at the top of messages

#### Chat menu functionality added
- "Select Messages" → enters selection mode
- "Starred Messages" → opens modal showing starred messages
- "Search in Chat" → opens search modal with real-time filtering
- "Clear Chat" → marks all messages as deleted
- "Mute Notifications" and "Wallpaper" remain as placeholder buttons

#### Other improvements
- Added `select-none` class to message divs to prevent text selection during long-press
- Added `partnerTyping` state for realistic typing indicator
- Added `showStarred`, `showSearch`, `searchQuery` state for new modals
- `loadFromServer()` called on app mount

### 5. Build Verification
- `bun run lint` passes with no errors or warnings
- `npx next build` compiles successfully
- All API routes are properly registered
- Dev server shows successful API calls (vault creation, message loading, etc.)

### 6. Uploads Directory
- Created `/home/z/my-project/public/uploads/`
