// Ratings (Beli-style ranked lists) and the couple's learned taste profile.
// Pure functions: no I/O, easy to test.
import type { Mode, Option, Rating, Taste, User, Verdict, Vote } from '../shared/types.ts';

// ---------- Beli-style scores ----------
// Your list is ranked best → worst. "Loved" places score 6.7–10, "fine" 3.4–6.6, "meh" 0–3.3,
// spread by position inside the bucket — so scores shift as your list grows.
const BANDS: Record<Verdict, [number, number]> = { loved: [6.7, 10], fine: [3.4, 6.6], meh: [0, 3.3] };
const ORDER: Verdict[] = ['loved', 'fine', 'meh'];

export function scoreAt(verdict: Verdict, index: number, bucketSize: number): number {
  const [lo, hi] = BANDS[verdict];
  const t = (index + 0.5) / Math.max(1, bucketSize); // 0 → best
  return Math.round((hi - t * (hi - lo)) * 10) / 10;
}

type Ranked = NonNullable<User['rankings']>[number];

export function bucket(user: User, kind: Mode, verdict: Verdict): Ranked[] {
  return (user.rankings ?? []).filter((r) => r.kind === kind && r.verdict === verdict);
}

/** Score for every place in a user's list. */
export function userScores(user: User): Map<string, number> {
  const out = new Map<string, number>();
  for (const kind of ['dinner', 'movie'] as Mode[])
    for (const v of ORDER) {
      const b = bucket(user, kind, v);
      b.forEach((r, i) => out.set(r.optionId, scoreAt(v, i, b.length)));
    }
  return out;
}

/** Insert (or move) a place into a user's ranked list at a position within its verdict bucket. */
export function insertRanking(user: User, entry: Ranked, indexInBucket: number) {
  const list = (user.rankings ?? []).filter((r) => r.optionId !== entry.optionId);
  const same = list.filter((r) => r.kind === entry.kind && r.verdict === entry.verdict);
  const i = Math.max(0, Math.min(same.length, Math.floor(indexInBucket)));
  // Keep a global order of [kind][loved, fine, meh]; rebuild deterministically.
  same.splice(i, 0, entry);
  const rebuilt: Ranked[] = [];
  for (const kind of ['dinner', 'movie'] as Mode[])
    for (const v of ORDER) rebuilt.push(...(kind === entry.kind && v === entry.verdict ? same : list.filter((r) => r.kind === kind && r.verdict === v)));
  user.rankings = rebuilt;
}

// ---------- Taste learning ----------
export function featuresOf(o: Pick<Option, 'kind' | 'subtitle' | 'tags' | 'price'>): string[] {
  if (o.kind === 'movie') return o.subtitle.split(' · ')[0].split(' / ').map((g) => `genre:${g}`);
  const cuisine = o.subtitle.split(' · ')[0];
  return [`cuisine:${cuisine}`, ...(o.price ? [`price:${o.price}`] : []), ...o.tags.map((t) => `tag:${t}`)];
}

export const featureLabel = (f: string) => {
  const [k, v] = f.split(':');
  return k === 'price' ? '$'.repeat(Number(v)) : v;
};

export interface TasteModel {
  weights: Map<string, { w: number; from?: string; fromW: number }>;
  rated: Map<string, number>; // optionId → couple average score
  ratedCount: number;
}

export interface TasteInputs {
  /** Every swipe either partner made, with the option swiped on. */
  swipes: { option: Option; vote: Vote }[];
  /** Every rated date: the option and each partner's rating. */
  ratings: { option: Option; ratings: Rating[] }[];
}

const SWIPE_W: Record<Vote, number> = { like: 0.12, super: 0.25, pass: -0.06 };

export function learnTaste({ swipes, ratings }: TasteInputs): TasteModel {
  const weights: TasteModel['weights'] = new Map();
  const add = (f: string, w: number, from?: string) => {
    const cur = weights.get(f) ?? { w: 0, fromW: 0 };
    cur.w += w;
    if (from && w > cur.fromW) {
      cur.from = from;
      cur.fromW = w;
    }
    weights.set(f, cur);
  };

  // Implicit signal: what you swipe on.
  for (const { option, vote } of swipes) for (const f of featuresOf(option)) add(f, SWIPE_W[vote]);

  // Explicit signal: how the night actually went. Much stronger than a swipe.
  const rated = new Map<string, number>();
  for (const { option, ratings: rs } of ratings) {
    if (!rs.length) continue;
    const avg = rs.reduce((s, r) => s + r.score, 0) / rs.length;
    rated.set(option.id, Math.round(avg * 10) / 10);
    const w = (avg - 5) / 5; // −1 … +1
    for (const f of featuresOf(option)) add(f, w, avg >= 7 ? option.title : undefined);
  }
  return { weights, rated, ratedCount: ratings.filter((r) => r.ratings.length).length };
}

/** How much the couple's taste should move an option up or down the deck, and why. */
export function tasteBoost(o: Option, m: TasteModel): { boost: number; why?: string; exclude?: boolean; badge?: string } {
  const prior = m.rated.get(o.id);
  if (prior != null && prior < 3.4) return { boost: 0, exclude: true }; // "not for us" — never again
  let sum = 0;
  let best: { f: string; w: number; from?: string } | null = null;
  for (const f of featuresOf(o)) {
    const e = m.weights.get(f);
    if (!e) continue;
    sum += e.w;
    if (e.w > 0.2 && (!best || e.w > best.w)) best = { f, w: e.w, from: e.from };
  }
  let boost = 0.5 * Math.tanh(sum / 1.5);
  let badge: string | undefined;
  if (prior != null) {
    boost += prior >= 7 ? 0.25 : -0.2;
    badge = prior >= 7 ? `You rated it ${prior.toFixed(1)}` : undefined;
  }
  let why: string | undefined;
  if (best) {
    if (best.from && best.from !== o.title) why = `Because you loved ${best.from}`;
    else if (best.f.startsWith('cuisine:') || best.f.startsWith('genre:')) why = `You two keep picking ${featureLabel(best.f)}`;
    else if (best.f.startsWith('tag:')) why = `You're into ${featureLabel(best.f).toLowerCase()} spots`;
  }
  return { boost, why, badge };
}

export function summarizeTaste(m: TasteModel): Taste {
  const entries = [...m.weights].filter(([f]) => !f.startsWith('tag:') || Math.abs(m.weights.get(f)!.w) > 0.4);
  const into = entries.filter(([, e]) => e.w >= 0.3).sort((a, b) => b[1].w - a[1].w).slice(0, 4).map(([f]) => featureLabel(f));
  const notInto = entries.filter(([, e]) => e.w <= -0.3).sort((a, b) => a[1].w - b[1].w).slice(0, 3).map(([f]) => featureLabel(f));
  return { into, notInto, ratedCount: m.ratedCount };
}
