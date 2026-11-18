// The whole API as plain functions: handle(method, path, userId, body).
// The Node server (server/index.ts) exposes it over HTTP + SSE; the phone build
// (client/src/localBackend.ts) calls it in-process so the app runs fully offline.
import type { AppState, Booking, Filters, Mode, OurPlace, RankedEntry, Rating, User, Verdict, Vote } from '../shared/types.ts';
import { scheduleBot, setBotHooks } from './bot.ts';
import { buildDeck } from './deck.ts';
import { acceptNearMiss, applyVote, bookMatch, isExhausted, letFateDecide, newSession, noTable, recordSelfBooking, toView, type Session } from './engine.ts';
import { BOOKING_MODE, GOOGLE_KEY, MODES, providers } from './providers/index.ts';
import { AREAS, CUISINES, FORMATS, GENRES } from './providers/mockData.ts';
import { db, save, type StoredCouple } from './store.ts';
import { bucket, insertRanking, learnTaste, summarizeTaste, userScores, type TasteModel } from './taste.ts';
import { id, inviteCode, rng } from './util.ts';

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// ---------- realtime ----------
type Listener = () => void;
const listeners = new Map<string, Set<Listener>>();

export function subscribe(userId: string, fn: Listener) {
  const set = listeners.get(userId) ?? new Set();
  set.add(fn);
  listeners.set(userId, set);
  return () => set.delete(fn);
}

function notify(userIds: string[]) {
  for (const uid of userIds) for (const fn of listeners.get(uid) ?? []) fn();
}

function touch(s: Session | null, extra: string[] = []) {
  save();
  notify([...(s?.memberIds ?? []), ...extra]);
}

// ---------- helpers ----------
const COLORS = ['#EC9177', '#F0C53E', '#9DAF6E'];

const coupleOf = (u: User): StoredCouple | null => (u.coupleId ? db.couples[u.coupleId] ?? null : null);

function activeSession(u: User): Session | null {
  const c = coupleOf(u);
  return c?.activeSessionId ? db.sessions[c.activeSessionId] ?? null : null;
}

function tasteFor(couple: StoredCouple | null): TasteModel {
  if (!couple) return learnTaste({ swipes: [], ratings: [] });
  const swipes: { option: Session['deck'][number]; vote: Vote }[] = [];
  for (const s of Object.values(db.sessions)) {
    if (s.coupleId !== couple.id) continue;
    for (const m of s.memberIds)
      for (const [optId, vote] of Object.entries(s.votes[m] ?? {})) {
        const option = s.deck.find((o) => o.id === optId);
        if (option) swipes.push({ option, vote });
      }
  }
  const members = couple.memberIds.map((m) => db.users[m]).filter(Boolean);
  const scores = new Map(members.map((u) => [u.id, userScores(u)]));
  const ratings = couple.history
    .filter((b) => b.option)
    .map((b) => ({
      option: b.option!,
      ratings: Object.values(couple.ratings?.[b.confirmation] ?? {}).map((r) => ({ ...r, score: scores.get(r.userId)?.get(b.optionId) ?? 5 })),
    }));
  return learnTaste({ swipes, ratings });
}

function withScore(r: Omit<Rating, 'score'>, users: Map<string, Map<string, number>>, optionId: string): Rating {
  return { ...r, score: users.get(r.userId)?.get(optionId) ?? 5 };
}

