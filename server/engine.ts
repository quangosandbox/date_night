// Pure session logic: votes, matching, exhaustion, near misses, fate, booking fallback.
// Kept free of I/O so it can be unit-tested directly.
import type { Booking, Filters, Mode, NearMiss, Option, SessionStatus, SessionView, Slot, Vote } from '../shared/types.ts';
import { rankSlots } from './deck.ts';
import type { BookResult, BookingDetails } from './providers/types.ts';

export interface Session {
  id: string;
  coupleId: string;
  mode: Mode;
  hostId: string;
  memberIds: string[];
  filters: Filters;
  status: SessionStatus;
  deck: Option[];
  votes: Record<string, Record<string, Vote>>;
  /** Hinge-style: the dish/review/detail a person hearted when they liked an option. */
  notes?: Record<string, Record<string, string>>;
  match: { optionId: string; via: 'swipe' | 'fate' | 'nearMiss'; superBy: string[] } | null;
  booking: Booking | null;
  bookingError: string | null;
  createdAt: string;
}

const isYes = (v?: Vote) => v === 'like' || v === 'super';

export function newSession(init: Omit<Session, 'status' | 'votes' | 'match' | 'booking' | 'bookingError'>): Session {
  return {
    ...init,
    status: init.deck.length ? 'swiping' : 'exhausted',
    votes: Object.fromEntries(init.memberIds.map((m) => [m, {}])),
    match: null,
    booking: null,
    bookingError: null,
  };
}

export type VoteOutcome = { kind: 'ignored' } | { kind: 'recorded' } | { kind: 'matched'; optionId: string } | { kind: 'exhausted' };

/** Record a vote. The second "yes" on the same option creates the match, atomically. */
export function applyVote(s: Session, userId: string, optionId: string, vote: Vote, note?: string): VoteOutcome {
  if (s.status !== 'swiping') return { kind: 'ignored' };
  if (!s.memberIds.includes(userId)) return { kind: 'ignored' };
  if (!s.deck.some((o) => o.id === optionId)) return { kind: 'ignored' };

  s.votes[userId] ??= {};
  s.votes[userId][optionId] = vote;
  s.notes ??= {};
  s.notes[userId] ??= {};
  if (note && vote !== 'pass') s.notes[userId][optionId] = note.slice(0, 80);
  else delete s.notes[userId][optionId];
  s.bookingError = null;

  if (isYes(vote)) {
    const partners = s.memberIds.filter((m) => m !== userId);
    if (partners.length && partners.every((p) => isYes(s.votes[p]?.[optionId]))) {
      setMatch(s, optionId, 'swipe');
      return { kind: 'matched', optionId };
    }
  }

  if (isExhausted(s)) {
    s.status = 'exhausted';
    return { kind: 'exhausted' };
  }
  return { kind: 'recorded' };
}

function setMatch(s: Session, optionId: string, via: 'swipe' | 'fate' | 'nearMiss') {
  s.status = 'matched';
  s.match = {
    optionId,
    via,
    superBy: s.memberIds.filter((m) => s.votes[m]?.[optionId] === 'super'),
  };
}

export function isExhausted(s: Session): boolean {
  return s.memberIds.length === 2 && s.memberIds.every((m) => s.deck.every((o) => s.votes[m]?.[o.id] !== undefined));
}

export function progress(s: Session, userId: string): number {
  return s.deck.filter((o) => s.votes[userId]?.[o.id] !== undefined).length;
}

/** Options exactly one of you said yes to. Super likes first, then by deck order. */
export function nearMisses(s: Session, me: string): NearMiss[] {
  const partner = s.memberIds.find((m) => m !== me);
  const out: NearMiss[] = [];
  for (const o of s.deck) {
    const mine = s.votes[me]?.[o.id];
    const theirs = partner ? s.votes[partner]?.[o.id] : undefined;
    if (isYes(mine) && !isYes(theirs)) out.push({ option: o, likedBy: 'me', super: mine === 'super' });
    else if (isYes(theirs) && !isYes(mine)) out.push({ option: o, likedBy: 'partner', super: theirs === 'super' });
  }
  return out.sort((a, b) => Number(b.super) - Number(a.super));
}

/** "I'm in" on something your partner liked turns it into a match. */
export function acceptNearMiss(s: Session, userId: string, optionId: string): boolean {
  if (s.status !== 'exhausted' && s.status !== 'swiping') return false;
  const partner = s.memberIds.find((m) => m !== userId);
  if (!partner || !isYes(s.votes[partner]?.[optionId])) return false;
  if (!s.deck.some((o) => o.id === optionId)) return false;
  s.votes[userId][optionId] = 'like';
  setMatch(s, optionId, 'nearMiss');
  return true;
}

/** Random pick among anything either of you liked; super likes weigh 3×. Falls back to the whole deck. */
export function fatePick(s: Session, rand: () => number = Math.random): string | null {
  const weights = new Map<string, number>();
  for (const o of s.deck) {
    let w = 0;
    for (const m of s.memberIds) {
      const v = s.votes[m]?.[o.id];
      if (v === 'super') w += 3;
      else if (v === 'like') w += 1;
    }
    if (w > 0) weights.set(o.id, w);
  }
  const pool = weights.size ? [...weights] : s.deck.map((o) => [o.id, 1] as [string, number]);
  if (!pool.length) return null;
  const total = pool.reduce((sum, [, w]) => sum + w, 0);
  let r = rand() * total;
  for (const [optId, w] of pool) {
    r -= w;
    if (r <= 0) return optId;
  }
  return pool[pool.length - 1][0];
}

