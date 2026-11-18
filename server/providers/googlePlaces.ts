// Real Google Places API (New) discovery adapter: restaurants, ratings, photos, reviews.
// Enabled when GOOGLE_PLACES_API_KEY is set (server mode only). Photos are served through
// /api/places-photo so the key never reaches the browser.
import type { Area, Filters, Photo, Review } from '../../shared/types.ts';
import { milesBetween } from '../util.ts';
import type { Venue, VenueDiscovery } from './types.ts';

const PRICE: Record<string, number> = {
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

const FIELDS = [
  'places.id', 'places.displayName', 'places.formattedAddress', 'places.location', 'places.rating',
  'places.userRatingCount', 'places.priceLevel', 'places.primaryTypeDisplayName', 'places.photos',
  'places.reviews', 'places.editorialSummary', 'places.websiteUri',
].join(',');

interface GPlace {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  primaryTypeDisplayName?: { text: string };
  photos?: { name: string; authorAttributions?: { displayName: string }[] }[];
  reviews?: { rating: number; text?: { text: string }; authorAttribution?: { displayName: string }; relativePublishTimeDescription?: string }[];
  editorialSummary?: { text: string };
  websiteUri?: string;
}

export function googlePlaces(apiKey: string): VenueDiscovery {
  return {
    name: 'Google Places',
    async discover(area: Area, radiusMi: number, filters: Filters) {
      const what = filters.cuisines.length === 1 ? `${filters.cuisines[0]} restaurants` : 'restaurants';
      const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': FIELDS },
        body: JSON.stringify({
          textQuery: `${what} in ${area.name}, New York`,
          maxResultCount: 20,
          locationBias: { circle: { center: { latitude: area.lat, longitude: area.lng }, radius: Math.min(50000, radiusMi * 1609) } },
        }),
      });
      if (!res.ok) throw new Error(`Google Places ${res.status}`);
      const data = (await res.json()) as { places?: GPlace[] };
      return (data.places ?? [])
        .filter((p) => p.location && p.displayName)
        .map((p): Venue => {
          const lat = p.location!.latitude;
          const lng = p.location!.longitude;
          const photos: Photo[] = (p.photos ?? []).slice(0, 3).map((ph) => ({
            url: `/api/places-photo?name=${encodeURIComponent(ph.name)}`,
            source: 'Google',
            attribution: ph.authorAttributions?.[0]?.displayName,
          }));
          const reviewList: Review[] = (p.reviews ?? []).filter((r) => r.text?.text).slice(0, 3).map((r) => ({
            author: r.authorAttribution?.displayName ?? 'Google user',
            stars: r.rating,
            text: r.text!.text.length > 220 ? `${r.text!.text.slice(0, 217)}…` : r.text!.text,
            when: r.relativePublishTimeDescription ?? '',
            source: 'Google',
          }));
          return {
            id: `g-${p.id}`,
            name: p.displayName!.text,
            cuisine: (p.primaryTypeDisplayName?.text ?? 'Restaurant').replace(/ Restaurant$/, ''),
            price: PRICE[p.priceLevel ?? ''] ?? 2,
            rating: p.rating ?? 0,
            reviews: p.userRatingCount ?? 0,
            lat,
            lng,
            address: (p.formattedAddress ?? '').split(',')[0],
            blurb: p.editorialSummary?.text ?? '',
            tags: [],
            // No Resy/OpenTable partnership yet: demo availability stands in (see providers/index.ts).
            refs: { opentable: `g-${p.id}` },
            photos,
            reviewList,
            website: p.websiteUri,
          };
        })
        .filter((v) => milesBetween(area, v) <= radiusMi);
    },
  };
}

/** Resolve a Places photo name to a short-lived googleusercontent URL (no key exposed). */
export async function resolvePlacesPhoto(apiKey: string, name: string): Promise<string | null> {
  if (!/^places\/[^/]+\/photos\/[^/]+$/.test(name)) return null;
  const res = await fetch(`https://places.googleapis.com/v1/${name}/media?maxWidthPx=900&skipHttpRedirect=true&key=${apiKey}`);
  if (!res.ok) return null;
  const data = (await res.json()) as { photoUri?: string };
  return data.photoUri ?? null;
}