function stateFor(u: User): AppState {
  const couple = coupleOf(u);
  const partnerId = couple?.memberIds.find((m) => m !== u.id);
  const partner = partnerId ? db.users[partnerId] ?? null : null;
  const s = activeSession(u);
  const history = couple?.history ?? [];
  const scores = new Map([u, partner].filter((x): x is User => !!x).map((x) => [x.id, userScores(x)]));

  const ourList: OurPlace[] = [];
  const toRate: Booking[] = [];
  const seen = new Set<string>();
  for (const b of history) {
    const rs = couple?.ratings?.[b.confirmation] ?? {};
    const mine = rs[u.id] ? withScore(rs[u.id], scores, b.optionId) : undefined;
    if (!mine) {
      toRate.push(b);
      continue;
    }
    if (seen.has(b.optionId)) continue; // one row per place; your latest visit
    seen.add(b.optionId);
    const theirs = partnerId && rs[partnerId] ? withScore(rs[partnerId], scores, b.optionId) : undefined;
    ourList.push({
      confirmation: b.confirmation,
      optionId: b.optionId,
      title: b.title,
      kind: b.option?.kind ?? 'dinner',
      date: b.date,
      art: b.option?.art ?? { bg: '#E8473F', fg: '#1A1414', motif: 'star' },
      photo: b.option?.photos[0]?.url,
      mine,
      partner: theirs,
      together: theirs ? Math.round(((mine.score + theirs.score) / 2) * 10) / 10 : mine.score,
    });
  }
  ourList.sort((a, b) => (b.together ?? 0) - (a.together ?? 0));

  const my = scores.get(u.id) ?? new Map();
  const myRanking: RankedEntry[] = (u.rankings ?? []).map((r) => ({ ...r, score: my.get(r.optionId) ?? 5 }));

  return {
    me: u,
    partner,
    couple: couple ? { id: couple.id, inviteCode: couple.inviteCode, memberIds: couple.memberIds } : null,
    session: s ? toView(s, u.id) : null,
    history,
    toRate,
    ourList,
    myRanking,
    taste: summarizeTaste(tasteFor(couple)),
  };
}

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
  if (result === 'booked' && s.booking) db.couples[s.coupleId]?.history.unshift(s.booking);
  return result;
}

async function runAutoBook(s: Session, actor: User) {
  // In handoff mode there's nothing to auto-book: the couple reserves via Google Maps / site / phone.
  if (BOOKING_MODE === 'auto' && s.status === 'matched' && s.filters.autoBook) await doBook(s, actor);
}

setBotHooks({
  onChange: (s) => touch(s),
  onMatch: async (s) => {
    const human = s.memberIds.map((m) => db.users[m]).find((u) => u && !u.isBot);
    if (human) await runAutoBook(s, human);
    touch(s);
  },
});

const members = (c: StoredCouple) => c.memberIds.map((m) => db.users[m]).filter(Boolean);

function newCouple(u: User): StoredCouple {
  const couple: StoredCouple = { id: id('c'), inviteCode: inviteCode(), memberIds: [u.id], activeSessionId: null, history: [], ratings: {} };
  db.couples[couple.id] = couple;
  u.coupleId = couple.id;
  return couple;
}

function rateAs(user: User, couple: StoredCouple, b: Booking, verdict: Verdict, insertAt: number, details: { tags?: unknown; bestItem?: unknown; note?: unknown }) {
  const kind = b.option?.kind ?? 'dinner';
  insertRanking(
    user,
    { optionId: b.optionId, title: b.title, kind, verdict, art: b.option?.art ?? { bg: '#E8473F', fg: '#1A1414', motif: 'star' }, photo: b.option?.photos[0]?.url },
    insertAt,
  );
  couple.ratings ??= {};
  couple.ratings[b.confirmation] ??= {};
  couple.ratings[b.confirmation][user.id] = {
    userId: user.id,
    verdict,
    tags: Array.isArray(details.tags) ? details.tags.filter((t): t is string => typeof t === 'string').slice(0, 8) : [],
    bestItem: typeof details.bestItem === 'string' ? details.bestItem.slice(0, 80) : undefined,
    note: typeof details.note === 'string' && details.note.trim() ? details.note.trim().slice(0, 500) : undefined,
    at: new Date().toISOString(),
  };
}

// ---------- routes ----------
type Ctx = { user: User; body: any; params: string[] };
type Handler = (ctx: Ctx) => Promise<unknown> | unknown;
const routes: [string, RegExp, Handler, boolean][] = []; // method, path, handler, needs auth
const route = (method: string, path: RegExp, h: Handler, authed = true) => routes.push([method, path, h, authed]);

