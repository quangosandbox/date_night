// Builds the swipe deck: discover → check availability → drop anything not bookable in
// the window → rank. Both partners get the same deck in the same order.
import type { Filters, Mode, Option, Slot, User } from '../shared/types.ts';
import { AREAS } from './providers/mockData.ts';
import type { Providers } from './providers/index.ts';
import { PROVIDER_LABELS } from './providers/index.ts';
import { milesBetween, toMinutes } from './util.ts';

export const DECK_SIZE = 30;

const CUISINE_ART: Record<string, { bg: string; fg: string; motif: string }> = {
  Italian: { bg: '#5B2A2A', fg: '#F6D3B8', motif: 'pasta' },
  Japanese: { bg: '#20343F', fg: '#F1E3CF', motif: 'wave' },
  Mexican: { bg: '#5A3A1C', fg: '#F8D27A', motif: 'sun' },
  French: { bg: '#2B2F4A', fg: '#E9DCC7', motif: 'wine' },
  Thai: { bg: '#2F4A34', fg: '#F2E1A0', motif: 'leaf' },
  Korean: { bg: '#4A2433', fg: '#F7C9B4', motif: 'flame' },
  Indian: { bg: '#5C3416', fg: '#FFD9A0', motif: 'sun' },
  Mediterranean: { bg: '#1F3E47', fg: '#EFE6D2', motif: 'wave' },
  American: { bg: '#3E2C24', fg: '#F2D4B6', motif: 'flame' },
  Chinese: { bg: '#4D1F1F', fg: '#F6CF8B', motif: 'lantern' },
};

const GENRE_ART: Record<string, { bg: string; fg: string; motif: string }> = {
  Drama: { bg: '#2D2440', fg: '#EADFF2', motif: 'moon' },
  Comedy: { bg: '#5A4310', fg: '#FFE7A3', motif: 'sun' },
  Thriller: { bg: '#1C2630', fg: '#D9E6EE', motif: 'eye' },
  Romance: { bg: '#5A2234', fg: '#FFD0DA', motif: 'heart' },
  'Sci-Fi': { bg: '#13303A', fg: '#BDEBF2', motif: 'orbit' },
  Horror: { bg: '#2A1414', fg: '#F0C2C2', motif: 'eye' },
  Animation: { bg: '#24404A', fg: '#FFE2B8', motif: 'star' },
  Documentary: { bg: '#33362A', fg: '#E8E6CF', motif: 'compass' },
};

export const inWindow = (time: string, f: Filters) => {
  const t = toMinutes(time);
  return t >= toMinutes(f.windowStart) && t <= toMinutes(f.windowEnd);
};

export const windowMid = (f: Filters) => (toMinutes(f.windowStart) + toMinutes(f.windowEnd)) / 2;

/** Best slot = closest to the middle of the window; ties → earlier. */
export function rankSlots(slots: Slot[], f: Filters): Slot[] {
  const mid = windowMid(f);
  return [...slots].sort((a, b) => {
    const da = Math.abs(toMinutes(a.time) - mid);
    const db = Math.abs(toMinutes(b.time) - mid);
    return da - db || toMinutes(a.time) - toMinutes(b.time);
  });
}

function proximityBoost(slots: Slot[], f: Filters) {
  if (!slots.length) return 0;
  const best = rankSlots(slots, f)[0];
  const d = Math.abs(toMinutes(best.time) - windowMid(f));
  return 0.3 * Math.max(0, 1 - d / 120);
}

const priceLabel = (p: number) => '$'.repeat(p);

