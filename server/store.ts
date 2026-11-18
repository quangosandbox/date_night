// Environment-agnostic store.
//  - Node server: one in-memory DB persisted to data/db.json.
//  - On-device build: one in-memory DB persisted to localStorage.
//  - Vercel (serverless): each request gets its own DB loaded from Postgres (see server/vercel.ts),
//    selected through a scope resolver so concurrent requests never share state.
import type { Booking, Couple, Rating } from '../shared/types.ts';
import type { StoredUser } from './auth.ts';
import type { Session } from './engine.ts';

export type StoredRating = Omit<Rating, 'score'>; // score is derived from the ranked list

export interface StoredCouple extends Couple {
  activeSessionId: string | null;
  history: Booking[];
  /** confirmation → userId → rating */
  ratings?: Record<string, Record<string, StoredRating>>;
}

export interface DB {
  users: Record<string, StoredUser>;
  couples: Record<string, StoredCouple>;
  sessions: Record<string, Session>;
}

const globalDb: DB = { users: {}, couples: {}, sessions: {} };
let scoped: (() => DB | undefined) | null = null;

/** Per-request DB (serverless). Falls back to the process-wide DB everywhere else. */
export function setScopeResolver(fn: () => DB | undefined) {
  scoped = fn;
}

const current = (): DB => scoped?.() ?? globalDb;

export const db: DB = new Proxy({} as DB, {
  get: (_t, key: keyof DB) => current()[key],
  set: (_t, key: keyof DB, value) => {
    current()[key] = value;
    return true;
  },
});

let saver: (db: DB) => void = () => {};
let pending = false;

export function configureStore(initial: Partial<DB> | null, persist: (db: DB) => void) {
  if (initial) Object.assign(globalDb, { users: {}, couples: {}, sessions: {}, ...initial });
  saver = persist;
}

export function save() {
  if (scoped?.()) return; // request-scoped: persisted when the request finishes
  if (pending) return;
  pending = true;
  setTimeout(() => {
    pending = false;
    saver(globalDb);
  }, 150);
}
