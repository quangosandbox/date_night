// "Where": a specific address/place (autocomplete), your current location, or a neighborhood,
// plus a radius. The deck is geofenced to that circle.
import { useEffect, useRef, useState } from 'react';
import type { Area, Origin, PlaceSuggestion } from '../../../shared/types.ts';
import { api } from '../api.ts';
import { Close, Pin } from './Icons.tsx';

const RECENTS_KEY = 'dn.recentPlaces';
export const RADII = [0.25, 0.5, 1, 2];
const radiusLabel = (r: number) => (r === 0.25 ? '¼ mi' : r === 0.5 ? '½ mi' : `${r} mi`);
const walk = (r: number) => `~${Math.round(r * 20)} min walk`;

function loadRecents(): Origin[] {
  try {
    return JSON.parse(localStorage.getItem(RECENTS_KEY) ?? '[]');
  } catch {
    return [];
  }
}
function saveRecent(o: Origin) {
  if (o.label === 'Your location') return;
  try {
    const list = [o, ...loadRecents().filter((r) => r.label !== o.label)].slice(0, 4);
    localStorage.setItem(RECENTS_KEY, JSON.stringify(list));
  } catch {
    /* storage blocked */
  }
}

interface Props {
  areas: Area[];
  area: string;
  origin?: Origin;
  radiusMi: number;
  onChange: (next: { area?: string; origin?: Origin | undefined; radiusMi?: number }) => void;
}

export function WherePicker({ areas, area, origin, radiusMi, onChange }: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [note, setNote] = useState('');
  const [locating, setLocating] = useState(false);
  const session = useRef(Math.random().toString(36).slice(2));
  const recents = loadRecents();
  const centre = origin?.label ?? areas.find((a) => a.id === area)?.name ?? 'here';

  // Address suggestions as you type (debounced).
  useEffect(() => {
    if (query.trim().length < 2) return setSuggestions([]);
    let live = true;
    const t = setTimeout(() => {
      api<{ suggestions: PlaceSuggestion[] }>(`/places/suggest?q=${encodeURIComponent(query)}&area=${area}&session=${session.current}`)
        .then((r) => live && setSuggestions(r.suggestions))
        .catch(() => live && setSuggestions([]));
    }, 220);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [query, area]);

  async function choose(s: PlaceSuggestion) {
    setNote('');
    try {
      const { origin: o } = await api<{ origin: Origin }>(`/places/resolve?id=${encodeURIComponent(s.id)}&session=${session.current}`);
      saveRecent(o);
      onChange({ origin: o });
      setQuery('');
      setOpen(false);
      session.current = Math.random().toString(36).slice(2); // new billing session next time
    } catch (e) {
      setNote((e as Error).message);
    }
  }

  function useMyLocation() {
    setNote('');
    if (!navigator.geolocation) return setNote('Location isn’t available here. Type an address instead.');
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        onChange({ origin: { lat: pos.coords.latitude, lng: pos.coords.longitude, label: 'Your location' } });
      },
      () => {
        setLocating(false);
        setNote('Location is off. Type an address instead.');
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 120000 },
    );
  }

  return (
    <section className="stack" aria-labelledby="where">
      <h2 id="where" className="eyebrow" style={{ margin: 0 }}>Where</h2>

      <div className="where-box">
        <Pin className="ember" style={{ flexShrink: 0 }} />
        <label htmlFor="where-input" className="sr-only">Address or place</label>
        <input
          id="where-input"
          className="where-input"
          placeholder={origin ? `Near ${origin.label}` : 'An address, a place, or a neighborhood'}
          value={query}
          autoComplete="off"
          role="combobox"
          aria-expanded={open && suggestions.length > 0}
          aria-controls="where-suggestions"
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
        />
        {origin && (
          <button className="icon-btn" style={{ width: 36, height: 36, background: 'var(--rice)' }} onClick={() => onChange({ origin: undefined })} aria-label={`Clear ${origin.label}`}>
            <Close size={14} />
          </button>
        )}
      </div>

      {open && suggestions.length > 0 && (
        <ul id="where-suggestions" className="suggestions" role="listbox">
          {suggestions.map((s) => (
            <li key={s.id} role="option" aria-selected="false">
              <button onMouseDown={(e) => e.preventDefault()} onClick={() => choose(s)}>
                <span style={{ fontWeight: 700 }}>{s.label}</span>
                {s.secondary && <span className="meta-sm" style={{ marginTop: 0 }}>{s.secondary}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="chip-scroll" role="group" aria-label="Quick picks">
        <button className="chip" aria-pressed={origin?.label === 'Your location'} onClick={useMyLocation} disabled={locating}>
          {locating ? 'Finding you…' : 'Use my location'}
        </button>
        {recents.map((r) => (
          <button key={r.label} className="chip" aria-pressed={origin?.label === r.label} onClick={() => onChange({ origin: r })}>{r.label}</button>
        ))}
        {areas.map((a) => (
          <button key={a.id} className="chip" aria-pressed={!origin && area === a.id} onClick={() => onChange({ area: a.id, origin: undefined })}>{a.name}</button>
        ))}
      </div>
      {note && <div role="alert" style={{ color: 'var(--tobiko-ink)', fontSize: 14, fontWeight: 600 }}>{note}</div>}

      <div className="seg" style={{ ['--n' as string]: RADII.length }} role="group" aria-label={`Distance from ${centre}`}>
        {RADII.map((r) => (
          <button key={r} className="chip solid" aria-pressed={radiusMi === r} onClick={() => onChange({ radiusMi: r })}>{radiusLabel(r)}</button>
        ))}
      </div>
      <div className="note" style={{ fontSize: 17, color: 'var(--muted)' }}>within {radiusLabel(radiusMi)} of {centre} · {walk(radiusMi)}</div>
    </section>
  );
}