route(
  'GET',
  /^\/meta$/,
  () => ({ areas: AREAS, cuisines: CUISINES, genres: GENRES, formats: FORMATS, modes: MODES, bookingMode: BOOKING_MODE, liveData: Boolean(GOOGLE_KEY) }),
  false,
);

route(
  'POST',
  /^\/users$/,
  ({ body }) => {
    const name = String(body?.name ?? '').trim().slice(0, 40);
    const phone = String(body?.phone ?? '').trim().slice(0, 30);
    if (!name) throw new HttpError(400, 'Name is required');
    const user: User = { id: id('u'), name, phone, color: COLORS[Object.keys(db.users).length % 2], coupleId: null };
    db.users[user.id] = user;
    save();
    return stateFor(user);
  },
  false,
);

route('GET', /^\/state$/, ({ user }) => stateFor(user));

route('PATCH', /^\/me$/, ({ user, body }) => {
  const { name, phone, letterboxd } = body ?? {};
  if (typeof name === 'string' && name.trim()) user.name = name.trim().slice(0, 40);
  if (typeof phone === 'string') user.phone = phone.trim().slice(0, 30);
  if (typeof letterboxd === 'string') user.letterboxd = letterboxd.trim().replace(/^@/, '').slice(0, 40);
  save();
  notify(coupleOf(user)?.memberIds ?? [user.id]);
  return stateFor(user);
});

route('POST', /^\/couple$/, ({ user }) => {
  if (!user.coupleId) newCouple(user);
  save();
  return stateFor(user);
});

route('POST', /^\/couple\/join$/, ({ user, body }) => {
  const code = String(body?.code ?? '').trim().toUpperCase();
  const couple = Object.values(db.couples).find((c) => c.inviteCode === code);
  if (!couple) throw new HttpError(404, "That code didn't match. Double-check with your partner.");
  if (couple.memberIds.includes(user.id)) return stateFor(user);
  if (couple.memberIds.length >= 2) throw new HttpError(409, 'That couple is already paired.');
  const mine = coupleOf(user);
  if (mine && mine.memberIds.length === 1) delete db.couples[mine.id];
  couple.memberIds.push(user.id);
  user.coupleId = couple.id;
  user.color = db.users[couple.memberIds[0]].color === COLORS[0] ? COLORS[1] : COLORS[0];
  save();
  notify(couple.memberIds);
  return stateFor(user);
});

function addPartner(user: User, partner: Omit<User, 'id' | 'coupleId' | 'color'>) {
  const couple = coupleOf(user) ?? newCouple(user);
  if (couple.memberIds.length >= 2) return stateFor(user);
  const p: User = { ...partner, id: id('u'), coupleId: couple.id, color: user.color === COLORS[0] ? COLORS[1] : COLORS[0] };
  db.users[p.id] = p;
  couple.memberIds.push(p.id);
  save();
  notify(couple.memberIds);
  return stateFor(user);
}

/** A bot partner that swipes alongside you. */
route('POST', /^\/couple\/demo$/, ({ user }) => addPartner(user, { name: 'Sam', phone: '', letterboxd: 'sam_watches', isBot: true }));

/** Pass-and-play: both of you on one phone. */
route('POST', /^\/couple\/local-partner$/, ({ user, body }) => {
  const name = String(body?.name ?? '').trim().slice(0, 40);
  if (!name) throw new HttpError(400, "What's your partner's name?");
  return addPartner(user, { name, phone: '' });
});

route('POST', /^\/couple\/leave$/, ({ user }) => {
  const c = coupleOf(user);
  if (c) {
    for (const m of c.memberIds) {
      const u = db.users[m];
      if (u) u.coupleId = null;
      if (u?.isBot) delete db.users[m];
    }
    delete db.couples[c.id];
    notify(c.memberIds);
  }
  save();
  return stateFor(user);
});

