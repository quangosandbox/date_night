// Environment-agnostic store. The Node server persists it to data/db.json; the on-device
// build persists it to localStorage. Swap for Postgres/Redis in production.
import type { Booking, Couple, Rating, User } from '../shared/types.ts';
import type { Session } from './engine.ts';

export type StoredRating = Omit<Rating, 'score'>; // score is derived from the ranked list

export interface StoredCouple extends Couple {
  activeSessionId: string | null;
  history: Booking[];
  /** confirmation → userId → rating */
  ratings?: Record<string, Record<string, StoredRating>>;
}

export interface DB {
  users: Record<string, User>;
  couples: Record<string, StoredCouple>;
  sessions: Record<string, Session>;
}

export const db: DB = { users: {}, couples: {}, sessions: {} };

let saver: (db: DB) => void = () => {};
let pending = false;

export function configureStore(initial: Partial<DB> | null, persist: (db: DB) => void) {
  if (initial) Object.assign(db, { users: {}, couples: {}, sessions: {}, ...initial });
  saver = persist;
}

export function save() {
  if (pending) return;
  pending = true;
  setTimeout(() => {
    pending = false;
    saver(db);
  }, 150);
}
