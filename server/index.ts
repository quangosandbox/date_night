import express, { type NextFunction, type Request, type Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import type { AppState, Filters, Mode, User, Vote } from '../shared/types.ts';
import { buildDeck } from './deck.ts';
import { acceptNearMiss, applyVote, bookMatch, isExhausted, letFateDecide, newSession, toView, type Session } from './engine.ts';
import { providers } from './providers/index.ts';
import { AREAS, CUISINES, FORMATS, GENRES } from './providers/mockData.ts';
import { db, save } from './store.ts';
import { id, inviteCode } from './util.ts';
import { scheduleBot, setBotHooks } from './bot.ts';

const app = express();
app.use(express.json());

// ---------- realtime (Server-Sent Events) ----------
const streams = new Map<string, Set<Response>>();

export function notifyUsers(userIds: string[]) {
  for (const uid of userIds) for (const res of streams.get(uid) ?? []) res.write(`event: update\ndata: {}\n\n`);
}

app.get('/api/events', (req, res) => {
  const uid = String(req.query.user ?? '');
  if (!db.users[uid]) return res.status(401).end();
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  res.flushHeaders();
  res.write(`event: hello\ndata: {}\n\n`);
  const set = streams.get(uid) ?? new Set();
  set.add(res);
  streams.set(uid, set);
  const ping = setInterval(() => res.write(`: ping\n\n`), 25000);
  req.on('close', () => {
    clearInterval(ping);
    set.delete(res);
  });
});

// ---------- helpers ----------
type AuthedRequest = Request & { user: User };

function auth(req: Request, res: Response, next: NextFunction) {
  const user = db.users[String(req.header('x-user-id') ?? '')];
  if (!user) return res.status(401).json({ error: 'Unknown user' });
  (req as AuthedRequest).user = user;
  next();
}

const wrap =
  (fn: (req: AuthedRequest, res: Response) => Promise<unknown> | unknown) => (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(fn(req as AuthedRequest, res)).catch(next);

function coupleOf(u: User) {
  return u.coupleId ? db.couples[u.coupleId] ?? null : null;
}

function activeSession(u: User): Session | null {
  const c = coupleOf(u);
  return c?.activeSessionId ? db.sessions[c.activeSessionId] ?? null : null;
}

function stateFor(u: User): AppState {
  const couple = coupleOf(u);
  const partnerId = couple?.memberIds.find((m) => m !== u.id);
  const s = activeSession(u);
  return {
    me: u,
    partner: partnerId ? db.users[partnerId] ?? null : null,
    couple: couple ? { id: couple.id, inviteCode: couple.inviteCode, memberIds: couple.memberIds } : null,
    session: s ? toView(s, u.id) : null,
    history: couple?.history ?? [],
  };
}

function touch(s: Session | null, extraUsers: string[] = []) {
  save();
  notifyUsers([...(s?.memberIds ?? []), ...extraUsers]);
}

const COLORS = ['#FF6A4D', '#F5C451', '#8EC5FF', '#B59CFF', '#7FD6A8'];

function sanitizeFilters(input: Partial<Filters>, mode: Mode): Filters {
  const today = new Date().toISOString().slice(0, 10);
  const time = (t: unknown, fallback: string) => (typeof t === 'string' && /^\d{2}:\d{2}$/.test(t) ? t : fallback);
  const strs = (a: unknown, allowed: string[]) => (Array.isArray(a) ? a.filter((x): x is string => allowed.includes(x)) : []);
  let windowStart = time(input.windowStart, mode === 'dinner' ? '19:00' : '18:30');
  let windowEnd = time(input.windowEnd, mode === 'dinner' ? '21:00' : '21:30');
  if (windowEnd < windowStart) [windowStart, windowEnd] = [windowEnd, windowStart];
  return {
    date: typeof input.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.date) ? input.date : today,
    windowStart,
    windowEnd,
    partySize: Math.min(8, Math.max(1, Number(input.partySize) || 2)),
    area: AREAS.some((a) => a.id === input.area) ? input.area! : AREAS[0].id,
    radiusMi: Math.min(10, Math.max(0.5, Number(input.radiusMi) || 2)),
    cuisines: strs(input.cuisines, CUISINES),
    prices: Array.isArray(input.prices) ? input.prices.map(Number).filter((p) => p >= 1 && p <= 4) : [],
    genres: strs(input.genres, GENRES),
    formats: strs(input.formats, FORMATS),
    autoBook: input.autoBook !== false,
  };
}

async function runAutoBook(s: Session, actor: User) {
  if (s.status !== 'matched' || !s.filters.autoBook) return;
  await doBook(s, actor);
}

async function doBook(s: Session, actor: User, preferredSlotId?: string) {
  const result = await bookMatch(
    s,
    async (slot, details) => {
      if (s.mode === 'movie') return providers.showtimes.book(slot, details);
      const p = providers.reservations.find((r) => r.id === slot.provider);
      if (!p) return { ok: false, reason: 'provider_error' };
      return p.book(slot.ref ?? '', slot, details);
    },
    { name: actor.name, phone: actor.phone },
    actor.id,
    preferredSlotId,
  );
  if (result === 'booked' && s.booking) {
    const c = db.couples[s.coupleId];
    c?.history.unshift(s.booking);
  }
  return result;
}

setBotHooks({
  onChange: (s) => touch(s),
  onMatch: async (s) => {
    // When the bot completes a match, book on behalf of the human partner.
    const human = s.memberIds.map((m) => db.users[m]).find((u) => u && !u.isBot);
    if (human) await runAutoBook(s, human);
    touch(s);
  },
});

// ---------- routes ----------
app.get('/api/meta', (_req, res) => {
  res.json({ areas: AREAS, cuisines: CUISINES, genres: GENRES, formats: FORMATS });
});

app.post(
  '/api/users',
  wrap(async (req, res) => {
    const name = String(req.body?.name ?? '').trim().slice(0, 40);
    const phone = String(req.body?.phone ?? '').trim().slice(0, 30);
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const user: User = { id: id('u'), name, phone, color: COLORS[Object.keys(db.users).length % 2], coupleId: null };
    db.users[user.id] = user;
    save();
    res.json(stateFor(user));
  }),
);

app.get('/api/state', auth, wrap((req, res) => res.json(stateFor(req.user))));

app.patch(
  '/api/me',
  auth,
  wrap((req, res) => {
    const { name, phone, letterboxd } = req.body ?? {};
    if (typeof name === 'string' && name.trim()) req.user.name = name.trim().slice(0, 40);
    if (typeof phone === 'string') req.user.phone = phone.trim().slice(0, 30);
    if (typeof letterboxd === 'string') req.user.letterboxd = letterboxd.trim().replace(/^@/, '').slice(0, 40);
    const c = coupleOf(req.user);
    save();
    notifyUsers(c?.memberIds ?? [req.user.id]);
    res.json(stateFor(req.user));
  }),
);

app.post(
  '/api/couple',
  auth,
  wrap((req, res) => {
    if (req.user.coupleId) return res.json(stateFor(req.user));
    const couple = { id: id('c'), inviteCode: inviteCode(), memberIds: [req.user.id], activeSessionId: null, history: [] };
    db.couples[couple.id] = couple;
    req.user.coupleId = couple.id;
    save();
    res.json(stateFor(req.user));
  }),
);

app.post(
  '/api/couple/join',
  auth,
  wrap((req, res) => {
    const code = String(req.body?.code ?? '').trim().toUpperCase();
    const couple = Object.values(db.couples).find((c) => c.inviteCode === code);
    if (!couple) return res.status(404).json({ error: "That code didn't match. Double-check with your partner." });
    if (couple.memberIds.includes(req.user.id)) return res.json(stateFor(req.user));
    if (couple.memberIds.length >= 2) return res.status(409).json({ error: 'That couple is already paired.' });
    // Leave any solo couple you created while waiting.
    const mine = coupleOf(req.user);
    if (mine && mine.memberIds.length === 1) delete db.couples[mine.id];
    couple.memberIds.push(req.user.id);
    req.user.coupleId = couple.id;
    req.user.color = db.users[couple.memberIds[0]].color === COLORS[0] ? COLORS[1] : COLORS[0];
    save();
    notifyUsers(couple.memberIds);
    res.json(stateFor(req.user));
  }),
);

/** No partner handy? Pair with a bot that swipes alongside you — handy for demos and testing. */
app.post(
  '/api/couple/demo',
  auth,
  wrap((req, res) => {
    let couple = coupleOf(req.user);
    if (!couple) {
      couple = { id: id('c'), inviteCode: inviteCode(), memberIds: [req.user.id], activeSessionId: null, history: [] };
      db.couples[couple.id] = couple;
      req.user.coupleId = couple.id;
    }
    if (couple.memberIds.length >= 2) return res.json(stateFor(req.user));
    const bot: User = {
      id: id('u'),
      name: 'Sam',
      phone: '',
      color: req.user.color === COLORS[0] ? COLORS[1] : COLORS[0],
      coupleId: couple.id,
      letterboxd: 'sam_watches',
      isBot: true,
    };
    db.users[bot.id] = bot;
    couple.memberIds.push(bot.id);
    save();
    notifyUsers(couple.memberIds);
    res.json(stateFor(req.user));
  }),
);

app.post(
  '/api/couple/leave',
  auth,
  wrap((req, res) => {
    const c = coupleOf(req.user);
    if (c) {
      for (const m of c.memberIds) {
        const u = db.users[m];
        if (u) u.coupleId = null;
        if (u?.isBot) delete db.users[m];
      }
      delete db.couples[c.id];
      notifyUsers(c.memberIds);
    }
    save();
    res.json(stateFor(req.user));
  }),
);

app.post(
  '/api/sessions',
  auth,
  wrap(async (req, res) => {
    const couple = coupleOf(req.user);
    if (!couple || couple.memberIds.length < 2) return res.status(400).json({ error: 'Pair with your partner first.' });
    const mode: Mode = req.body?.mode === 'movie' ? 'movie' : 'dinner';
    const filters = sanitizeFilters(req.body?.filters ?? {}, mode);
    const members = couple.memberIds.map((m) => db.users[m]);
    const deck = await buildDeck(mode, filters, members, providers);
    const s = newSession({
      id: id('s'),
      coupleId: couple.id,
      mode,
      hostId: req.user.id,
      memberIds: couple.memberIds,
      filters,
      deck,
      createdAt: new Date().toISOString(),
    });
    db.sessions[s.id] = s;
    couple.activeSessionId = s.id;
    touch(s);
    scheduleBot(s, members);
    res.json(stateFor(req.user));
  }),
);

/** Preview how many bookable options a set of filters yields, before starting. */
app.post(
  '/api/preview',
  auth,
  wrap(async (req, res) => {
    const couple = coupleOf(req.user);
    const mode: Mode = req.body?.mode === 'movie' ? 'movie' : 'dinner';
    const filters = sanitizeFilters(req.body?.filters ?? {}, mode);
    const members = (couple?.memberIds ?? [req.user.id]).map((m) => db.users[m]);
    const deck = await buildDeck(mode, filters, members, providers);
    res.json({ count: deck.length });
  }),
);

function sessionFor(req: AuthedRequest, res: Response): Session | null {
  const s = db.sessions[req.params.id];
  if (!s || !s.memberIds.includes(req.user.id)) {
    res.status(404).json({ error: 'Session not found' });
    return null;
  }
  return s;
}

app.post(
  '/api/sessions/:id/vote',
  auth,
  wrap(async (req, res) => {
    const s = sessionFor(req, res);
    if (!s) return;
    const vote = req.body?.vote as Vote;
    if (!['like', 'pass', 'super'].includes(vote)) return res.status(400).json({ error: 'Bad vote' });
    const outcome = applyVote(s, req.user.id, String(req.body?.optionId), vote);
    if (outcome.kind === 'matched') {
      touch(s); // show the match screen right away, then book
      await runAutoBook(s, req.user);
    }
    touch(s);
    scheduleBot(s, s.memberIds.map((m) => db.users[m]));
    res.json(stateFor(req.user));
  }),
);

app.post(
  '/api/sessions/:id/book',
  auth,
  wrap(async (req, res) => {
    const s = sessionFor(req, res);
    if (!s) return;
    await doBook(s, req.user, req.body?.slotId);
    touch(s);
    res.json(stateFor(req.user));
  }),
);

app.post(
  '/api/sessions/:id/accept',
  auth,
  wrap(async (req, res) => {
    const s = sessionFor(req, res);
    if (!s) return;
    if (!acceptNearMiss(s, req.user.id, String(req.body?.optionId))) return res.status(400).json({ error: "Your partner hasn't liked that one." });
    touch(s);
    await runAutoBook(s, req.user);
    touch(s);
    res.json(stateFor(req.user));
  }),
);

app.post(
  '/api/sessions/:id/fate',
  auth,
  wrap(async (req, res) => {
    const s = sessionFor(req, res);
    if (!s) return;
    letFateDecide(s);
    touch(s);
    await runAutoBook(s, req.user);
    touch(s);
    res.json(stateFor(req.user));
  }),
);

app.post(
  '/api/sessions/:id/widen',
  auth,
  wrap(async (req, res) => {
    const s = sessionFor(req, res);
    if (!s) return;
    if (s.status !== 'exhausted' && s.status !== 'swiping') return res.json(stateFor(req.user));
    const f = { ...s.filters };
    const kind = String(req.body?.kind);
    if (kind === 'time') {
      const [sh, sm] = f.windowStart.split(':').map(Number);
      const [eh, em] = f.windowEnd.split(':').map(Number);
      f.windowStart = `${String(Math.max(17, sh - 1)).padStart(2, '0')}:${String(sm).padStart(2, '0')}`;
      f.windowEnd = `${String(Math.min(22, eh + 1)).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
    } else if (kind === 'radius') f.radiusMi = Math.min(10, f.radiusMi + 1.5);
    else if (kind === 'cuisine') {
      f.cuisines = [];
      f.genres = [];
      f.prices = [];
      f.formats = [];
    }
    // Keep everyone's votes; drop only what you both passed on.
    const bothPassed = new Set(s.deck.filter((o) => s.memberIds.every((m) => s.votes[m]?.[o.id] === 'pass')).map((o) => o.id));
    const fresh = await buildDeck(s.mode, f, s.memberIds.map((m) => db.users[m]), providers, bothPassed);
    s.filters = f;
    s.deck = fresh;
    s.status = fresh.length && !isExhausted(s) ? 'swiping' : 'exhausted';
    touch(s);
    scheduleBot(s, s.memberIds.map((m) => db.users[m]));
    res.json(stateFor(req.user));
  }),
);

app.post(
  '/api/sessions/:id/end',
  auth,
  wrap((req, res) => {
    const s = sessionFor(req, res);
    if (!s) return;
    if (s.status !== 'booked') s.status = 'cancelled';
    const c = db.couples[s.coupleId];
    if (c?.activeSessionId === s.id) c.activeSessionId = null;
    touch(s);
    res.json(stateFor(req.user));
  }),
);

// ---------- static client (production) ----------
const dist = path.resolve('dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on our side.' });
});

const PORT = Number(process.env.PORT ?? 8787);
app.listen(PORT, () => console.log(`Date Night API on http://localhost:${PORT}`));

