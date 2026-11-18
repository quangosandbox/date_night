// Tiny in-memory store persisted to data/db.json. Swap for Postgres/Redis in production.
import fs from 'node:fs';
import path from 'node:path';
import type { Booking, Couple, User } from '../shared/types.ts';
import type { Session } from './engine.ts';

interface DB {
  users: Record<string, User>;
  couples: Record<string, Couple & { activeSessionId: string | null; history: Booking[] }>;
  sessions: Record<string, Session>;
}

const FILE = process.env.DB_FILE ?? path.resolve('data/db.json');
const PERSIST = process.env.NODE_ENV !== 'test';

function load(): DB {
  if (PERSIST) {
    try {
      return JSON.parse(fs.readFileSync(FILE, 'utf8')) as DB;
    } catch {
      /* first run */
    }
  }
  return { users: {}, couples: {}, sessions: {} };
}

export const db: DB = load();

let timer: NodeJS.Timeout | null = null;
export function save() {
  if (!PERSIST || timer) return;
  timer = setTimeout(() => {
    timer = null;
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(db));
  }, 150);
}
