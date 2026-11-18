// "When": pick a time in 15-minute steps (scrollable chips, like Resy/OpenTable) or type one,
// plus how flexible you are. Sets the deck's time window.
import { useEffect, useRef } from 'react';
import { fmtTime, fmtTimeShort } from '../api.ts';

const toMin = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3));
const toHHMM = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const round15 = (m: number) => Math.round(m / 15) * 15;

const FIRST = 16 * 60; // 4 PM
const LAST = 22 * 60 + 45; // 10:45 PM
const TIMES = Array.from({ length: (LAST - FIRST) / 15 + 1 }, (_, i) => FIRST + i * 15);
export const FLEX = [
  { m: 0, label: 'Exactly' },
  { m: 15, label: '± 15 min' },
  { m: 30, label: '± 30 min' },
  { m: 60, label: '± 1 hr' },
  { m: 120, label: '± 2 hr' },
];

/** Window → (preferred time, flexibility). */
export function fromWindow(start: string, end: string) {
  const a = toMin(start);
  const b = toMin(end);
  const flex = FLEX.reduce((best, f) => (Math.abs(f.m - (b - a) / 2) < Math.abs(best - (b - a) / 2) ? f.m : best), 60);
  return { time: round15((a + b) / 2), flex };
}

export function toWindow(time: number, flex: number) {
  return { windowStart: toHHMM(Math.max(0, time - flex)), windowEnd: toHHMM(Math.min(23 * 60 + 45, time + flex)) };
}

export function TimePicker({ start, end, onChange, label }: { start: string; end: string; label: string; onChange: (w: { windowStart: string; windowEnd: string }) => void }) {
  const { time, flex } = fromWindow(start, end);
  const row = useRef<HTMLDivElement>(null);

  // Keep the chosen time in view in the chip row.
  useEffect(() => {
    const el = row.current?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (el && row.current) row.current.scrollTo({ left: el.offsetLeft - row.current.clientWidth / 2 + el.clientWidth / 2, behavior: 'smooth' });
  }, [time]);

  return (
    <div className="panel stack" style={{ gap: 14 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div className="eyebrow">{label}</div>
          <div style={{ fontFamily: 'var(--display)', fontSize: 26, lineHeight: 1.1, marginTop: 2 }}>{fmtTime(toHHMM(time))}</div>
        </div>
        <label className="type-time">
          <span className="sr-only">Type a time</span>
          <input
            type="time"
            step={900}
            value={toHHMM(time)}
            onChange={(e) => e.target.value && onChange(toWindow(round15(toMin(e.target.value)), flex))}
          />
        </label>
      </div>

      <div className="time-row" ref={row} role="group" aria-label="Time, in 15-minute steps">
        {TIMES.map((t) => (
          <button key={t} className="time-chip" aria-pressed={t === time} onClick={() => onChange(toWindow(t, flex))}>
            {fmtTimeShort(toHHMM(t))}
          </button>
        ))}
      </div>

      <div className="wrap" role="group" aria-label="How flexible">
        {FLEX.map((f) => (
          <button key={f.m} className="chip" style={{ background: f.m === flex ? undefined : 'var(--rice)' }} aria-pressed={f.m === flex} onClick={() => onChange(toWindow(time, f.m))}>{f.label}</button>
        ))}
      </div>
      <div className="meta-sm" style={{ marginTop: -4 }}>
        {flex === 0 ? `Only ${fmtTime(start)}` : `Anything from ${fmtTime(start)} to ${fmtTime(end)}`}
      </div>
    </div>
  );
}
