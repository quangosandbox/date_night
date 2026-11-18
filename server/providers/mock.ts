// Mock adapters that behave like the real services: deterministic availability per
// venue/date, slots that disappear once booked, and confirmation codes.
import type { Area, Filters, Slot } from '../../shared/types.ts';
import { fromMinutes, hash, milesBetween, rng } from '../util.ts';
import { AREAS, FILMS, THEATERS, VENUES } from './mockData.ts';
import type {
  BookResult,
  BookingDetails,
  Film,
  FilmCatalog,
  ReservationProvider,
  Showtime,
  ShowtimeProvider,
  Venue,
  VenueDiscovery,
} from './types.ts';

const EVENING_START = 17 * 60;
const EVENING_END = 23 * 60;

/** Slots that have been booked (or "sniped" by other diners) during this process' life. */
const taken = new Set<string>();
export const _mockTaken = taken; // exposed for tests

function locate(areaId: string, seed: string) {
  const area = AREAS.find((a) => a.id === areaId) ?? AREAS[0];
  const r = rng(seed);
  return { lat: area.lat + (r() - 0.5) * 0.012, lng: area.lng + (r() - 0.5) * 0.014 };
}

const confirmation = (prefix: string, key: string) =>
  `${prefix}-${String(hash(key + Date.now()) % 100000).padStart(5, '0')}`;

export const mockPlaces: VenueDiscovery = {
  name: 'Google Places (mock)',
  async discover(area: Area, radiusMi: number) {
    return VENUES.map((v): Venue => {
      const pos = locate(v.area, v.id);
      return {
        id: v.id,
        name: v.name,
        cuisine: v.cuisine,
        price: v.price,
        rating: v.rating,
        reviews: v.reviews,
        ...pos,
        address: v.street,
        blurb: v.blurb,
        tags: v.tags,
        refs: Object.fromEntries(v.providers.map((p) => [p, `${p}-${v.id}`])),
      };
    }).filter((v) => milesBetween(area, v) <= radiusMi);
  },
};

function mockReservations(id: string, label: string, prefix: string, density: number): ReservationProvider {
  return {
    id,
    label,
    async availability(venueRef: string, venue: Venue, filters: Filters) {
      const r = rng(`${id}|${venueRef}|${filters.date}|${filters.partySize}`);
      // Hotter spots have fewer open tables.
      const scarcity = Math.max(0.15, density - (venue.rating - 4.2) * 0.35);
      const slots: Slot[] = [];
      for (let m = EVENING_START; m <= EVENING_END - 60; m += 15) {
        if (r() < scarcity) {
          const time = fromMinutes(m);
          const slotId = `${id}:${venue.id}:${filters.date}:${time}`;
          if (!taken.has(slotId)) {
            slots.push({ id: slotId, time, provider: id, ref: venueRef, label: r() < 0.2 ? 'Bar seating' : undefined });
          }
        }
      }
      return slots;
    },
    async book(_venueRef: string, slot: Slot, _details: BookingDetails): Promise<BookResult> {
      if (taken.has(slot.id)) return { ok: false, reason: 'slot_gone' };
      taken.add(slot.id);
      return { ok: true, confirmation: confirmation(prefix, slot.id) };
    },
  };
}

export const mockResy = mockReservations('resy', 'Resy', 'RZ', 0.32);
export const mockOpenTable = mockReservations('opentable', 'OpenTable', 'OT', 0.38);

export const mockLetterboxd: FilmCatalog = {
  name: 'Letterboxd (mock)',
  async films(): Promise<Film[]> {
    return FILMS;
  },
  async watchlist(username: string) {
    if (!username) return [];
    const r = rng(`watchlist|${username.toLowerCase()}`);
    return FILMS.filter(() => r() < 0.35).map((f) => f.id);
  },
};

export const mockShowtimes: ShowtimeProvider = {
  id: 'showtimes',
  label: 'Atom / Fandango',
  async showtimes(area: Area, radiusMi: number, filters: Filters) {
    const out: Showtime[] = [];
    for (const t of THEATERS) {
      const pos = locate(t.area, t.id);
      if (milesBetween(area, pos) > radiusMi) continue;
      for (const film of FILMS) {
        const r = rng(`${t.id}|${film.id}|${filters.date}`);
        if (r() < 0.45) continue; // this theater isn't playing it
        const format = t.formats[Math.floor(r() * t.formats.length)];
        let m = EVENING_START + Math.floor(r() * 6) * 15;
        while (m <= EVENING_END - 30) {
          const time = fromMinutes(m);
          const slotId = `${t.provider}:${t.id}:${film.id}:${filters.date}:${time}`;
          if (!taken.has(slotId)) {
            out.push({
              filmId: film.id,
              theaterId: t.id,
              theaterName: t.name,
              address: t.street,
              ...pos,
              format,
              slot: { id: slotId, time, provider: t.provider, label: `${t.name} · ${format}` },
            });
          }
          m += film.runtime + 30 + Math.floor(r() * 3) * 15;
          m = Math.ceil(m / 15) * 15;
        }
      }
    }
    return out;
  },
  async book(slot: Slot): Promise<BookResult> {
    if (taken.has(slot.id)) return { ok: false, reason: 'slot_gone' };
    taken.add(slot.id);
    return {
      ok: true,
      confirmation: confirmation(slot.provider === 'atom' ? 'AT' : 'FD', slot.id),
      deepLink: undefined,
    };
  },
};