export function letFateDecide(s: Session, rand?: () => number): string | null {
  if (s.status !== 'exhausted' && s.status !== 'swiping') return null;
  const pick = fatePick(s, rand);
  if (pick) setMatch(s, pick, 'fate');
  return pick;
}

export type Booker = (slot: Slot, details: BookingDetails) => Promise<BookResult>;

/**
 * Book the matched option. Tries the preferred slot (or the best one) first, then the rest
 * in preference order. If nothing is left, the option is dropped and swiping resumes.
 */
export async function bookMatch(
  s: Session,
  booker: Booker,
  details: Omit<BookingDetails, 'partySize' | 'date'>,
  bookedBy: string,
  preferredSlotId?: string,
): Promise<'booked' | 'fell_through' | 'ignored'> {
  if (s.status !== 'matched' || !s.match || s.booking) return 'ignored';
  const option = s.deck.find((o) => o.id === s.match!.optionId);
  if (!option) return 'ignored';

  const ranked = rankSlots(option.slots, s.filters);
  const preferred = ranked.find((x) => x.id === preferredSlotId);
  const order = preferred ? [preferred, ...ranked.filter((x) => x !== preferred)] : ranked;

  for (const slot of order) {
    const res = await booker(slot, { ...details, partySize: s.filters.partySize, date: s.filters.date });
    if (res.ok) {
      s.status = 'booked';
      s.bookingError = null;
      s.booking = {
        optionId: option.id,
        title: option.title,
        slot,
        provider: slot.provider,
        confirmation: res.confirmation,
        deepLink: res.deepLink,
        bookedBy,
        bookedAt: new Date().toISOString(),
        partySize: s.filters.partySize,
        date: s.filters.date,
        address: option.address,
        option: snapshot(option),
        demo: res.demo,
      };
      return 'booked';
    }
    // slot_gone → try the next one; provider errors also fall through to the next slot.
    option.slots = option.slots.filter((x) => x.id !== slot.id);
  }

  // Nothing bookable left: remove it and keep swiping.
  s.deck = s.deck.filter((o) => o.id !== option.id);
  s.match = null;
  s.bookingError = `${option.title} just filled up. Keep swiping — we dropped it from the deck.`;
  s.status = s.deck.length === 0 || isExhausted(s) ? 'exhausted' : 'swiping';
  return 'fell_through';
}

/** Strip provider content we shouldn't keep long-term (Google terms) from a saved booking. */
function snapshot(option: Option): Option {
  if (!option.dataAttribution) return option;
  return { ...option, reviews: [], blurb: '', highlights: [] };
}

/** Handoff flow: you reserved it yourself (Google Maps / website / phone) and tell us the time. */
export function recordSelfBooking(s: Session, userId: string, time: string, now = new Date()): boolean {
  if (s.status !== 'matched' || !s.match || s.booking) return false;
  const option = s.deck.find((o) => o.id === s.match!.optionId);
  if (!option || !/^\d{2}:\d{2}$/.test(time)) return false;
  s.status = 'booked';
  s.bookingError = null;
  s.booking = {
    optionId: option.id,
    title: option.title,
    slot: { id: `self:${option.id}:${s.filters.date}:${time}`, time, provider: 'handoff' },
    provider: 'handoff',
    confirmation: `DN-${now.getTime().toString(36).toUpperCase().slice(-6)}`,
    bookedBy: userId,
    bookedAt: now.toISOString(),
    partySize: s.filters.partySize,
    date: s.filters.date,
    address: option.address,
    option: snapshot(option),
    selfReported: true,
  };
  return true;
}

/** Handoff flow: no table to be had. Drop it and keep swiping. */
export function noTable(s: Session): boolean {
  if (s.status !== 'matched' || !s.match) return false;
  const option = s.deck.find((o) => o.id === s.match!.optionId);
  s.deck = s.deck.filter((o) => o.id !== s.match!.optionId);
  s.match = null;
  s.bookingError = `No table at ${option?.title ?? 'that one'}. Keep swiping — it's out of the deck.`;
  s.status = s.deck.length === 0 || isExhausted(s) ? 'exhausted' : 'swiping';
  return true;
}

export function toView(s: Session, me: string): SessionView {
  const partner = s.memberIds.find((m) => m !== me);
  const option = s.match ? s.deck.find((o) => o.id === s.match!.optionId) : undefined;
  return {
    id: s.id,
    mode: s.mode,
    hostId: s.hostId,
    filters: s.filters,
    status: s.status,
    deck: s.deck,
    myVotes: s.votes[me] ?? {},
    myProgress: progress(s, me),
    partnerProgress: partner ? progress(s, partner) : 0,
    match:
      s.match && option
        ? {
            option,
            slot: s.booking?.slot ?? rankSlots(option.slots, s.filters)[0] ?? null,
            superBy: s.match.superBy,
            via: s.match.via,
            hearts: s.memberIds
              .map((m) => ({ userId: m, item: s.notes?.[m]?.[option.id] ?? '' }))
              .filter((h) => h.item),
          }
        : null,
    booking: s.booking,
    bookingError: s.bookingError,
    nearMisses: s.status === 'exhausted' ? nearMisses(s, me) : [],
    createdAt: s.createdAt,
  };
}
