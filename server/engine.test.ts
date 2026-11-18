import { describe, expect, it } from 'vitest';
import type { Filters, Option, Slot } from '../shared/types.ts';
import { buildDeck, rankSlots } from './deck.ts';
import { acceptNearMiss, applyVote, bookMatch, fatePick, nearMisses, newSession, toView } from './engine.ts';
import { providers } from './providers/index.ts';

const filters: Filters = {
  date: '2026-11-18', windowStart: '19:00', windowEnd: '21:00', partySize: 2, area: 'west-village', radiusMi: 3,
  cuisines: [], prices: [], genres: [], formats: [], autoBook: true,
};

const slot = (time: string, provider = 'resy'): Slot => ({ id: `${provider}:${time}`, time, provider });
const opt = (id: string, slots: Slot[] = [slot('19:30'), slot('20:00'), slot('20:45')]): Option => ({
  id, kind: 'dinner', title: id, subtitle: '', blurb: '', rating: 4.5, ratingSource: 'Google', tags: [], providers: ['Resy'],
  art: { bg: '#000', fg: '#fff', motif: 'star' }, badges: [], slots, areaName: 'X', reviews: [], highlights: [], links: [], photos: [],
});

const session = (deck = [opt('a'), opt('b'), opt('c')]) =>
  newSession({ id: 's', coupleId: 'c', mode: 'dinner', hostId: 'u1', memberIds: ['u1', 'u2'], filters, deck, createdAt: '' });

describe('matching', () => {
  it('matches on the second yes, not the first', () => {
    const s = session();
    expect(applyVote(s, 'u1', 'b', 'like').kind).toBe('recorded');
    expect(s.status).toBe('swiping');
    expect(applyVote(s, 'u2', 'b', 'super')).toEqual({ kind: 'matched', optionId: 'b' });
    expect(s.status).toBe('matched');
    expect(s.match?.superBy).toEqual(['u2']);
  });

  it('does not match a like against a pass', () => {
    const s = session();
    applyVote(s, 'u1', 'a', 'like');
    expect(applyVote(s, 'u2', 'a', 'pass').kind).toBe('recorded');
  });

  it('ignores votes after a match (first match wins)', () => {
    const s = session();
    applyVote(s, 'u1', 'a', 'like');
    applyVote(s, 'u2', 'a', 'like');
    applyVote(s, 'u1', 'b', 'like');
    expect(applyVote(s, 'u2', 'b', 'like').kind).toBe('ignored');
    expect(s.match?.optionId).toBe('a');
  });

  it('ignores outsiders and unknown options', () => {
    const s = session();
    expect(applyVote(s, 'stranger', 'a', 'like').kind).toBe('ignored');
    expect(applyVote(s, 'u1', 'zzz', 'like').kind).toBe('ignored');
  });

  it('goes exhausted when both finish the deck without a match, with near misses', () => {
    const s = session();
    for (const [u, o, v] of [['u1', 'a', 'like'], ['u1', 'b', 'pass'], ['u1', 'c', 'super'], ['u2', 'a', 'pass'], ['u2', 'b', 'like'], ['u2', 'c', 'pass']] as const) {
      applyVote(s, u, o, v);
    }
    expect(s.status).toBe('exhausted');
    const nm = nearMisses(s, 'u1');
    expect(nm.map((n) => [n.option.id, n.likedBy, n.super])).toEqual([['c', 'me', true], ['a', 'me', false], ['b', 'partner', false]]);
    expect(acceptNearMiss(s, 'u1', 'a')).toBe(false); // partner didn't like 'a'
    expect(acceptNearMiss(s, 'u1', 'b')).toBe(true);
    expect(s.match).toMatchObject({ optionId: 'b', via: 'nearMiss' });
  });

  it('reveals hearted items only on a match', () => {
    const s = session();
    applyVote(s, 'u1', 'a', 'like', 'Cacio e pepe');
    expect(toView(s, 'u2').match).toBeNull();
    applyVote(s, 'u2', 'a', 'like');
    expect(toView(s, 'u2').match?.hearts).toEqual([{ userId: 'u1', item: 'Cacio e pepe' }]);
  });

  it('never exposes partner votes in the view', () => {
    const s = session();
    applyVote(s, 'u2', 'a', 'super');
    const v = toView(s, 'u1');
    expect(v.myVotes).toEqual({});
    expect(v.partnerProgress).toBe(1);
    expect(JSON.stringify(v)).not.toContain('super');
  });

  it('fate weighs super likes', () => {
    const s = session();
    applyVote(s, 'u1', 'a', 'like');
    applyVote(s, 'u2', 'c', 'super');
    expect(fatePick(s, () => 0)).toBe('a');
    expect(fatePick(s, () => 0.99)).toBe('c');
  });
});

