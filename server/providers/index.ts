// Provider registry. Swap a mock for a real adapter here once credentials/partnerships exist:
//   - Google Places API (New): public, needs GOOGLE_PLACES_API_KEY
//   - Resy: partner API only
//   - OpenTable: partner/affiliate API (or deep links as a fallback)
//   - Letterboxd: API by application; TMDB + CSV watchlist import as a fallback
//   - Showtimes/tickets: Fandango/Atom affiliate, MovieGlu or Gracenote
import { mockLetterboxd, mockOpenTable, mockPlaces, mockResy, mockShowtimes } from './mock.ts';
import { googlePlaces } from './googlePlaces.ts';
import type { FilmCatalog, ReservationProvider, ShowtimeProvider, VenueDiscovery } from './types.ts';

export interface Providers {
  discovery: VenueDiscovery;
  reservations: ReservationProvider[];
  films: FilmCatalog;
  showtimes: ShowtimeProvider;
}

const env = typeof process !== 'undefined' ? process.env : ({} as Record<string, string | undefined>);
export const GOOGLE_KEY = env.GOOGLE_PLACES_API_KEY;

/**
 * How a match turns into a reservation.
 *  - 'handoff' (default): no booking partner yet — after a match you reserve on Google Maps /
 *    the restaurant's site / by phone, then tell the app the time.
 *  - 'auto': the demo reservation providers book instantly (for when Resy/OpenTable land).
 */
export const BOOKING_MODE: 'handoff' | 'auto' = env.BOOKING_MODE === 'auto' ? 'auto' : 'handoff';

/** Which date types are live. Dinner only for the beta; set DATE_NIGHT_MODES=dinner,movie to bring movies back. */
export const MODES = (env.DATE_NIGHT_MODES ?? 'dinner').split(',').filter((m) => m === 'dinner' || m === 'movie') as ('dinner' | 'movie')[];

export const providers: Providers = {
  // Real Google discovery (photos, ratings, reviews) when a key is configured; availability and
  // booking stay on the demo providers until the Resy/OpenTable partnerships are in place.
  discovery: GOOGLE_KEY ? googlePlaces(GOOGLE_KEY) : mockPlaces,
  reservations: [mockResy, mockOpenTable],
  films: mockLetterboxd,
  showtimes: mockShowtimes,
};

export const PROVIDER_LABELS: Record<string, string> = {
  resy: 'Resy',
  opentable: 'OpenTable',
  atom: 'Atom Tickets',
  fandango: 'Fandango',
};
