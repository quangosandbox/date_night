import { useEffect, useMemo, useState } from 'react';
import type { Filters as F, Mode } from '../../../shared/types.ts';
import type { ScreenProps } from '../App.tsx';
import { api, fmtTime, localISODate, type Meta } from '../api.ts';
import { HomeButton } from '../components/HomeButton.tsx';
import { RADII, WherePicker } from '../components/WherePicker.tsx';
import { TimePicker } from '../components/TimePicker.tsx';


const LAST_KEY = 'dn.lastFilters';

function defaults(mode: Mode, meta: Meta): F {
  const now = new Date();
  // Late in the evening? Default to tomorrow.
  const date = now.getHours() >= 21 ? localISODate(new Date(Date.now() + 86400000)) : localISODate();
  let saved: Partial<F> = {};
  try {
    saved = JSON.parse(localStorage.getItem(LAST_KEY) ?? '{}');
  } catch {
    /* ignore */
  }
  return {
    date,
    windowStart: mode === 'dinner' ? '18:30' : '18:30',
    windowEnd: mode === 'dinner' ? '20:30' : '21:30',
    partySize: 2,
    area: saved.area ?? meta.areas[0].id,
    origin: saved.origin,
    radiusMi: saved.radiusMi && RADII.includes(saved.radiusMi) ? saved.radiusMi : 1,
    cuisines: [],
    prices: [],
    genres: [],
    formats: [],
    autoBook: saved.autoBook ?? true,
  };
}