route('POST', /^\/sessions$/, async ({ user, body }) => {
  const couple = coupleOf(user);
  if (!couple || couple.memberIds.length < 2) throw new HttpError(400, 'Pair with your partner first.');
  const mode: Mode = body?.mode === 'movie' ? 'movie' : 'dinner';
  if (!MODES.includes(mode)) throw new HttpError(400, 'Movies are coming soon — dinner is live.');
  const filters = sanitizeFilters(body?.filters ?? {}, mode);
  const deck = await buildDeck(mode, filters, members(couple), providers, { taste: tasteFor(couple) });
  const s = newSession({ id: id('s'), coupleId: couple.id, mode, hostId: user.id, memberIds: couple.memberIds, filters, deck, createdAt: new Date().toISOString() });
  db.sessions[s.id] = s;
  couple.activeSessionId = s.id;
  touch(s);
  scheduleBot(s, members(couple));
  return stateFor(user);
});

route('POST', /^\/preview$/, async ({ user, body }) => {
  const couple = coupleOf(user);
  const mode: Mode = body?.mode === 'movie' ? 'movie' : 'dinner';
  const filters = sanitizeFilters(body?.filters ?? {}, mode);
  const deck = await buildDeck(mode, filters, couple ? members(couple) : [user], providers, { taste: tasteFor(couple) });
  return { count: deck.length };
});

function sessionFor(user: User, sid: string): Session {
  const s = db.sessions[sid];
  if (!s || !s.memberIds.includes(user.id)) throw new HttpError(404, 'Session not found');
  return s;
}

route('POST', /^\/sessions\/([^/]+)\/vote$/, async ({ user, body, params }) => {
  const s = sessionFor(user, params[0]);
  const vote = body?.vote as Vote;
  if (!['like', 'pass', 'super'].includes(vote)) throw new HttpError(400, 'Bad vote');
  const note = typeof body?.note === 'string' ? body.note : undefined;
  if (applyVote(s, user.id, String(body?.optionId), vote, note).kind === 'matched') {
    touch(s);
    await runAutoBook(s, user);
  }
  touch(s);
  scheduleBot(s, s.memberIds.map((m) => db.users[m]));
  return stateFor(user);
});

route('POST', /^\/sessions\/([^/]+)\/book$/, async ({ user, body, params }) => {
  const s = sessionFor(user, params[0]);
  await doBook(s, user, body?.slotId);
  touch(s);
  return stateFor(user);
});

/** Handoff: "We booked it for 8:00" — you reserved outside the app. */
route('POST', /^\/sessions\/([^/]+)\/booked$/, ({ user, body, params }) => {
  const s = sessionFor(user, params[0]);
  if (!recordSelfBooking(s, user.id, String(body?.time ?? ''))) throw new HttpError(400, 'Pick the time you booked.');
  db.couples[s.coupleId]?.history.unshift(s.booking!);
  touch(s);
  return stateFor(user);
});

/** Handoff: no table available — drop it and keep swiping. */
route('POST', /^\/sessions\/([^/]+)\/no-table$/, ({ user, params }) => {
  const s = sessionFor(user, params[0]);
  noTable(s);
  touch(s);
  scheduleBot(s, s.memberIds.map((m) => db.users[m]));
  return stateFor(user);
});

route('POST', /^\/sessions\/([^/]+)\/accept$/, async ({ user, body, params }) => {
  const s = sessionFor(user, params[0]);
  if (!acceptNearMiss(s, user.id, String(body?.optionId))) throw new HttpError(400, "Your partner hasn't liked that one.");
  touch(s);
  await runAutoBook(s, user);
  touch(s);
  return stateFor(user);
});

route('POST', /^\/sessions\/([^/]+)\/fate$/, async ({ user, params }) => {
  const s = sessionFor(user, params[0]);
  letFateDecide(s);
  touch(s);
  await runAutoBook(s, user);
  touch(s);
  return stateFor(user);
});

