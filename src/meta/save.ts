// Save/load with integrity checks, a rolling backup and recovery.
// Storage is abstracted behind a tiny key-value interface so the same code runs
// on localStorage in the browser, on Capacitor Preferences in a native build,
// and on an in-memory map in tests.

import { sanitizeProfile, newProfile, PROFILE_VERSION, type Profile } from './progression.js';

export interface KV { get(key: string): string | null; set(key: string, value: string): void; remove(key: string): void }

export const SAVE_KEY = 'branchlike.save';
const BACKUP_KEY = SAVE_KEY + '.bak';
const CORRUPT_KEY = SAVE_KEY + '.corrupt';

interface SaveEnvelope { format: 'branchlike-save'; version: number; savedAt: number; checksum: string; profile: Profile }

/** FNV-1a hash, used to detect truncated or corrupted saves (not as anti-tamper). */
export function checksum(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export function serialize(p: Profile, now = Date.now()): string {
  const body = JSON.stringify(p);
  const env: SaveEnvelope = { format: 'branchlike-save', version: PROFILE_VERSION, savedAt: now, checksum: checksum(body), profile: p };
  return JSON.stringify(env);
}

/** Parse a save. Returns null when the data is missing, malformed or fails its checksum. */
export function deserialize(text: string | null): Profile | null {
  if (!text) return null;
  try {
    const env = JSON.parse(text) as SaveEnvelope;
    if (env?.format !== 'branchlike-save' || typeof env.profile !== 'object') return null;
    if (checksum(JSON.stringify(env.profile)) !== env.checksum) return null;
    return sanitizeProfile(migrate(env.profile, env.version));
  } catch { return null; }
}

/** Upgrade older save formats. Version 1 is current; future versions add steps here. */
function migrate(profile: Profile, fromVersion: number): Profile {
  let p = profile;
  if (fromVersion < 1) p = { ...p, version: 1 };
  return p;
}

export type LoadStatus = 'new' | 'loaded' | 'recovered';

export function loadProfile(kv: KV): { profile: Profile; status: LoadStatus } {
  const main = kv.get(SAVE_KEY);
  const p = deserialize(main);
  if (p) return { profile: p, status: 'loaded' };
  if (main) kv.set(CORRUPT_KEY, main); // keep the damaged save for support
  const bak = deserialize(kv.get(BACKUP_KEY));
  if (bak) { kv.set(SAVE_KEY, serialize(bak)); return { profile: bak, status: 'recovered' }; }
  return { profile: newProfile(), status: 'new' };
}

export function saveProfile(kv: KV, p: Profile): void {
  const prev = kv.get(SAVE_KEY);
  if (prev && deserialize(prev)) kv.set(BACKUP_KEY, prev);
  kv.set(SAVE_KEY, serialize(p));
}

export function resetProfile(kv: KV): Profile {
  kv.remove(SAVE_KEY); kv.remove(BACKUP_KEY);
  const p = newProfile();
  saveProfile(kv, p);
  return p;
}

export function memoryKV(seed: Record<string, string> = {}): KV & { data: Record<string, string> } {
  const data = { ...seed };
  return { data, get: k => (k in data ? data[k] : null), set: (k, v) => { data[k] = v; }, remove: k => { delete data[k]; } };
}

/** Browser storage with a silent in-memory fallback (private mode, blocked storage). */
export function browserKV(): KV & { persistent: boolean } {
  const mem = memoryKV();
  try {
    const ls = globalThis.localStorage;
    const probe = '__branchlike_probe__';
    ls.setItem(probe, '1'); ls.removeItem(probe);
    return {
      persistent: true,
      get: k => { try { return ls.getItem(k); } catch { return mem.get(k); } },
      set: (k, v) => { try { ls.setItem(k, v); } catch { mem.set(k, v); } },
      remove: k => { try { ls.removeItem(k); } catch { mem.remove(k); } },
    };
  } catch {
    return { ...mem, persistent: false };
  }
}
