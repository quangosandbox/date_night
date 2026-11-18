import { useEffect, useMemo, useState } from 'react';
import type { Filters as F, Mode } from '../../../shared/types.ts';
import type { ScreenProps } from '../App.tsx';
import { api, fmtTime, localISODate, type Meta } from '../api.ts';
import { Back, Pin } from '../components/Icons.tsx';

const MIN = 17 * 60; // 5 PM
const MAX = 23 * 60; // 11 PM
const STEP = 30;
const toHHMM = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const toMin = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3));

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
    windowStart: mode === 'dinner' ? '19:00' : '18:30',
    windowEnd: mode === 'dinner' ? '21:00' : '21:30',
    partySize: 2,
    area: saved.area ?? meta.areas[0].id,
    radiusMi: saved.radiusMi ?? 2,
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
  const start = toMin(f.windowStart);
  const end = toMin(f.windowEnd);
  const pct = (m: number) => ((m - MIN) / (MAX - MIN)) * 100;
  const dayWord = dayChoice === 'today' ? 'tonight' : dayChoice === 'tomorrow' ? 'tomorrow' : new Date(`${f.date}T12:00`).toLocaleDateString(undefined, { weekday: 'long' });

  const areaName = useMemo(() => meta.areas.find((a) => a.id === f.area)?.name, [meta, f.area]);

  async function start_() {
    setBusy(true);
    setError('');
    try {
      localStorage.setItem(LAST_KEY, JSON.stringify({ area: f.area, radiusMi: f.radiusMi, autoBook: f.autoBook }));
      apply(await api('/sessions', { mode, filters: f }));
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="screen" style={{ gap: 22, paddingBottom: 0 }}>
      <header className="row">
        <button className="icon-btn" onClick={onBack} aria-label="Back"><Back /></button>
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
        <div className="panel stack" style={{ gap: 14 }}>
          <div className="row" style={{ justifyContent: 'space-between', fontSize: 15 }}>
            <span className="muted">{mode === 'dinner' ? 'Table between' : 'Showtime between'}</span>
            <span style={{ fontWeight: 600 }}>{fmtTime(f.windowStart)} – {fmtTime(f.windowEnd)}</span>
          </div>
          <div className="dual-range">
            <div className="track" />
            <div className="fill" style={{ left: `${pct(start)}%`, right: `${100 - pct(end)}%` }} />
            <input type="range" min={MIN} max={MAX} step={STEP} value={start} aria-label="Earliest time" aria-valuetext={fmtTime(f.windowStart)}
              onChange={(e) => set('windowStart', toHHMM(Math.min(Number(e.target.value), end - STEP)))} />
            <input type="range" min={MIN} max={MAX} step={STEP} value={end} aria-label="Latest time" aria-valuetext={fmtTime(f.windowEnd)}
              onChange={(e) => set('windowEnd', toHHMM(Math.max(Number(e.target.value), start + STEP)))} />
          </div>
          <div className="row" style={{ justifyContent: 'space-between', fontSize: 12, color: 'var(--faint)' }}>
            <span>5 PM</span><span>11 PM</span>
          </div>
        </div>
      </section>

      <section className="stack" aria-labelledby="where">
        <h2 id="where" className="eyebrow" style={{ margin: 0 }}>Where</h2>
        <div className="panel row" style={{ padding: '6px 6px 6px 16px', gap: 10 }}>
          <Pin className="ember" style={{ flexShrink: 0 }} />
          <label htmlFor="area" className="sr-only">Neighborhood</label>
          <select id="area" className="select" style={{ boxShadow: 'none', background: 'transparent', minHeight: 44, padding: '0 36px 0 0', fontWeight: 600 }} value={f.area} onChange={(e) => set('area', e.target.value)}>
            {meta.areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div className="seg" style={{ ['--n' as string]: 4 }} role="group" aria-label={`Distance from ${areaName}`}>
          {[1, 2, 4, 8].map((r) => (
            <button key={r} className="chip solid" aria-pressed={f.radiusMi === r} onClick={() => set('radiusMi', r)}>{r} mi</button>
          ))}
        </div>
      </section>

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
          {count === 0 ? 'Nothing open — try widening' : `Start swiping${count != null ? ` · ${count} ${mode === 'dinner' ? 'spots' : 'films'} open` : ''}`}
        </button>
        <div className="note" style={{ textAlign: 'center', fontSize: 17, color: 'var(--muted)' }}>{state.partner?.name} gets the same deck · tuned to what you two like</div>
      </div>
    </div>
  );
}