export async function buildDeck(mode: Mode, filters: Filters, members: User[], p: Providers, exclude = new Set<string>()): Promise<Option[]> {
  const area = AREAS.find((a) => a.id === filters.area) ?? AREAS[0];
  const options = mode === 'dinner' ? await buildDinner(filters, area, p) : await buildMovies(filters, area, members, p);
  return options
    .filter((o) => o.slots.length > 0 && !exclude.has(o.id))
    .map((o) => ({ o, score: (o as Option & { _score: number })._score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, DECK_SIZE)
    .map(({ o }) => {
      const { _score, ...clean } = o as Option & { _score: number };
      return clean;
    });
}

async function buildDinner(f: Filters, area: (typeof AREAS)[number], p: Providers): Promise<Option[]> {
  const venues = (await p.discovery.discover(area, f.radiusMi, f)).filter(
    (v) => (!f.cuisines.length || f.cuisines.includes(v.cuisine)) && (!f.prices.length || f.prices.includes(v.price)),
  );

  return Promise.all(
    venues.map(async (v) => {
      // Query every reservation provider this venue is on, in parallel, and union the slots.
      const perProvider = await Promise.all(
        p.reservations.filter((r) => v.refs[r.id]).map((r) => r.availability(v.refs[r.id], v, f)),
      );
      const byTime = new Map<string, Slot>();
      for (const s of perProvider.flat()) if (inWindow(s.time, f) && !byTime.has(s.time)) byTime.set(s.time, s);
      const slots = [...byTime.values()].sort((a, b) => toMinutes(a.time) - toMinutes(b.time));

      const distanceMi = Math.round(milesBetween(area, v) * 10) / 10;
      const confidence = (v.rating * v.reviews + 4.2 * 300) / (v.reviews + 300);
      const option: Option & { _score: number } = {
        id: v.id,
        kind: 'dinner',
        title: v.name,
        subtitle: `${v.cuisine} · ${priceLabel(v.price)} · ${distanceMi} mi`,
        blurb: v.blurb,
        rating: v.rating,
        ratingSource: 'Google',
        tags: v.tags,
        providers: Object.keys(v.refs).map((k) => PROVIDER_LABELS[k] ?? k),
        address: v.address,
        distanceMi,
        art: CUISINE_ART[v.cuisine] ?? { bg: '#3A2E44', fg: '#F7F1EA', motif: 'star' },
        badges: [],
        slots,
        _score: confidence + proximityBoost(slots, f) - distanceMi * 0.05,
      };
      return option;
    }),
  );
}

async function buildMovies(f: Filters, area: (typeof AREAS)[number], members: User[], p: Providers): Promise<Option[]> {
  const [films, showtimes, ...watchlists] = await Promise.all([
    p.films.films(),
    p.showtimes.showtimes(area, f.radiusMi, f),
    ...members.map((m) => p.films.watchlist(m.letterboxd ?? '')),
  ]);
  const connected = members.filter((m) => m.letterboxd).length;

  return films
    .filter((film) => !f.genres.length || film.genres.some((g) => f.genres.includes(g)))
    .map((film) => {
      const slots = showtimes
        .filter((s) => s.filmId === film.id && inWindow(s.slot.time, f) && (!f.formats.length || f.formats.includes(s.format)))
        .map((s) => s.slot)
        .sort((a, b) => toMinutes(a.time) - toMinutes(b.time));
      const onLists = watchlists.filter((w) => w.includes(film.id)).length;
      const badges: string[] = [];
      if (onLists === 2) badges.push('On both your watchlists');
      else if (onLists === 1 && connected === 2) badges.push('On one of your watchlists');
      else if (onLists === 1) badges.push('On your watchlist');
      const hours = Math.floor(film.runtime / 60);
      const option: Option & { _score: number } = {
        id: film.id,
        kind: 'movie',
        title: film.title,
        subtitle: `${film.genres.join(' / ')} · ${hours}h ${film.runtime % 60}m · ${film.director}`,
        blurb: film.logline,
        rating: film.rating,
        ratingSource: 'Letterboxd',
        tags: [String(film.year)],
        providers: [...new Set(slots.map((s) => PROVIDER_LABELS[s.provider] ?? s.provider))],
        art: GENRE_ART[film.genres[0]] ?? { bg: '#3A2E44', fg: '#F7F1EA', motif: 'star' },
        badges,
        slots,
        _score: film.rating + onLists * 0.6 + proximityBoost(slots, f),
      };
      return option;
    });
}