route('POST', /^\/sessions\/([^/]+)\/widen$/, async ({ user, body, params }) => {
  const s = sessionFor(user, params[0]);
  if (s.status !== 'exhausted' && s.status !== 'swiping') return stateFor(user);
  const f = { ...s.filters };
  const kind = String(body?.kind);
  const pad = (n: number) => String(n).padStart(2, '0');
  if (kind === 'time') {
    const [sh, sm] = f.windowStart.split(':').map(Number);
    const [eh, em] = f.windowEnd.split(':').map(Number);
    f.windowStart = `${pad(Math.max(17, sh - 1))}:${pad(sm)}`;
    f.windowEnd = `${pad(Math.min(22, eh + 1))}:${pad(em)}`;
  } else if (kind === 'radius') f.radiusMi = Math.min(10, f.radiusMi + 1.5);
  else if (kind === 'cuisine') Object.assign(f, { cuisines: [], genres: [], prices: [], formats: [] });
  const bothPassed = new Set(s.deck.filter((o) => s.memberIds.every((m) => s.votes[m]?.[o.id] === 'pass')).map((o) => o.id));
  const couple = db.couples[s.coupleId];
  s.filters = f;
  s.deck = await buildDeck(s.mode, f, s.memberIds.map((m) => db.users[m]), providers, { exclude: bothPassed, taste: tasteFor(couple ?? null) });
  s.status = s.deck.length && !isExhausted(s) ? 'swiping' : 'exhausted';
  touch(s);
  scheduleBot(s, s.memberIds.map((m) => db.users[m]));
  return stateFor(user);
});

route('POST', /^\/sessions\/([^/]+)\/end$/, ({ user, params }) => {
  const s = sessionFor(user, params[0]);
  if (s.status !== 'booked') s.status = 'cancelled';
  const c = db.couples[s.coupleId];
  if (c?.activeSessionId === s.id) c.activeSessionId = null;
  touch(s);
  return stateFor(user);
});

/** Post-date review: verdict + where it ranks in your list (Beli) + details (Yelp). */
route('POST', /^\/ratings$/, ({ user, body }) => {
  const couple = coupleOf(user);
  const b = couple?.history.find((x) => x.confirmation === body?.confirmation);
  if (!couple || !b) throw new HttpError(404, 'Date not found');
  const verdict = body?.verdict as Verdict;
  if (!['loved', 'fine', 'meh'].includes(verdict)) throw new HttpError(400, 'Pick how it went');
  rateAs(user, couple, b, verdict, Number(body?.insertAt) || 0, body ?? {});

  // The demo partner rates too, so you can see couple scores and learning in action.
  const bot = members(couple).find((m) => m.isBot && !couple.ratings?.[b.confirmation]?.[m.id]);
  if (bot) {
    const r = rng(`${bot.id}|rate|${b.optionId}`);
    const roll = r();
    const v: Verdict = roll < 0.6 ? 'loved' : roll < 0.9 ? 'fine' : 'meh';
    const pick = b.option?.highlights[Math.floor(r() * (b.option?.highlights.length ?? 1))]?.name;
    rateAs(bot, couple, b, v, Math.floor(r() * (bucket(bot, b.option?.kind ?? 'dinner', v).length + 1)), { tags: v === 'loved' ? ['Would go back'] : [], bestItem: pick });
  }
  save();
  notify(couple.memberIds);
  return stateFor(user);
});

// ---------- dispatcher ----------
export async function handle(method: string, path: string, userId: string | null, body: unknown): Promise<{ status: number; body: unknown }> {
  const clean = path.split('?')[0];
  for (const [m, re, h, authed] of routes) {
    if (m !== method) continue;
    const match = clean.match(re);
    if (!match) continue;
    const user = userId ? db.users[userId] : undefined;
    if (authed && !user) return { status: 401, body: { error: 'Unknown user' } };
    try {
      return { status: 200, body: await h({ user: user!, body: body as never, params: match.slice(1) }) };
    } catch (e) {
      if (e instanceof HttpError) return { status: e.status, body: { error: e.message } };
      console.error(e);
      return { status: 500, body: { error: 'Something went wrong on our side.' } };
    }
  }
  return { status: 404, body: { error: 'Not found' } };
}

export const userExists = (uid: string) => !!db.users[uid];
