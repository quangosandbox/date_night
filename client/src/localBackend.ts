// On-device backend: runs the exact same core as the server, persisted to localStorage.
// Used by the iOS app and the shareable web build so everything works with no server.
import { handle, subscribe } from '../../server/core.ts';
import { configureStore, type DB } from '../../server/store.ts';

const KEY = 'dn.localdb.v1';

function load(): DB | null {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? 'null');
  } catch {
    return null;
  }
}

/** Keep storage small: active sessions plus the most recent finished ones. */
function prune(db: DB): DB {
  const active = new Set(Object.values(db.couples).map((c) => c.activeSessionId));
  const sessions = Object.values(db.sessions)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .filter((s, i) => active.has(s.id) || i < 25);
  return { ...db, sessions: Object.fromEntries(sessions.map((s) => [s.id, s])) };
}

configureStore(load(), (db) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(prune(db)));
  } catch {
    /* storage full or blocked: keep running in memory */
  }
});

export { handle, subscribe };
