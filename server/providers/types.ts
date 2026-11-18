// Provider adapter contracts. Each external service (Google Places, Resy, OpenTable,
// Letterboxd, a showtime/ticketing provider) sits behind one of these so a real
// integration can replace a mock without touching session or matching logic.
import type { Area, Filters, Handoff, Photo, Review, Slot } from '../../shared/types.ts';
import type { Period } from '../hours.ts';

export interface Venue {
  id: string;
  name: string;
  cuisine: string;
  price: number;
  rating: number;
  reviews: number;
  lat: number;
  lng: number;
  address: string;
  blurb: string;
  tags: string[];
  /** Reservation-provider ids keyed by provider, e.g. { resy: '1234', opentable: '987' } */
  refs: Record<string, string>;
  photos?: Photo[];
  reviewList?: Review[]; // real reviews (Google), when available
  website?: string;
  /** Opening hours; when present the deck suggests times from them instead of live tables. */
  hours?: Period[];
  handoff?: Handoff;
  servesDinner?: boolean;
  dataAttribution?: string;
}

/** Discovery: who is out there (Google Places in production). */
export interface VenueDiscovery {
  name: string;
  discover(area: Area, radiusMi: number, filters: Filters): Promise<Venue[]>;
}

export interface BookingDetails {
  name: string;
  phone: string;
  partySize: number;
  date: string;
}

export type BookResult =
  | { ok: true; confirmation: string; deepLink?: string; demo?: boolean }
  | { ok: false; reason: 'slot_gone' | 'provider_error'; message?: string };

/** Reservations: Resy, OpenTable. */
export interface ReservationProvider {
  id: string; // 'resy' | 'opentable'
  label: string;
  availability(venueRef: string, venue: Venue, filters: Filters): Promise<Slot[]>;
  book(venueRef: string, slot: Slot, details: BookingDetails): Promise<BookResult>;
  /** Listing photos from the provider's venue page, when the API exposes them. */
  listingPhotos?(venueRef: string, venue: Venue): Promise<Photo[]>;
}

export interface Film {
  id: string;
  title: string;
  year: number;
  director: string;
  runtime: number;
  genres: string[];
  rating: number;
  logline: string;
}

/** Film metadata + taste signals (Letterboxd in production, TMDB as a fallback). */
export interface FilmCatalog {
  name: string;
  films(): Promise<Film[]>;
  /** Film ids on a member's watchlist. */
  watchlist(username: string): Promise<string[]>;
}

export interface Showtime {
  filmId: string;
  theaterId: string;
  theaterName: string;
  address: string;
  lat: number;
  lng: number;
  format: string;
  slot: Slot;
}

/** Showtimes + ticketing (Fandango/Atom/MovieGlu in production). */
export interface ShowtimeProvider {
  id: string;
  label: string;
  showtimes(area: Area, radiusMi: number, filters: Filters): Promise<Showtime[]>;
  book(slot: Slot, details: BookingDetails): Promise<BookResult>;
}
