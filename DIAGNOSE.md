# 🔍 Sanctuary App - Hang Diagnosis & Fixes

## **Root Causes Identified**

### **1. CRITICAL: Zustand Hydration Not Completing**
**Location:** `src/lib/sanctuary-store.ts`
**Issue:** The `useAppStore.persist.hasHydrated()` might return false even after localStorage loads
**Why it causes hanging:** 
- App shows loading spinner while waiting for `_hasHydrated = true`
- Timeout fallback after 3s should fix this, but there might be timing issues
- **FIX:** Ensure persist is initialized BEFORE selectors try to use store

**Required Change:**
```ts
// Remove this check that might fail:
const api = useAppStore.persist;
if (api.hasHydrated()) { ... }

// Replace with guaranteed hydration marker
useEffect(() => {
  const unsub = useAppStore.subscribe(
    (state) => state._hasHydrated,
    (hasHydrated) => {
      if (hasHydrated) {
        // Mark as fully ready
        document.body.classList.add('hydrated');
      }
    }
  );
  return unsub;
}, []);
```

### **2. CRITICAL: SetupScreen Might Never Render Due to Logic Error**
**Location:** `src/app/page.tsx` line 6568
**Issue:** Rendering logic has wrong order
```tsx
// WRONG - checks loading AFTER checking conditions that might fail:
if (!hasHydrated) return <LoadingScreen/>;
if (!setupComplete || !hasAuth) return <SetupScreen/>;
```

**Problem:** If `hasHydrated` is stuck false, SetupScreen never renders

**FIX:** Reorder to show setup immediately if needed:
```tsx
// CORRECT ORDER:
if (!hasHydrated && !setupComplete && !hasAuth) {
  return <LoadingScreen/>;
}
if (!setupComplete || !hasAuth) {
  return <SetupScreen/>;
}
// Only show loading if we ARE authenticated but still hydrating
if (!hasHydrated) {
  return <LoadingScreen/>;
}
```

### **3. BUG: Store Selectors Called Before Hydration**
**Location:** `src/app/page.tsx` line 6416-6422
**Issue:** Component reads from store in JSX before checking hydration
```tsx
export default function SanctuaryApp() {
  const setupComplete = useAppStore((s) => s.setupComplete); // ← Called immediately
  const currentTab = useAppStore((s) => s.currentTab);       // ← Called immediately
  // ...
  const hasHydrated = useAppStore((s) => s._hasHydrated);    // ← Last one checked
```

**Why it fails:** If store isn't hydrated yet, these might return undefined/incorrect values

**FIX:** Check hydration first:
```tsx
const hasHydrated = useAppStore((s) => s._hasHydrated);

// Return early if not hydrated
if (!hasHydrated) {
  return <LoadingScreen/>;
}

// NOW safe to read other values
const setupComplete = useAppStore((s) => s.setupComplete);
const currentTab = useAppStore((s) => s.currentTab);
```

### **4. BUG: useEffect Dependency Chain Broken**
**Location:** `src/app/page.tsx` line 6429
**Issue:** 
```tsx
useEffect(() => {
  if (typeof window === 'undefined') return;
  const stored = getStoredAuth();
  setHasAuth(!!stored);
}, [setupComplete]); // ← Depends on setupComplete, not hasHydrated!
```

**Problem:** If `setupComplete` changes before hydration completes, timing breaks

**FIX:** 
```tsx
useEffect(() => {
  if (typeof window === 'undefined') return;
  if (!hasHydrated) return; // Wait for hydration first
  const stored = getStoredAuth();
  setHasAuth(!!stored);
}, [hasHydrated]); // ← Depend on hydration, not setupComplete
```

### **5. BUG: Missing Fallback for Lost Hydration State**
**Location:** `src/app/page.tsx` line 6516-6524
**Issue:** Timeout sets `_hasHydrated` but component might not re-render properly
```tsx
setTimeout(() => {
  if (!useAppStore.getState()._hasHydrated) {
    console.warn('[App] Hydration timeout — forcing _hasHydrated = true');
    useAppStore.setState({ _hasHydrated: true });
  }
}, 3000);
```

**Problem:** After setting state, component might not re-render because selector hasn't updated

**FIX:** Force a component re-render:
```tsx
setTimeout(() => {
  if (!useAppStore.getState()._hasHydrated) {
    console.warn('[App] Hydration timeout — forcing _hasHydrated = true');
    useAppStore.setState({ _hasHydrated: true });
    // Force browser paint
    window.dispatchEvent(new Event('hydration-timeout'));
  }
}, 3000);
```

### **6. BUG: API Routes Still Expecting Firebase (ALREADY PARTIALLY FIXED)**
**Files affected:**
- ✅ `src/lib/api-auth.ts` - FIXED ✓
- ✅ `lib/socket-auth.js` - FIXED ✓
- ❌ `src/app/api/vault/route.ts` - Still has Firebase fallback?

**Check:** Verify vault route uses Prisma correctly

### **7. CRITICAL BUG: Missing Error Boundary**
**Location:** `src/app/page.tsx`
**Issue:** If SetupScreen or any component throws an error, entire app crashes silently
**FIX:** Wrap in error boundary:
```tsx
function SanctuaryApp() {
  return (
    <ErrorBoundary fallback={<div>App Error - Refresh Page</div>}>
      <SanctuaryAppInner />
    </ErrorBoundary>
  );
}

function SanctuaryAppInner() {
  // Current content here
}
```