export function Filters({ mode, meta, state, apply, onBack }: ScreenProps & { mode: Mode; meta: Meta; onBack: () => void }) {
  const [f, setF] = useState<F>(() => defaults(mode, meta));
  const [count, setCount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = <K extends keyof F>(k: K, v: F[K]) => setF((prev) => ({ ...prev, [k]: v }));
  const toggle = <K extends 'cuisines' | 'genres' | 'formats' | 'prices'>(k: K, v: F[K][number]) =>
    setF((prev) => {
      const list = prev[k] as (string | number)[];
      return { ...prev, [k]: list.includes(v) ? list.filter((x) => x !== v) : [...list, v] };
    });

  // Live count of bookable options for the current filters.
  useEffect(() => {
    let live = true;
    setCount(null);
    const t = setTimeout(() => {
      api<{ count: number }>('/preview', { mode, filters: f }).then((r) => live && setCount(r.count)).catch(() => {});
    }, 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [f, mode]);

  const today = localISODate();
  const tomorrow = localISODate(new Date(Date.now() + 86400000));
  const dayChoice = f.date === today ? 'today' : f.date === tomorrow ? 'tomorrow' : 'other';
  const dayWord = dayChoice === 'today' ? 'tonight' : dayChoice === 'tomorrow' ? 'tomorrow' : new Date(`${f.date}T12:00`).toLocaleDateString(undefined, { weekday: 'long' });


  async function start_() {
    setBusy(true);
    setError('');
    try {
      localStorage.setItem(LAST_KEY, JSON.stringify({ area: f.area, origin: f.origin?.label === 'Your location' ? undefined : f.origin, radiusMi: f.radiusMi, autoBook: f.autoBook }));
      apply(await api('/sessions', { mode, filters: f }));
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="screen" style={{ gap: 22, paddingBottom: 0 }}>
      <header className="row">
        <HomeButton onClick={onBack} />
        <h1 className="h2">
          {mode === 'dinner' ? 'Dinner' : 'A movie'}, <span className="hl">{dayWord}</span>
        </h1>
      </header>

      <section className="stack" aria-labelledby="when">
        <h2 id="when" className="eyebrow" style={{ margin: 0 }}>When</h2>
        <div className="wrap">
          <button className="chip solid" aria-pressed={dayChoice === 'today'} onClick={() => set('date', today)}>Tonight</button>
          <button className="chip solid" aria-pressed={dayChoice === 'tomorrow'} onClick={() => set('date', tomorrow)}>Tomorrow</button>
          <label className="chip solid" aria-pressed={dayChoice === 'other'} style={{ display: 'inline-flex', alignItems: 'center', position: 'relative', background: dayChoice === 'other' ? 'var(--text)' : undefined, color: dayChoice === 'other' ? 'var(--ink)' : undefined }}>
            {dayChoice === 'other' ? new Date(`${f.date}T12:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Pick a day'}
            <input type="date" min={today} value={f.date} onChange={(e) => e.target.value && set('date', e.target.value)} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} aria-label="Pick a day" />
          </label>
        </div>
        <TimePicker
          label={mode === 'dinner' ? 'table around' : 'showtime around'}
          start={f.windowStart}
          end={f.windowEnd}
          onChange={(w) => setF((prev) => ({ ...prev, ...w }))}
        />
      </section>

      <WherePicker
        areas={meta.areas}
        area={f.area}
        origin={f.origin}
        radiusMi={f.radiusMi}
        onChange={(next) => setF((prev) => ({ ...prev, ...next }))}
      />

      {mode === 'dinner' ? (
        <section className="stack" aria-labelledby="mood">
          <h2 id="mood" className="eyebrow" style={{ margin: 0 }}>In the mood for <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>· leave empty for anything</span></h2>
          <div className="wrap">
            {meta.cuisines.map((c) => (
              <button key={c} className="chip" aria-pressed={f.cuisines.includes(c)} onClick={() => toggle('cuisines', c)}>{c}</button>
            ))}
          </div>
          <div className="seg" style={{ ['--n' as string]: 4 }} role="group" aria-label="Price">
            {[1, 2, 3, 4].map((p) => (
              <button key={p} className="chip solid" aria-pressed={f.prices.includes(p)} onClick={() => toggle('prices', p)} aria-label={`Price level ${p}`}>{'$'.repeat(p)}</button>
            ))}
          </div>
        </section>
      ) : (
        <section className="stack" aria-labelledby="mood">
          <h2 id="mood" className="eyebrow" style={{ margin: 0 }}>Genres <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>· leave empty for anything</span></h2>
          <div className="wrap">
            {meta.genres.map((g) => (
              <button key={g} className="chip" aria-pressed={f.genres.includes(g)} onClick={() => toggle('genres', g)}>{g}</button>
            ))}
          </div>
          <div className="wrap" role="group" aria-label="Format">
            {meta.formats.map((x) => (
              <button key={x} className="chip solid" aria-pressed={f.formats.includes(x)} onClick={() => toggle('formats', x)}>{x}</button>
            ))}
          </div>
        </section>
      )}

      <section className="panel stack" style={{ gap: 14 }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span id="party" style={{ fontWeight: 500 }}>{mode === 'dinner' ? 'Party size' : 'Tickets'}</span>
          <div className="stepper" role="group" aria-labelledby="party">
            <button onClick={() => set('partySize', Math.max(1, f.partySize - 1))} aria-label="Fewer">−</button>
            <output aria-live="polite">{f.partySize}</output>
            <button onClick={() => set('partySize', Math.min(8, f.partySize + 1))} aria-label="More">+</button>
          </div>
        </div>
        {meta.bookingMode === 'auto' ? (
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div>
              <div id="autobook" style={{ fontWeight: 500 }}>Book automatically on a match</div>
              <div className="meta-sm">{f.autoBook ? 'We grab the best time in your window.' : "You'll pick the time after you match."}</div>
            </div>
            <button className="toggle" role="switch" aria-checked={f.autoBook} aria-labelledby="autobook" onClick={() => set('autoBook', !f.autoBook)} />
          </div>
        ) : (
          <div className="meta-sm" style={{ lineHeight: 1.45 }}>
            Only places that are open for dinner in your window and take reservations. When you match, we'll send you to reserve.
          </div>
        )}
      </section>

      <div className="spacer" />
      {error && <div role="alert" style={{ color: 'var(--ember-text)', fontSize: 14 }}>{error}</div>}
      <div className="sticky-cta">
        <button className="btn btn-red btn-block" onClick={start_} disabled={busy || count === 0}>
          {count === 0 ? 'Nothing open — try widening' : `Start swiping${count != null ? ` · ${count} ${mode === 'dinner' ? (count === 1 ? 'spot' : 'spots') : count === 1 ? 'film' : 'films'} open` : ''}`}
        </button>
        <div className="note" style={{ textAlign: 'center', fontSize: 17, color: 'var(--muted)' }}>{state.partner?.name} gets the same deck · tuned to what you two like</div>
      </div>
    </div>
  );
}
