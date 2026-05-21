import { supabase } from './supabase';

export const db = {};

type CompatRef = {
  collectionName: string;
  id: string;
  table: string;
  keyColumn: string;
};

type Snapshot = {
  exists: () => boolean;
  data: () => any;
};

type ArrayUnionValue = {
  __op: 'arrayUnion';
  values: any[];
};

function tableForCollection(collectionName: string) {
  if (collectionName === 'couples') return { table: 'couple_state', keyColumn: 'vault_id' };
  if (collectionName === 'sessions') return { table: 'game_sessions', keyColumn: 'session_id' };
  return { table: collectionName, keyColumn: 'id' };
}

function makeSnapshot(data: any | null): Snapshot {
  return {
    exists: () => !!data,
    data: () => data?.data || data || {},
  };
}

function deepMerge(base: Record<string, any>, updates: Record<string, any>): Record<string, any> {
  const next = { ...base };
  for (const [key, value] of Object.entries(updates)) {
    if (value && typeof value === 'object' && !Array.isArray(value) && value.__op !== 'arrayUnion') {
      const current = next[key] && typeof next[key] === 'object' && !Array.isArray(next[key]) ? next[key] : {};
      next[key] = deepMerge(current, value);
    } else if (value && typeof value === 'object' && value.__op === 'arrayUnion') {
      const current = Array.isArray(next[key]) ? next[key] : [];
      next[key] = [...current, ...(value as ArrayUnionValue).values];
    } else {
      next[key] = value;
    }
  }
  return next;
}

function shallowEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return a === b;
  if (typeof a !== 'object') return a === b;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (!(key in b) || a[key] !== b[key]) return false;
  }
  return true;
}

export function doc(_db: unknown, collectionName: string, id: string): CompatRef {
  const mapped = tableForCollection(collectionName);
  return { collectionName, id, ...mapped };
}

export async function getDoc(ref: CompatRef) {
  const { data, error } = await supabase
    .from(ref.table)
    .select('*')
    .eq(ref.keyColumn, ref.id)
    .maybeSingle();

  if (error) throw error;
  return makeSnapshot(data);
}

export async function setDoc(ref: CompatRef, updates: Record<string, any>, options?: { merge?: boolean }) {
  const currentSnap = options?.merge ? await getDoc(ref) : null;
  const currentData = currentSnap?.exists() ? currentSnap.data() : {};
  const nextData = options?.merge ? deepMerge(currentData, updates) : updates;

  const row = {
    [ref.keyColumn]: ref.id,
    data: nextData,
    updated_at: Date.now(),
  };

  const { error } = await supabase
    .from(ref.table)
    .upsert(row, { onConflict: ref.keyColumn });

  if (error) throw error;
}

export async function updateDoc(ref: CompatRef, updates: Record<string, any>) {
  return setDoc(ref, updates, { merge: true });
}

export function onSnapshot(ref: CompatRef, onNext: (snapshot: Snapshot) => void, onError?: (error: any) => void) {
  let active = true;
  let initialDataHash: string | null = null;

  getDoc(ref)
    .then(snapshot => {
      if (!active) return;
      if (snapshot.exists()) {
        const data = snapshot.data();
        initialDataHash = JSON.stringify(data);
      }
      onNext(snapshot);
    })
    .catch(error => {
      if (active) onError?.(error);
    });

  const channel = supabase
    .channel(`${ref.table}:${ref.id}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: ref.table,
        filter: `${ref.keyColumn}=eq.${ref.id}`,
      },
      payload => {
        if (!active) return;
        const newData = payload.new || null;
        const newHash = JSON.stringify(newData);
        if (initialDataHash !== null && newHash === initialDataHash) {
          initialDataHash = null;
          return;
        }
        initialDataHash = null;
        onNext(makeSnapshot(newData));
      },
    )
    .subscribe(status => {
      if (status === 'CHANNEL_ERROR') {
        onError?.(new Error(`Realtime channel failed for ${ref.table}:${ref.id}`));
      }
    });

  return () => {
    active = false;
    supabase.removeChannel(channel);
  };
}

export function arrayUnion(...values: any[]): ArrayUnionValue {
  return { __op: 'arrayUnion', values };
}

export function serverTimestamp() {
  return new Date().toISOString();
}

export async function enableIndexedDbPersistence() {
  return undefined;
}

export function initializeFirestore() {
  return {};
}

export function persistentLocalCache() {
  return {};
}

export function persistentMultipleTabManager() {
  return {};
}
