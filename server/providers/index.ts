// Provider registry. Swap a mock for a real adapter here once credentials/partnerships exist:
//   - Google Places API (New): public, needs GOOGLE_PLACES_API_KEY
//   - Resy: partner API only
//   - OpenTable: partner/affiliate API (or deep links as a fallback)
//   - Letterboxd: API by application; TMDB + CSV watchlist import as a fallback
//   - Showtimes/tickets: Fandango/Atom affiliate, MovieGlu or Gracenote
import { mockLetterboxd, mockOpenTable, mockPlaces, mockResy, mockShowtimes } from './mock.ts';
import type { FilmCatalog, ReservationProvider, ShowtimeProvider, VenueDiscovery } from './types.ts';

export interface Providers {
  discovery: VenueDiscovery;
  reservations: ReservationProvider[];
  films: FilmCatalog;
  showtimes: ShowtimeProvider;
}

export const providers: Providers = {
  discovery: mockPlaces,
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
