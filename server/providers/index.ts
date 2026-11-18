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
