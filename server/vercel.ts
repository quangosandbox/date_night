// Vercel serverless entry: the same core API, backed by Neon Postgres.
//
// Each request is one transaction:
//   1. load the caller, lock their couple's row (FOR UPDATE) and load the couple's members and sessions,
//   2. run the core handler against that request-scoped copy,
//   3. write back only the documents that changed.
// Locking the couple serializes both partners' requests, so simultaneous swipes can't overwrite
// each other and a match is decided exactly once.
import { AsyncLocalStorage } from 'node:async_hooks';
import type { IncomingMessage, ServerResponse } from 'node:http';
import pg from 'pg';
import { credentialUserId, normalizeEmail } from './auth.ts';
import { handle, setLimiter } from './core.ts';
import { GOOGLE_KEY } from './providers/index.ts';
import { resolvePlacesPhoto } from './providers/googlePlaces.ts';
import { setScopeResolver, type DB } from './store.ts';

process.env.DN_REALTIME ??= 'poll';
process.env.DN_BOT_SYNC ??= '1';

const scope = new AsyncLocalStorage<DB>();
setScopeResolver(() => scope.getStore());

// Rate limits must hold across serverless instances, so they count in Postgres,
// inside the request's own transaction.
const requestClient = new AsyncLocalStorage<pg.PoolClient>();
setLimiter({
  async hit(key, max, windowSec) {
    const c = requestClient.getStore();
    if (!c) return true;
    const { rows } = await c.query<{ count: number }>(
      `INSERT INTO dn_rate (key, window_start, count) VALUES ($1, now(), 1)
       ON CONFLICT (key) DO UPDATE SET
         count = CASE WHEN dn_rate.window_start < now() - make_interval(secs => $2) THEN 1 ELSE dn_rate.count + 1 END,
         window_start = CASE WHEN dn_rate.window_start < now() - make_interval(secs => $2) THEN now() ELSE dn_rate.window_start END
       RETURNING count`,
      [key, windowSec],
    );
    return rows[0].count <= max;
  },
});

let pool: pg.Pool | null = null;
function getPool() {
  if (!pool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is not set');
    pool = new pg.Pool({ connectionString: url, max: 3, idleTimeoutMillis: 10_000, ssl: url.includes('localhost') ? false : { rejectUnauthorized: true } });
  }
  return pool;
}

let schemaReady: Promise<void> | null = null;
export function ensureSchema(client: pg.Pool | pg.PoolClient = getPool()) {
  schemaReady ??= client
    .query(
      `CREATE TABLE IF NOT EXISTS dn_docs (
         kind text NOT NULL,
         id text NOT NULL,
         couple_id text,
         invite_code text,
         data jsonb NOT NULL,
         updated_at timestamptz NOT NULL DEFAULT now(),
         PRIMARY KEY (kind, id)
       );
       CREATE INDEX IF NOT EXISTS dn_docs_couple ON dn_docs (kind, couple_id);
       CREATE UNIQUE INDEX IF NOT EXISTS dn_docs_invite ON dn_docs (invite_code) WHERE invite_code IS NOT NULL;
       CREATE UNIQUE INDEX IF NOT EXISTS dn_docs_email ON dn_docs (lower(data->>'email')) WHERE kind = 'user';
       CREATE TABLE IF NOT EXISTS dn_rate (key text PRIMARY KEY, window_start timestamptz NOT NULL, count int NOT NULL);`,
    )
    .then(() => undefined)
    .catch((e) => {
      schemaReady = null;
      throw e;
    });
  return schemaReady;
}

type Kind = 'user' | 'couple' | 'session';
// Postgres jsonb rejects lone UTF-16 surrogates (e.g. half an emoji left by a .slice()),
// so every string is made well-formed before it's stored.
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;
export const toDbJson = (doc: unknown) =>
  JSON.stringify(doc, (_k, v) => (typeof v === 'string' ? v.replace(LONE_SURROGATE, '\uFFFD') : v));

const BUCKET: Record<Kind, keyof DB> = { user: 'users', couple: 'couples', session: 'sessions' };

async function loadInto(c: pg.PoolClient, dbs: DB, sql: string, params: unknown[]) {
  const { rows } = await c.query<{ kind: Kind; id: string; data: never }>(sql, params);
  for (const r of rows) (dbs[BUCKET[r.kind]] as Record<string, unknown>)[r.id] = r.data;
  return rows.length;
}

async function loadCouple(c: pg.PoolClient, dbs: DB, coupleId: string) {
  await loadInto(c, dbs, `SELECT kind, id, data FROM dn_docs WHERE kind = 'couple' AND id = $1 FOR UPDATE`, [coupleId]);
  await loadInto(c, dbs, `SELECT kind, id, data FROM dn_docs WHERE kind = 'user' AND couple_id = $1`, [coupleId]);
  // Recent sessions only: the active one plus history the taste model learns from.
  await loadInto(c, dbs, `SELECT kind, id, data FROM dn_docs WHERE kind = 'session' AND couple_id = $1 ORDER BY updated_at DESC LIMIT 30`, [coupleId]);
}

function docMeta(kind: Kind, doc: Record<string, unknown>): { coupleId: string | null; invite: string | null } {
  if (kind === 'couple') return { coupleId: String(doc.id), invite: String(doc.inviteCode ?? '') || null };
  return { coupleId: (doc.coupleId as string | null) ?? null, invite: null };
}

