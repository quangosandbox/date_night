import { describe, expect, it } from 'vitest';
import type { Filters } from '../shared/types.ts';
import { openIntervals, slotsFromHours, type Period } from './hours.ts';
import { cuisineOf, googlePlaces, toVenue, type GPlace } from './providers/googlePlaces.ts';

// Shaped like a real Places API (New) Text Search result.
const place: GPlace = {
  id: 'ChIJabc123',
  displayName: { text: 'Lilac & Lime' },
  shortFormattedAddress: '12 Bleecker St, New York',
  location: { latitude: 40.7359, longitude: -74.0037 },
  rating: 4.6,
  userRatingCount: 1840,
  priceLevel: 'PRICE_LEVEL_EXPENSIVE',
  types: ['italian_restaurant', 'restaurant', 'food'],
  primaryTypeDisplayName: { text: 'Italian Restaurant' },
  photos: [{ name: 'places/ChIJabc123/photos/AF1', authorAttributions: [{ displayName: 'Dana P.', uri: 'https://maps.google.com/maps/contrib/1' }] }],
  reviews: [{ rating: 5, text: { text: 'Best cacio e pepe in the Village.' }, authorAttribution: { displayName: 'Marco', uri: 'https://maps.google.com/u/2' }, relativePublishTimeDescription: '2 weeks ago' }],
  editorialSummary: { text: 'Candlelit trattoria with handmade pasta.' },
  websiteUri: 'https://example.com',
  googleMapsUri: 'https://maps.google.com/?cid=123',
  nationalPhoneNumber: '(212) 555-0100',
  regularOpeningHours: { periods: [3, 4, 5].map((day) => ({ open: { day, hour: 17, minute: 0 }, close: { day, hour: 22, minute: 0 } })) },
  reservable: true,
  servesDinner: true,
  servesWine: true,
  outdoorSeating: true,
};

const f: Filters = {
  date: '2026-11-18', // a Wednesday
  windowStart: '19:00', windowEnd: '21:30', partySize: 2, area: 'west-village', radiusMi: 2,
  cuisines: [], prices: [], genres: [], formats: [], autoBook: true,
};

describe('Google Places mapping', () => {
  it('maps a place to a venue with attribution, handoff links and tags', () => {
    const v = toVenue(place);
    expect(v).toMatchObject({ id: 'g-ChIJabc123', name: 'Lilac & Lime', cuisine: 'Italian', price: 3, rating: 4.6, reviews: 1840, dataAttribution: 'Google Maps' });
    expect(v.tags).toEqual(['Outdoor seating', 'Wine']);
    expect(v.photos![0]).toMatchObject({ url: '/api/places-photo?name=places%2FChIJabc123%2Fphotos%2FAF1', attribution: 'Dana P.' });
    expect(v.reviewList![0]).toMatchObject({ author: 'Marco', authorUrl: 'https://maps.google.com/u/2', stars: 5 });
    expect(v.handoff).toEqual({ mapsUrl: 'https://maps.google.com/?cid=123', website: 'https://example.com', phone: '(212) 555-0100', reservable: true });
  });

  it('buckets cuisines from Google place types', () => {
    expect(cuisineOf({ id: 'x', types: ['sushi_restaurant'] })).toBe('Japanese');
    expect(cuisineOf({ id: 'x', types: ['restaurant'], primaryTypeDisplayName: { text: 'Peruvian Restaurant' } })).toBe('Peruvian');
    expect(cuisineOf({ id: 'x', types: ['restaurant'] }, 'Thai')).toBe('Thai');
  });

  it('searches with the right headers, drops places that do not take reservations, and caches', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fakeFetch = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ places: [place, { ...place, id: 'noRes', reservable: false }, { ...place, id: 'lunch', servesDinner: false }] }));
    }) as unknown as typeof fetch;
    const g = googlePlaces('test-key', fakeFetch);
    const area = { id: 'west-village', name: 'West Village', lat: 40.7358, lng: -74.0036 };
    const venues = await g.discover(area, 2, { ...f, cuisines: ['Italian'] });
    expect(venues.map((v) => v.id)).toEqual(['g-ChIJabc123']);
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers['X-Goog-Api-Key']).toBe('test-key');
    expect(headers['X-Goog-FieldMask']).toContain('places.regularOpeningHours');
    const body = JSON.parse(String(calls[0].init.body));
    expect(calls[0].url).toContain('places:searchNearby');
    expect(body.includedTypes).toEqual(['italian_restaurant', 'pizza_restaurant']);
    expect(body.locationRestriction.circle).toEqual({ center: { latitude: 40.7358, longitude: -74.0036 }, radius: 3218 });
    await g.discover(area, 2, { ...f, cuisines: ['Italian'] });
    expect(calls).toHaveLength(1); // served from the short-lived cache
  });
});

describe('address geofence', () => {
  it('drops places outside the radius even if Google returns them', async () => {
    const far = { ...place, id: 'far', location: { latitude: 40.80, longitude: -73.95 } };
    const fakeFetch = (async () => new Response(JSON.stringify({ places: [place, far] }))) as unknown as typeof fetch;
    const g = googlePlaces('k', fakeFetch);
    const venues = await g.discover({ id: 'origin', name: '12 Bleecker St', lat: 40.7258, lng: -73.9927 }, 1, f);
    expect(venues.map((v) => v.id)).toEqual(['g-ChIJabc123']);
  });
});

describe('opening hours → suggested times', () => {
  const hours = place.regularOpeningHours!.periods as Period[];

  it('suggests times with room for a full dinner before close', () => {
    // 15-minute steps; the last table needs ~75 min before the 22:00 close.
    expect(slotsFromHours('p', hours, f).map((s) => s.time)).toEqual(['19:00', '19:15', '19:30', '19:45', '20:00', '20:15', '20:30', '20:45']);
  });

  it('is empty on days the place is closed', () => {
    expect(slotsFromHours('p', hours, { ...f, date: '2026-11-22' })).toEqual([]); // Sunday
  });

  it('handles places open past midnight and 24h places', () => {
    const late: Period[] = [{ open: { day: 2, hour: 18 }, close: { day: 3, hour: 2 } }]; // Tue 6pm → Wed 2am
    expect(openIntervals(late, '2026-11-17')).toEqual([[1080, 1560]]); // Tuesday
    expect(openIntervals(late, '2026-11-18')).toEqual([[-360, 120]]); // spill-over into Wednesday
    expect(slotsFromHours('p', [{ open: { day: 0, hour: 0 } }], f)).toHaveLength(11);
  });
});