describe('slots & booking', () => {
  it('prefers the slot closest to the middle of the window', () => {
    expect(rankSlots([slot('19:00'), slot('20:15'), slot('19:45')], filters).map((x) => x.time)).toEqual(['19:45', '20:15', '19:00']);
  });

  it('books the best slot', async () => {
    const s = session();
    applyVote(s, 'u1', 'a', 'like');
    applyVote(s, 'u2', 'a', 'like');
    const r = await bookMatch(s, async () => ({ ok: true, confirmation: 'X-1' }), { name: 'A', phone: '' }, 'u1');
    expect(r).toBe('booked');
    expect(s.booking?.slot.time).toBe('20:00');
    expect(await bookMatch(s, async () => ({ ok: true, confirmation: 'X-2' }), { name: 'A', phone: '' }, 'u1')).toBe('ignored');
  });

  it('falls back to the next slot when one vanishes', async () => {
    const s = session();
    applyVote(s, 'u1', 'a', 'like');
    applyVote(s, 'u2', 'a', 'like');
    const r = await bookMatch(s, async (sl) => (sl.time === '20:00' ? { ok: false, reason: 'slot_gone' } : { ok: true, confirmation: 'ok' }), { name: 'A', phone: '' }, 'u1');
    expect(r).toBe('booked');
    expect(s.booking?.slot.time).not.toBe('20:00');
  });

  it('drops the option and resumes swiping when nothing is left', async () => {
    const s = session();
    applyVote(s, 'u1', 'a', 'like');
    applyVote(s, 'u2', 'a', 'like');
    const r = await bookMatch(s, async () => ({ ok: false, reason: 'slot_gone' }), { name: 'A', phone: '' }, 'u1');
    expect(r).toBe('fell_through');
    expect(s.status).toBe('swiping');
    expect(s.deck.map((o) => o.id)).toEqual(['b', 'c']);
    expect(s.bookingError).toMatch(/filled up/);
  });
});

describe('deck builder (mock providers)', () => {
  const users = [
    { id: 'u1', name: 'A', phone: '', color: '', coupleId: 'c', letterboxd: 'alex' },
    { id: 'u2', name: 'B', phone: '', color: '', coupleId: 'c', letterboxd: 'sam' },
  ];

  it('only includes bookable restaurants inside the window and filters', async () => {
    const deck = await buildDeck('dinner', { ...filters, cuisines: ['Italian', 'Japanese'] }, users, providers);
    expect(deck.length).toBeGreaterThan(0);
    for (const o of deck) {
      expect(['Italian', 'Japanese'].some((c) => o.subtitle.startsWith(c))).toBe(true);
      expect(o.slots.length).toBeGreaterThan(0);
      for (const s of o.slots) expect(s.time >= '19:00' && s.time <= '21:00').toBe(true);
    }
  });

  it('is deterministic so both partners see the same deck', async () => {
    const a = await buildDeck('dinner', filters, users, providers);
    const b = await buildDeck('dinner', filters, users, providers);
    expect(a.map((o) => o.id)).toEqual(b.map((o) => o.id));
  });

  it('builds a movie deck with showtimes in the window', async () => {
    const deck = await buildDeck('movie', { ...filters, area: 'midtown', radiusMi: 6, windowStart: '18:00', windowEnd: '22:00' }, users, providers);
    expect(deck.length).toBeGreaterThan(0);
    expect(deck.every((o) => o.kind === 'movie' && o.slots.length > 0)).toBe(true);
  });
});
