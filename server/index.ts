// Node entry: serves the core API over HTTP, realtime over Server-Sent Events, and the built app.
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { handle, listenerId, subscribe } from './core.ts';
import { GOOGLE_KEY } from './providers/index.ts';
import { resolvePlacesPhoto } from './providers/googlePlaces.ts';
import { configureStore, type DB } from './store.ts';

const FILE = process.env.DB_FILE ?? path.resolve('data/db.json');
let initial: DB | null = null;
try {
  initial = JSON.parse(fs.readFileSync(FILE, 'utf8'));
} catch {
  /* first run */
}
configureStore(initial, (db) => {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(db));
});

const app = express();
app.use(express.json());

// The iOS app (capacitor://localhost) and any extra origins in ALLOWED_ORIGINS may call the API.
const ALLOWED = new Set(['capacitor://localhost', 'ionic://localhost', 'http://localhost', ...(process.env.ALLOWED_ORIGINS ?? '').split(',').filter(Boolean)]);
app.use((req, res, next) => {
  const origin = req.header('origin');
  if (origin && ALLOWED.has(origin)) {
    res.set({ 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'Content-Type, x-user-id', 'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS', Vary: 'Origin' });
  }
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});

app.get('/api/health', (_req, res) => res.set('Cache-Control', 'no-store').json({ ok: true, at: new Date().toISOString() }));

app.get('/api/events', async (req, res) => {
  // EventSource can't send headers, so the credential comes in the query string.
  const uid = await listenerId(String(req.query.user ?? ''));
  if (!uid) return res.status(401).end();
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  res.flushHeaders();
  res.write(`event: hello\ndata: {}\n\n`);
  const off = subscribe(uid, () => res.write(`event: update\ndata: {}\n\n`));
  const ping = setInterval(() => res.write(`: ping\n\n`), 25000);
  req.on('close', () => {
    clearInterval(ping);
    off();
  });
});

// Google Places photos are proxied so the API key never reaches the browser.
// Each lookup is a billed Google call, so resolved photo links are cached for an hour.
const photoCache = new Map<string, { url: string; at: number }>();
app.get('/api/places-photo', async (req, res) => {
  if (!GOOGLE_KEY) return res.status(404).end();
  const name = String(req.query.name ?? '');
  const hit = photoCache.get(name);
  let url = hit && Date.now() - hit.at < 3600_000 ? hit.url : null;
  if (!url) {
    url = await resolvePlacesPhoto(GOOGLE_KEY, name).catch(() => null);
    if (url) {
      photoCache.set(name, { url, at: Date.now() });
      if (photoCache.size > 5000) photoCache.delete(photoCache.keys().next().value!);
    }
  }
  if (!url) return res.status(404).end();
  res.set('Cache-Control', 'private, max-age=3600');
  return res.redirect(302, url);
});

app.all(/^\/api\/.*/, async (req, res) => {
  const result = await handle(req.method, req.url.replace(/^\/api/, ''), req.header('x-user-id') ?? null, req.body, { ip: req.ip });
  res.status(result.status).json(result.body);
});

const dist = path.resolve('dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

const PORT = Number(process.env.PORT ?? 8787);
app.listen(PORT, () => console.log(`Date Night API on http://localhost:${PORT}${GOOGLE_KEY ? ' (Google Places live)' : ''}`));