### **8. BUG: Circular Dependencies in Imports**
**Check:** Verify no circular imports between:
- `src/app/page.tsx` → `src/lib/sanctuary-store.ts`
- `src/lib/sanctuary-store.ts` → `src/lib/api.ts`
- `src/lib/api.ts` → `src/lib/api-auth.ts`

---

## **Complete Fixes Required**

### **Fix 1: Reorder Rendering Logic** 
**File:** `src/app/page.tsx` (lines 6560-6575)

Replace:
```tsx
if (!hasHydrated) {
  return (
    <div className="fixed inset-0 flex items-center justify-center" ...>
      <div className="text-center">
        <div className="text-5xl mb-4">💕</div>
        <div className="w-8 h-8 border-3 border-white border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    </div>
  );
}

if (!setupComplete || !hasAuth) {
  return <SetupScreen onAuthenticated={() => setHasAuth(true)} />;
}
```

With:
```tsx
// If not hydrated AND not authenticated, show loading
if (!hasHydrated && !setupComplete) {
  return (
    <div className="fixed inset-0 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #FF6B9D 0%, #C44569 50%, #8E2D5B 100%)' }}>
      <div className="text-center">
        <div className="text-5xl mb-4">💕</div>
        <div className="w-8 h-8 border-3 border-white border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    </div>
  );
}

// Show setup if not authenticated (regardless of hydration)
if (!setupComplete || !hasAuth) {
  return <SetupScreen onAuthenticated={() => setHasAuth(true)} />;
}

// Show loading if hydrating but authenticated
if (!hasHydrated) {
  return (
    <div className="fixed inset-0 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #FF6B9D 0%, #C44569 50%, #8E2D5B 100%)' }}>
      <div className="text-center">
        <div className="text-5xl mb-4">💕</div>
        <div className="w-8 h-8 border-3 border-white border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    </div>
  );
}
```

### **Fix 2: Move Selector Reads After Hydration Check**
**File:** `src/app/page.tsx` (lines 6416-6425)

Move to AFTER the `hasHydrated` check in JSX, so they only run when safe

### **Fix 3: Fix useEffect Dependency**
**File:** `src/app/page.tsx` (lines 6429-6434)

Change from:
```tsx
useEffect(() => {
  if (typeof window === 'undefined') return;
  const stored = getStoredAuth();
  setHasAuth(!!stored);
}, [setupComplete]);
```

To:
```tsx
useEffect(() => {
  if (typeof window === 'undefined') return;
  if (!hasHydrated) return; // Don't run until hydrated
  const stored = getStoredAuth();
  setHasAuth(!!stored);
}, [hasHydrated]);
```

### **Fix 4: Improve Hydration Timeout**
**File:** `src/app/page.tsx` (lines 6503-6510)

Change to:
```tsx
useEffect(() => {
  if (hasHydrated) return;
  const timer = setTimeout(() => {
    if (!useAppStore.getState()._hasHydrated) {
      console.warn('[App] Hydration timeout — forcing _hasHydrated = true');
      useAppStore.setState({ _hasHydrated: true });
      // Ensure re-render by dispatching event
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('app:hydration-complete'));
      }
    }
  }, 3000);
  return () => clearTimeout(timer);
}, [hasHydrated]);
```

### **Fix 5: Add Error Handling to API Setup**
**File:** `src/app/page.tsx` - Add at top of component:

```tsx
// Catch any setup errors early
try {
  useThemeCSS();
  const socketIO = useSocketIO();
} catch (err) {
  console.error('[App] Fatal setup error:', err);
  return <div style={{color: 'red', padding: '20px'}}>Setup Error: {String(err)}</div>;
}
```

### **Fix 6: Verify Prisma Connection in Auth APIs**
**Files to verify:**
- `src/app/api/vault/route.ts` - Should use `db` not Firebase
- `src/app/api/vault/[vaultId]/messages/route.ts` - Should use `db` not Firebase
- All other vault sub-routes

---

## **Testing Checklist**

After applying fixes:

- [ ] Open app in browser - should show either:
  - Loading spinner for 0-3 seconds
  - Then SetupScreen (fresh user) or Main App (authenticated user)
  - **NOT stuck on loading forever**

- [ ] Check browser console - should see:
  ```
  ✅ No errors
  ✅ "[App] Hydration timeout" warning (or no warning if hydrated naturally)
  ✅ Socket connection attempts after auth
  ```

- [ ] Network tab should show:
  - `✅ /api/vault/... 200 OK`
  - `✅ /api/vault/[id]/messages 200 OK`
  - `✅ Socket.IO WebSocket upgrade attempt`

- [ ] Fresh user flow:
  - [ ] Click "Partner 1" or "Partner 2"
  - [ ] Enter names, start date
  - [ ] Click "Create New Vault"
  - [ ] Should complete setup and show main app

---

## **Deployment Order**

1. **Fix rendering logic** (Fix 1 & 2)
2. **Fix useEffect dependencies** (Fix 3)  
3. **Improve hydration timeout** (Fix 4)
4. **Add error handling** (Fix 5)
5. **Verify all API routes** (Fix 6)
6. **Push all changes**
7. **Redeploy to Railway**
8. **Test thoroughly**

