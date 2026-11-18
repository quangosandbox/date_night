import { describe, expect, it } from 'vitest';
import type { Option, User } from '../shared/types.ts';
import { handle } from './core.ts';
import { featuresOf, insertRanking, learnTaste, scoreAt, tasteBoost, userScores } from './taste.ts';

const opt = (id: string, cuisine: string, price = 2, tags: string[] = []): Option => ({
  id, kind: 'dinner', title: id, subtitle: `${cuisine} · ${'$'.repeat(price)} · 1 mi`, blurb: '', rating: 4.5, ratingSource: 'Google',
  tags, providers: [], art: { bg: '', fg: '', motif: '' }, badges: [], slots: [], areaName: 'X', reviews: [], highlights: [], links: [], photos: [], price,
});

describe('Beli-style ranking', () => {
  it('scores by verdict band and position', () => {
    expect(scoreAt('loved', 0, 1)).toBeGreaterThan(8);
    expect(scoreAt('loved', 0, 3)).toBeGreaterThan(scoreAt('loved', 2, 3));
    expect(scoreAt('loved', 2, 3)).toBeGreaterThan(scoreAt('fine', 0, 3));
    expect(scoreAt('meh', 0, 1)).toBeLessThan(3.4);
  });

  it('inserts within a bucket and re-rating moves the entry', () => {
    const u = { id: 'u', name: '', phone: '', color: '', coupleId: null } as User;
    const e = (id: string, verdict: 'loved' | 'fine' | 'meh') => ({ optionId: id, title: id, kind: 'dinner' as const, verdict, art: { bg: '', fg: '', motif: '' } });
    insertRanking(u, e('a', 'loved'), 0);
    insertRanking(u, e('b', 'fine'), 0);
    insertRanking(u, e('c', 'loved'), 0); // c better than a
    expect(u.rankings!.map((r) => r.optionId)).toEqual(['c', 'a', 'b']);
    insertRanking(u, e('c', 'meh'), 0);
    expect(u.rankings!.map((r) => r.optionId)).toEqual(['a', 'b', 'c']);
    const s = userScores(u);
    expect(s.get('a')!).toBeGreaterThan(s.get('b')!);
  });
});

describe('taste learning', () => {
  it('a loved Thai dinner boosts Thai and explains why', () => {
    const m = learnTaste({ swipes: [], ratings: [{ option: opt('Baan Noi', 'Thai'), ratings: [{ userId: 'a', verdict: 'loved', score: 9, tags: [], at: '' }] }] });
    const t = tasteBoost(opt('Kru', 'Thai'), m);
    expect(t.boost).toBeGreaterThan(0);
    expect(t.why).toBe('Because you loved Baan Noi');
    expect(tasteBoost(opt('Nonna', 'Italian', 4), m).boost).toBe(0);
  });

  it('never shows a place you both said was not for you', () => {
    const m = learnTaste({ swipes: [], ratings: [{ option: opt('x', 'French'), ratings: [{ userId: 'a', verdict: 'meh', score: 2, tags: [], at: '' }] }] });
    expect(tasteBoost(opt('x', 'French'), m).exclude).toBe(true);
    expect(tasteBoost(opt('y', 'French'), m).boost).toBeLessThan(0);
  });

  it('swipes are a weak implicit signal', () => {
    const m = learnTaste({ swipes: Array.from({ length: 5 }, () => ({ option: opt('k', 'Korean'), vote: 'like' as const })), ratings: [] });
    expect(m.weights.get('cuisine:Korean')!.w).toBeCloseTo(0.6);
    expect(featuresOf(opt('k', 'Korean', 3, ['Cozy']))).toEqual(['cuisine:Korean', 'price:3', 'tag:Cozy']);
  });
});

describe('API flow (in-process core)', () => {
  it('pairs, matches, books, rates, and learns', async () => {
    const call = async (method: string, path: string, uid: string | null, body?: unknown) => {
      const r = await handle(method, path, uid, body);
      if (r.status !== 200) throw new Error(`${path}: ${JSON.stringify(r.body)}`);
      return r.body as any;
    };
    const a = (await call('POST', '/users', null, { name: 'Alex' })).me.id;
    let st = await call('POST', '/couple/local-partner', a, { name: 'Sam' });
    const b = st.partner.id;
    st = await call('POST', '/sessions', a, { mode: 'dinner', filters: { area: 'west-village', radiusMi: 4, date: '2026-11-20' } });
    const first = st.session.deck[0];
    expect(first.photos.length).toBeGreaterThan(0);
    await call('POST', `/sessions/${st.session.id}/vote`, a, { optionId: first.id, vote: 'like', note: first.highlights[0].name });
    st = await call('POST', `/sessions/${st.session.id}/vote`, b, { optionId: first.id, vote: 'super' });
    expect(st.session.status).toBe('booked');
    expect(st.session.match.hearts[0].item).toBe(first.highlights[0].name);
    expect(st.toRate).toHaveLength(1);

    const conf = st.toRate[0].confirmation;
    st = await call('POST', '/ratings', a, { confirmation: conf, verdict: 'loved', insertAt: 0, tags: ['Romantic'], bestItem: first.highlights[0].name });
    expect(st.toRate).toHaveLength(0);
    expect(st.ourList[0].mine.score).toBeGreaterThan(8);
    expect(st.ourList[0].partner).toBeUndefined(); // Sam hasn't rated yet
    st = await call('POST', '/ratings', b, { confirmation: conf, verdict: 'loved', insertAt: 0 });
    expect(st.ourList[0].partner.score).toBeGreaterThan(8);
    expect(st.taste.into.length).toBeGreaterThan(0);

    // Next session: the learned taste shows up on the cards.
    await call('POST', `/sessions/${st.session.id}/end`, a);
    st = await call('POST', '/sessions', a, { mode: 'dinner', filters: { area: 'west-village', radiusMi: 4, date: '2026-11-21' } });
    expect(st.session.deck.some((o: Option) => o.why || o.badges.some((x) => x.startsWith('You rated')))).toBe(true);
  });
});