/** Run one API call inside a transaction with a request-scoped DB. Exported for tests. */
export async function runApi(method: string, path: string, credential: string | null, body: unknown, p: pg.Pool = getPool(), ip = 'unknown') {
  const userId = credentialUserId(credential);
  await ensureSchema(p);
  const c = await p.connect();
  try {
    await c.query('BEGIN');
    const dbs: DB = { users: {}, couples: {}, sessions: {} };
    if (userId) {
      await loadInto(c, dbs, `SELECT kind, id, data FROM dn_docs WHERE kind = 'user' AND id = $1`, [userId]);
      const me = dbs.users[userId];
      if (me?.coupleId) await loadCouple(c, dbs, me.coupleId);
    }
    // Accounts are looked up by email (log in), or checked for clashes (sign up, save account).
    if (/^\/(auth\/(login|signup)|me\/account)$/.test(path)) {
      const email = normalizeEmail((body as { email?: string } | null)?.email);
      if (email) {
        const { rows } = await c.query<{ id: string; data: { coupleId?: string | null } }>(
          `SELECT id, data FROM dn_docs WHERE kind = 'user' AND lower(data->>'email') = $1 FOR UPDATE`,
          [email],
        );
        for (const r of rows) {
          dbs.users[r.id] ??= r.data as never;
          if (path === '/auth/login' && r.data.coupleId && !dbs.couples[r.data.coupleId]) await loadCouple(c, dbs, r.data.coupleId);
        }
      }
    }
    if (/^\/couple\/join/.test(path)) {
      const code = String((body as { code?: string } | null)?.code ?? '').trim().toUpperCase();
      const { rows } = await c.query<{ id: string }>(`SELECT id FROM dn_docs WHERE kind = 'couple' AND invite_code = $1`, [code]);
      if (rows[0] && !dbs.couples[rows[0].id]) await loadCouple(c, dbs, rows[0].id);
    }

    const before = new Map<string, string>();
    for (const kind of Object.keys(BUCKET) as Kind[])
      for (const [id, doc] of Object.entries(dbs[BUCKET[kind]])) before.set(`${kind}:${id}`, toDbJson(doc));

    const myCouple = userId ? dbs.users[userId]?.coupleId ?? null : null;
    const result = await scope.run(dbs, () => requestClient.run(c, () => handle(method, path, credential, body, { ip })));

    if (result.status < 500) {
      const seen = new Set<string>();
      for (const kind of Object.keys(BUCKET) as Kind[]) {
        for (const [id, doc] of Object.entries(dbs[BUCKET[kind]]) as [string, Record<string, unknown>][]) {
          const key = `${kind}:${id}`;
          seen.add(key);
          const json = toDbJson(doc);
          if (before.get(key) === json) continue;
          const { coupleId, invite } = docMeta(kind, doc);
          await c.query(
            `INSERT INTO dn_docs (kind, id, couple_id, invite_code, data, updated_at) VALUES ($1, $2, $3, $4, $5, now())
             ON CONFLICT (kind, id) DO UPDATE SET couple_id = EXCLUDED.couple_id, invite_code = EXCLUDED.invite_code, data = EXCLUDED.data, updated_at = now()`,
            [kind, id, coupleId, invite, json],
          );
        }
      }
      for (const key of before.keys()) {
        if (seen.has(key)) continue;
        const [kind, id] = key.split(':');
        await c.query(`DELETE FROM dn_docs WHERE kind = $1 AND id = $2`, [kind, id]);
      }
      // Unpairing or deleting an account also removes the couple's older sessions (only recent ones were loaded).
      if (result.status === 200 && myCouple && (path === '/couple/leave' || path === '/me/delete'))
        await c.query(`DELETE FROM dn_docs WHERE kind = 'session' AND couple_id = $1`, [myCouple]);
    }
    await c.query('COMMIT');
    return result;
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  if (req.method === 'GET' || req.method === 'HEAD') return undefined;
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > 100_000) throw new Error('Body too large');
    chunks.push(chunk as Buffer);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  return text ? JSON.parse(text) : undefined;
}

function send(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers });
  res.end(JSON.stringify(body));
}

const ALLOWED = new Set(['capacitor://localhost', 'ionic://localhost', ...(process.env.ALLOWED_ORIGINS ?? '').split(',').filter(Boolean)]);

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const origin = req.headers.origin;
  const cors: Record<string, string> =
    origin && ALLOWED.has(origin)
      ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'Content-Type, x-user-id', 'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS', Vary: 'Origin' }
      : {};
  if (req.method === 'OPTIONS') {
    res.writeHead(204, cors);
    return res.end();
  }
  try {
    const url = new URL(req.url ?? '/', 'http://x');
    const path = url.pathname.replace(/^\/api/, '') + url.search;

    if (url.pathname === '/api/places-photo') {
      const photo = GOOGLE_KEY ? await resolvePlacesPhoto(GOOGLE_KEY, url.searchParams.get('name') ?? '').catch(() => null) : null;
      if (!photo) return send(res, 404, { error: 'No photo' }, cors);
      res.writeHead(302, { Location: photo, 'Cache-Control': 'public, max-age=3600', ...cors });
      return res.end();
    }

    if (url.pathname === '/api/health') {
      // For uptime monitors: the function is up and the database answers.
      await ensureSchema();
      await getPool().query('SELECT 1');
      return send(res, 200, { ok: true, db: true, at: new Date().toISOString() }, { ...cors, 'Cache-Control': 'no-store' });
    }

    const credential = (req.headers['x-user-id'] as string | undefined) || null;
    const ip = String(req.headers['x-real-ip'] ?? req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() || 'unknown';
    const result = await runApi(req.method ?? 'GET', path, credential, await readBody(req), getPool(), ip);
    return send(res, result.status, result.body, cors);
  } catch (e) {
    console.error(e);
    return send(res, 500, { error: 'Something went wrong on our side.' }, cors);
  }
}
