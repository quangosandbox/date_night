// Builds the swipe deck: discover → check availability → drop anything not bookable in
// the window → rank. Both partners get the same deck in the same order.
import type { Filters, Mode, Option, Slot, User } from '../shared/types.ts';
import { AREAS } from './providers/mockData.ts';
import type { Providers } from './providers/index.ts';
import { BOOKING_MODE, PROVIDER_LABELS } from './providers/index.ts';
import { slotsFromHours } from './hours.ts';
import { filmContent, venueContent } from './providers/mockContent.ts';
import { tasteBoost, type TasteModel } from './taste.ts';
import { milesBetween, toMinutes } from './util.ts';

export const DECK_SIZE = 30;

// Card art palettes, taken from the app's plate-on-peach palette.
const INK = '#1A1414';
const CREAM = '#FFF7EE';
const CUISINE_ART: Record<string, { bg: string; fg: string; motif: string }> = {
  Italian: { bg: '#E8473F', fg: INK, motif: 'pasta' },
  Japanese: { bg: INK, fg: '#EC9177', motif: 'wave' },
  Mexican: { bg: '#F0C53E', fg: INK, motif: 'sun' },
  French: { bg: '#EC9177', fg: INK, motif: 'wine' },
  Thai: { bg: '#9DAF6E', fg: INK, motif: 'leaf' },
  Korean: { bg: '#EB6B3A', fg: INK, motif: 'flame' },
  Indian: { bg: '#F0C53E', fg: INK, motif: 'sun' },
  Mediterranean: { bg: '#9DAF6E', fg: INK, motif: 'wave' },
  American: { bg: '#EB6B3A', fg: INK, motif: 'flame' },
  Chinese: { bg: INK, fg: '#E8473F', motif: 'lantern' },
};

const GENRE_ART: Record<string, { bg: string; fg: string; motif: string }> = {
  Drama: { bg: INK, fg: CREAM, motif: 'moon' },
  Comedy: { bg: '#F0C53E', fg: INK, motif: 'sun' },
  Thriller: { bg: INK, fg: '#E8473F', motif: 'eye' },
  Romance: { bg: '#EC9177', fg: INK, motif: 'heart' },
  'Sci-Fi': { bg: '#9DAF6E', fg: INK, motif: 'orbit' },
  Horror: { bg: '#E8473F', fg: INK, motif: 'eye' },
  Animation: { bg: '#EB6B3A', fg: INK, motif: 'star' },
  Documentary: { bg: '#EEE0CA', fg: INK, motif: 'compass' },
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

export interface DeckOptions {
  exclude?: Set<string>;
  taste?: TasteModel;
}

export async function buildDeck(mode: Mode, filters: Filters, members: User[], p: Providers, opts: DeckOptions = {}): Promise<Option[]> {
  // Geofence centre: a specific address/location when given, else the neighborhood.
  const area = filters.origin
    ? { id: 'origin', name: filters.origin.label, lat: filters.origin.lat, lng: filters.origin.lng }
    : AREAS.find((a) => a.id === filters.area) ?? AREAS[0];
  const exclude = opts.exclude ?? new Set<string>();
  const options = mode === 'dinner' ? await buildDinner(filters, area, p) : await buildMovies(filters, area, members, p);
  return options
    .filter((o) => o.slots.length > 0 && !exclude.has(o.id))
    .flatMap((o) => {
      // Learned taste nudges the order and explains itself on the card.
      let score = (o as Option & { _score: number })._score;
      if (opts.taste) {
        const t = tasteBoost(o, opts.taste);
        if (t.exclude) return [];
        score += t.boost;
        if (t.why) o.why = t.why;
        if (t.badge) o.badges = [t.badge, ...o.badges];
      }
      return [{ o, score }];
    })
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
      let slots: Slot[];
      if (v.hours) {
        // Google data: suggested times from opening hours (open for a full dinner in the window).
        slots = slotsFromHours(v.id, v.hours, f);
      } else {
        // Demo data: query every reservation provider this venue is on and union the slots.
        const perProvider = await Promise.all(
          p.reservations.filter((r) => v.refs[r.id]).map((r) => r.availability(v.refs[r.id], v, f)),
        );
        const byTime = new Map<string, Slot>();
        for (const s of perProvider.flat()) if (inWindow(s.time, f) && !byTime.has(s.time)) byTime.set(s.time, s);
        slots = [...byTime.values()].sort((a, b) => toMinutes(a.time) - toMinutes(b.time));
        if (BOOKING_MODE === 'handoff') slots = slots.map((s) => ({ ...s, provider: 'handoff', ref: undefined }));
      }

      const distanceMi = Math.round(milesBetween(area, v) * 10) / 10;
      const real = Boolean(v.dataAttribution);
      // Listing photos: Google first, then any the reservation providers return.
      const listing = real ? [] : await Promise.all(p.reservations.filter((r) => v.refs[r.id] && r.listingPhotos).map((r) => r.listingPhotos!(v.refs[r.id], v)));
      const photos = [...(v.photos ?? []), ...listing.flat()];
      // Real places have no menu data (Google doesn't expose menus), so only demo venues get "order this".
      const content = real ? { highlights: [], reviews: v.reviewList ?? [], links: [] as { label: string; url: string }[] } : venueContent(v);
      if (v.reviewList?.length) content.reviews = v.reviewList;
      const mapsUrl = v.handoff?.mapsUrl ?? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${v.name} ${v.address} New York`)}`;
      const handoff = BOOKING_MODE === 'handoff' ? { ...v.handoff, mapsUrl } : undefined;
      if (real) content.links = [{ label: 'Google Maps', url: mapsUrl }, ...(v.website ? [{ label: 'Website', url: v.website }] : [])];
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
        providers: BOOKING_MODE === 'handoff' ? [] : Object.keys(v.refs).map((k) => PROVIDER_LABELS[k] ?? k),
        handoff,
        dataAttribution: v.dataAttribution,
        address: v.address,
        distanceMi,
        price: v.price,
        areaName: area.name,
        ...content,
        photos,
        art: CUISINE_ART[v.cuisine] ?? { bg: '#3A2E44', fg: '#F7F1EA', motif: 'star' },
        badges: [],
        slots,
        _score: confidence + proximityBoost(slots, f) - distanceMi * 0.05 + (v.handoff?.reservable ? 0.1 : 0),
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
      const nearest = showtimes
        .filter((s) => s.filmId === film.id && slots.some((x) => x.id === s.slot.id))
        .map((s) => ({ s, d: milesBetween(area, s) }))
        .sort((a, b) => a.d - b.d)[0];
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
        areaName: area.name,
        address: nearest ? `${nearest.s.theaterName} · ${nearest.s.address}` : undefined,
        distanceMi: nearest ? Math.round(nearest.d * 10) / 10 : undefined,
        ...filmContent(film),
        photos: [],
        art: GENRE_ART[film.genres[0]] ?? { bg: '#3A2E44', fg: '#F7F1EA', motif: 'star' },
        badges,
        slots,
        _score: film.rating + onLists * 0.6 + proximityBoost(slots, f),
      };
      return option;
    });
}
