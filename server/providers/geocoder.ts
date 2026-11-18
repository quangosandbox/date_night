// Address → point, for geofencing the deck around a specific address.
//  - Google: Places Autocomplete (New) + Place Details (location only), same API key as discovery.
//    Uses session tokens so a typing session bills as one autocomplete session.
//  - Demo: a short list of New York places so the flow works without a key.
import type { Origin, PlaceSuggestion } from '../../shared/types.ts';

export interface Geocoder {
  suggest(input: string, near: { lat: number; lng: number }, session?: string): Promise<PlaceSuggestion[]>;
  resolve(id: string, session?: string): Promise<Origin | null>;
}

const DEMO: (PlaceSuggestion & { lat: number; lng: number })[] = [
  { id: 'demo-wsp', label: 'Washington Square Park', secondary: 'New York, NY', lat: 40.7308, lng: -73.9973 },
  { id: 'demo-bleecker', label: '12 Bleecker St', secondary: 'New York, NY 10012', lat: 40.7258, lng: -73.9927 },
  { id: 'demo-union', label: 'Union Square', secondary: 'New York, NY', lat: 40.7359, lng: -73.9911 },
  { id: 'demo-gct', label: 'Grand Central Terminal', secondary: '89 E 42nd St, New York, NY', lat: 40.7527, lng: -73.9772 },
  { id: 'demo-bedford', label: 'Bedford Ave & N 7th St', secondary: 'Brooklyn, NY 11249', lat: 40.7178, lng: -73.9577 },
  { id: 'demo-delancey', label: '100 Delancey St', secondary: 'New York, NY 10002', lat: 40.7184, lng: -73.9876 },
  { id: 'demo-prospect', label: 'Grand Army Plaza', secondary: 'Brooklyn, NY', lat: 40.6743, lng: -73.9702 },
  { id: 'demo-hudson', label: '250 Hudson St', secondary: 'New York, NY 10013', lat: 40.7266, lng: -74.0076 },
  { id: 'demo-apollo', label: '253 W 125th St', secondary: 'New York, NY 10027', lat: 40.8100, lng: -73.9500 },
];

export const demoGeocoder: Geocoder = {
  async suggest(input) {
    const q = input.trim().toLowerCase();
    if (q.length < 2) return [];
    return DEMO.filter((d) => `${d.label} ${d.secondary}`.toLowerCase().includes(q)).slice(0, 5).map(({ id, label, secondary }) => ({ id, label, secondary }));
  },
  async resolve(id) {
    const d = DEMO.find((x) => x.id === id);
    return d ? { lat: d.lat, lng: d.lng, label: d.label } : null;
  },
};

export function googleGeocoder(apiKey: string, fetchImpl: typeof fetch = fetch): Geocoder {
  return {
    async suggest(input, near, session) {
      if (input.trim().length < 2) return [];
      const res = await fetchImpl('https://places.googleapis.com/v1/places:autocomplete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': apiKey },
        body: JSON.stringify({
          input,
          sessionToken: session,
          includedRegionCodes: ['us'],
          origin: { latitude: near.lat, longitude: near.lng }, // returns distanceMeters so we can sort nearest first
          locationBias: { circle: { center: { latitude: near.lat, longitude: near.lng }, radius: 8000 } },
        }),
      });
      if (!res.ok) throw new Error(`Places autocomplete ${res.status}`);
      const data = (await res.json()) as {
        suggestions?: {
          placePrediction?: { placeId: string; distanceMeters?: number; text?: { text: string }; structuredFormat?: { mainText?: { text: string }; secondaryText?: { text: string } } };
        }[];
      };
      return (data.suggestions ?? [])
        .map((s) => s.placePrediction)
        .filter((p): p is NonNullable<typeof p> => !!p?.placeId)
        .sort((a, b) => (a.distanceMeters ?? Infinity) - (b.distanceMeters ?? Infinity))
        .slice(0, 5)
        .map((p) => ({ id: p.placeId, label: p.structuredFormat?.mainText?.text ?? p.text?.text ?? '', secondary: p.structuredFormat?.secondaryText?.text }));
    },
    async resolve(id, session) {
      if (!/^[A-Za-z0-9_-]{10,}$/.test(id)) return null;
      const res = await fetchImpl(`https://places.googleapis.com/v1/places/${id}${session ? `?sessionToken=${encodeURIComponent(session)}` : ''}`, {
        headers: { 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': 'location,shortFormattedAddress,displayName' },
      });
      if (!res.ok) return null;
      const p = (await res.json()) as { location?: { latitude: number; longitude: number }; shortFormattedAddress?: string; displayName?: { text: string } };
      if (!p.location) return null;
      return { lat: p.location.latitude, lng: p.location.longitude, label: (p.shortFormattedAddress ?? p.displayName?.text ?? 'Pinned spot').split(',')[0] };
    },
  };
}
