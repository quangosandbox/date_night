// Google Places API (New) discovery adapter: real restaurants, ratings, photos, reviews,
// opening hours and "takes reservations". Enabled when GOOGLE_PLACES_API_KEY is set (server
// only). Photos go through /api/places-photo so the key never reaches the browser.
//
// Google Maps Platform terms (summary — have a lawyer confirm before launch):
//   - Show "Google Maps" attribution wherever this data appears (the card does).
//   - Show photo author attributions and review author names with links (the card does).
//   - Don't store Places content long-term; only place IDs. Results here live in memory for
//     CACHE_MS to keep costs down, and saved bookings keep only the place reference + name.
import type { Area, Filters, Photo, Review } from '../../shared/types.ts';
import type { Period } from '../hours.ts';
import { milesBetween } from '../util.ts';
import type { Venue, VenueDiscovery } from './types.ts';

const PRICE: Record<string, number> = {
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

/** Google place types → the app's cuisine buckets (which drive filters and taste learning). */
const CUISINE_BY_TYPE: [string, string][] = [
  ['italian_restaurant', 'Italian'], ['pizza_restaurant', 'Italian'],
  ['japanese_restaurant', 'Japanese'], ['sushi_restaurant', 'Japanese'], ['ramen_restaurant', 'Japanese'],
  ['mexican_restaurant', 'Mexican'],
  ['french_restaurant', 'French'],
  ['thai_restaurant', 'Thai'],
  ['korean_restaurant', 'Korean'],
  ['indian_restaurant', 'Indian'],
  ['mediterranean_restaurant', 'Mediterranean'], ['greek_restaurant', 'Mediterranean'], ['middle_eastern_restaurant', 'Mediterranean'],
  ['lebanese_restaurant', 'Mediterranean'], ['turkish_restaurant', 'Mediterranean'],
  ['chinese_restaurant', 'Chinese'],
  ['american_restaurant', 'American'], ['steak_house', 'American'], ['hamburger_restaurant', 'American'], ['barbecue_restaurant', 'American'],
];

/** Google's boolean attributes → vibe tags shown on the card and used for learning. */
const TAGS: [keyof GPlace, string][] = [
  ['outdoorSeating', 'Outdoor seating'],
  ['servesCocktails', 'Cocktails'],
  ['servesWine', 'Wine'],
  ['liveMusic', 'Live music'],
  ['servesVegetarianFood', 'Veggie-friendly'],
];

const FIELDS = [
  'places.id', 'places.displayName', 'places.formattedAddress', 'places.shortFormattedAddress', 'places.location',
  'places.rating', 'places.userRatingCount', 'places.priceLevel', 'places.types', 'places.primaryTypeDisplayName',
  'places.photos', 'places.reviews', 'places.editorialSummary', 'places.websiteUri', 'places.googleMapsUri',
  'places.nationalPhoneNumber', 'places.regularOpeningHours', 'places.reservable', 'places.servesDinner',
  'places.outdoorSeating', 'places.servesCocktails', 'places.servesWine', 'places.liveMusic', 'places.servesVegetarianFood',
  'places.businessStatus', 'nextPageToken',
].join(',');

export interface GPlace {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  shortFormattedAddress?: string;
  location?: { latitude: number; longitude: number };
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  types?: string[];
  primaryTypeDisplayName?: { text: string };
  photos?: { name: string; authorAttributions?: { displayName: string; uri?: string }[] }[];
  reviews?: {
    rating: number;
    text?: { text: string };
    originalText?: { text: string };
    authorAttribution?: { displayName: string; uri?: string };
    relativePublishTimeDescription?: string;
  }[];
  editorialSummary?: { text: string };
  websiteUri?: string;
  googleMapsUri?: string;
  nationalPhoneNumber?: string;
  regularOpeningHours?: { periods?: Period[] };
  reservable?: boolean;
  servesDinner?: boolean;
  outdoorSeating?: boolean;
  servesCocktails?: boolean;
  servesWine?: boolean;
  liveMusic?: boolean;
  servesVegetarianFood?: boolean;
  businessStatus?: string;
}

export function cuisineOf(p: GPlace, queried?: string): string {
  for (const [type, cuisine] of CUISINE_BY_TYPE) if (p.types?.includes(type)) return cuisine;
  if (queried) return queried;
  return (p.primaryTypeDisplayName?.text ?? 'Restaurant').replace(/ Restaurant$/, '');
}

/** Map one Places API result to a Venue. Exported for tests. */
export function toVenue(p: GPlace, queried?: string): Venue {
  const photos: Photo[] = (p.photos ?? []).slice(0, 3).map((ph) => ({
    url: `/api/places-photo?name=${encodeURIComponent(ph.name)}`,
    source: 'Google',
    attribution: ph.authorAttributions?.[0]?.displayName,
    attributionUrl: ph.authorAttributions?.[0]?.uri,
  }));
  const reviewList: Review[] = (p.reviews ?? [])
    .map((r) => ({ r, text: r.text?.text ?? r.originalText?.text ?? '' }))
    .filter(({ text }) => text)
    .slice(0, 3)
    .map(({ r, text }) => ({
      author: r.authorAttribution?.displayName ?? 'Google user',
      authorUrl: r.authorAttribution?.uri,
      stars: r.rating,
      text: text.length > 240 ? `${text.slice(0, 237).trimEnd()}…` : text,
      when: r.relativePublishTimeDescription ?? '',
      source: 'Google',
    }));
  const cuisine = cuisineOf(p, queried);
  const rating = p.rating ?? 0;
  return {
    id: `g-${p.id}`,
    name: p.displayName?.text ?? 'Restaurant',
    cuisine,
    price: PRICE[p.priceLevel ?? ''] ?? 2,
    rating,
    reviews: p.userRatingCount ?? 0,
    lat: p.location?.latitude ?? 0,
    lng: p.location?.longitude ?? 0,
    address: p.shortFormattedAddress ?? (p.formattedAddress ?? '').split(',')[0],
    blurb: p.editorialSummary?.text ?? `${cuisine}, rated ${rating.toFixed(1)} by ${(p.userRatingCount ?? 0).toLocaleString('en-US')} people on Google.`,
    tags: TAGS.filter(([k]) => p[k] === true).map(([, t]) => t),
    refs: {},
    photos,
    reviewList,
    website: p.websiteUri,
    hours: p.regularOpeningHours?.periods,
    servesDinner: p.servesDinner,
    handoff: { mapsUrl: p.googleMapsUri, website: p.websiteUri, phone: p.nationalPhoneNumber, reservable: p.reservable },
    dataAttribution: 'Google Maps',
  };
}

const CACHE_MS = 10 * 60 * 1000;
const cache = new Map<string, { at: number; venues: Promise<Venue[]> }>();

export function googlePlaces(apiKey: string, fetchImpl: typeof fetch = fetch): VenueDiscovery {
  async function search(textQuery: string, area: Area, radiusMi: number, queried?: string): Promise<Venue[]> {
    const out: Venue[] = [];
    let pageToken: string | undefined;
    for (let page = 0; page < 2; page++) {
      const res = await fetchImpl('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': FIELDS },
        body: JSON.stringify({
          textQuery,
          includedType: 'restaurant',
          pageSize: 20,
          pageToken,
          locationBias: { circle: { center: { latitude: area.lat, longitude: area.lng }, radius: Math.min(50000, radiusMi * 1609) } },
        }),
      });
      if (!res.ok) throw new Error(`Google Places ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const data = (await res.json()) as { places?: GPlace[]; nextPageToken?: string };
      for (const p of data.places ?? []) if (p.location && p.businessStatus !== 'CLOSED_PERMANENTLY') out.push(toVenue(p, queried));
      pageToken = data.nextPageToken;
      if (!pageToken) break;
    }
    return out;
  }

  return {
    name: 'Google Places',
    async discover(area: Area, radiusMi: number, filters: Filters) {
      // One search per chosen cuisine (max 3), otherwise a general dinner search.
      const queries = filters.cuisines.length
        ? filters.cuisines.slice(0, 3).map((c) => ({ q: `${c} restaurants for dinner in ${area.name}, New York`, c }))
        : [{ q: `restaurants for dinner in ${area.name}, New York`, c: undefined }];
      const results = await Promise.all(
        queries.map(({ q, c }) => {
          const key = `${q}|${radiusMi}`;
          const hit = cache.get(key);
          if (hit && Date.now() - hit.at < CACHE_MS) return hit.venues;
          const venues = search(q, area, radiusMi, c);
          cache.set(key, { at: Date.now(), venues });
          venues.catch(() => cache.delete(key));
          return venues;
        }),
      );
      const seen = new Set<string>();
      return results
        .flat()
        .filter((v) => !seen.has(v.id) && seen.add(v.id))
        .filter((v) => milesBetween(area, v) <= radiusMi)
        .filter((v) => v.servesDinner !== false && v.handoff?.reservable !== false); // dinner + takes reservations
    },
  };
}

/** Resolve a Places photo name to a short-lived googleusercontent URL (no key exposed). */
export async function resolvePlacesPhoto(apiKey: string, name: string, fetchImpl: typeof fetch = fetch): Promise<string | null> {
  if (!/^places\/[^/]+\/photos\/[^/]+$/.test(name)) return null;
  const res = await fetchImpl(`https://places.googleapis.com/v1/${name}/media?maxWidthPx=900&skipHttpRedirect=true`, {
    headers: { 'X-Goog-Api-Key': apiKey },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { photoUri?: string };
  return data.photoUri ?? null;
}
