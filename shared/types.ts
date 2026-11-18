// Types shared by the API server and the web client.

export type Mode = 'dinner' | 'movie';
export type Vote = 'like' | 'pass' | 'super';
export type SessionStatus = 'swiping' | 'matched' | 'booked' | 'exhausted' | 'cancelled';

export interface User {
  id: string;
  name: string;
  phone: string;
  color: string;
  coupleId: string | null;
  letterboxd?: string;
  isBot?: boolean;
  /** Ranked best → worst; verdict buckets keep loved above fine above meh. */
  rankings?: { optionId: string; title: string; kind: Mode; verdict: Verdict; art: Option['art']; photo?: string }[];
}

export interface Couple {
  id: string;
  inviteCode: string;
  memberIds: string[];
}

export interface Filters {
  date: string; // YYYY-MM-DD (local to the venue)
  windowStart: string; // HH:mm
  windowEnd: string; // HH:mm
  partySize: number;
  area: string; // neighborhood id
  radiusMi: number;
  cuisines: string[]; // dinner — empty means any
  prices: number[]; // dinner — 1..4, empty means any
  genres: string[]; // movie — empty means any
  formats: string[]; // movie — empty means any
  autoBook: boolean;
}

export interface Slot {
  id: string;
  time: string; // HH:mm
  provider: string; // which provider holds this slot
  ref?: string; // provider-side venue/theater reference used to book
  label?: string; // e.g. "IMAX", "Bar seating"
}

export interface Review {
  author: string;
  stars: number;
  text: string;
  when: string;
  source: string; // "Google", "Letterboxd"
}

export interface Highlight {
  name: string;
  desc: string;
  price?: string;
  tag?: string;
}

export interface Link {
  label: string;
  url: string;
}

export interface Photo {
  url: string;
  source: string; // "Google", "Resy", "OpenTable", "Sample"
  attribution?: string;
}

export interface Option {
  id: string;
  kind: Mode;
  title: string;
  subtitle: string; // "Italian · $$$ · 0.4 mi"
  blurb: string;
  rating: number; // 0–5
  ratingSource: string; // "Google", "Letterboxd"
  tags: string[];
  providers: string[]; // ["resy", "opentable"]
  address?: string;
  distanceMi?: number;
  price?: number; // 1–4 (dinner)
  areaName: string; // the neighborhood you searched from
  reviews: Review[];
  highlights: Highlight[]; // menu items (dinner) or credits/vibe (movie)
  links: Link[];
  photos: Photo[]; // listing photos (Google / Resy / OpenTable); empty → generative art
  why?: string; // learned-taste reason, e.g. "Because you loved Baan Noi"
  art: { bg: string; fg: string; motif: string }; // generative card art
  badges: string[]; // "On both your watchlists"
  slots: Slot[];
}

export interface Booking {
  optionId: string;
  title: string;
  slot: Slot;
  provider: string;
  confirmation: string;
  bookedBy: string;
  bookedAt: string;
  deepLink?: string;
  partySize: number;
  date: string;
  address?: string;
  option?: Option; // snapshot for the post-date review
  demo?: boolean; // true when no real provider took the reservation
}

export type Verdict = 'loved' | 'fine' | 'meh';

/** A partner's post-date review (Beli-style verdict + ranking, Yelp-style details). */
export interface Rating {
  userId: string;
  verdict: Verdict;
  score: number; // 0–10, derived from where it sits in your ranked list
  tags: string[];
  bestItem?: string;
  note?: string;
  at: string;
}

export interface RankedEntry {
  optionId: string;
  title: string;
  kind: Mode;
  verdict: Verdict;
  score: number;
  art: Option['art'];
  photo?: string;
}

export interface OurPlace {
  confirmation: string;
  optionId: string;
  title: string;
  kind: Mode;
  date: string;
  art: Option['art'];
  photo?: string;
  mine?: Rating;
  partner?: Rating; // only revealed once you've rated too
  together?: number; // average of both scores
}

export interface Taste {
  into: string[];
  notInto: string[];
  ratedCount: number;
}

export interface NearMiss {
  option: Option;
  likedBy: 'me' | 'partner';
  super: boolean;
}

/** What the client gets about the active session. Partner votes are never exposed. */
export interface SessionView {
  id: string;
  mode: Mode;
  hostId: string;
  filters: Filters;
  status: SessionStatus;
  deck: Option[];
  myVotes: Record<string, Vote>;
  myProgress: number;
  partnerProgress: number;
  match: {
    option: Option;
    slot: Slot | null;
    superBy: string[];
    via: 'swipe' | 'fate' | 'nearMiss';
    /** What each of you hearted on the card (Hinge-style), revealed only on a match. */
    hearts: { userId: string; item: string }[];
  } | null;
  booking: Booking | null;
  bookingError: string | null;
  nearMisses: NearMiss[];
  createdAt: string;
}

export interface AppState {
  me: User;
  partner: User | null;
  couple: Couple | null;
  session: SessionView | null;
  history: Booking[];
  toRate: Booking[]; // dates you haven't reviewed yet
  ourList: OurPlace[]; // your rated dates, best first
  myRanking: RankedEntry[]; // your personal ranked list (for Beli-style comparisons)
  taste: Taste;
  localMode?: boolean; // running fully on-device (no server)
}

export interface Area {
  id: string;
  name: string;
  lat: number;
  lng: number;
}
