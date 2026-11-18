// Node entry: serves the core API over HTTP, realtime over Server-Sent Events, and the built app.
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { handle, subscribe, userExists } from './core.ts';
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

app.get('/api/events', (req, res) => {
  const uid = String(req.query.user ?? '');
  if (!userExists(uid)) return res.status(401).end();
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
app.get('/api/places-photo', async (req, res) => {
  if (!GOOGLE_KEY) return res.status(404).end();
  const url = await resolvePlacesPhoto(GOOGLE_KEY, String(req.query.name ?? '')).catch(() => null);
  return url ? res.redirect(302, url) : res.status(404).end();
});

app.all(/^\/api\/.*/, async (req, res) => {
  const result = await handle(req.method, req.path.replace(/^\/api/, ''), req.header('x-user-id') ?? null, req.body);
  res.status(result.status).json(result.body);
});

const dist = path.resolve('dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

const PORT = Number(process.env.PORT ?? 8787);
app.listen(PORT, () => console.log(`Date Night API on http://localhost:${PORT}${GOOGLE_KEY ? ' (Google Places live)' : ''}`));
