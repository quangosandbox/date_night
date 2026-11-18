import { useState } from 'react';
import type { Mode } from '../../../shared/types.ts';
import type { ScreenProps } from '../App.tsx';
import { api, fmtDay, fmtTime } from '../api.ts';
import { Pair } from '../components/Avatar.tsx';
import { Arrow, Film, Fork } from '../components/Icons.tsx';
import { ProfileSheet } from './ProfileSheet.tsx';

export function Home({ state, apply, onPlan }: ScreenProps & { onPlan: (m: Mode) => void }) {
  const [sheet, setSheet] = useState(false);
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
  const hour = new Date().getHours();
  const when = hour >= 21 ? 'tomorrow' : 'tonight';

  return (
    <div className="screen" style={{ gap: 28 }}>
      <header className="row" style={{ justifyContent: 'space-between' }}>
        <div className="serif" style={{ fontSize: 26 }}>
          Date <span className="italic ember">Night</span>
        </div>
        <button className="icon-btn" style={{ width: 'auto', height: 'auto', background: 'none' }} onClick={() => setSheet(true)} aria-label="Profile and settings">
          <Pair me={state.me} partner={state.partner} />
        </button>
      </header>

      <div className="stack" style={{ gap: 6 }}>
        <div className="meta-sm" style={{ fontWeight: 500 }}>{today}</div>
        <h1 className="h1">
          What are we
          <br />
          <span className="italic">doing {when}?</span>
        </h1>
      </div>

      <div className="stack" style={{ gap: 12 }}>
        <button className="tile" onClick={() => onPlan('dinner')}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div className="tile-icon" style={{ background: 'var(--ember)', color: 'var(--ink)' }}><Fork size={24} /></div>
            <Arrow size={22} className="muted" />
          </div>
          <div>
            <div className="tile-title">Dinner</div>
            <div className="meta-sm" style={{ fontSize: 14, marginTop: 6 }}>Resy · OpenTable · Google</div>
          </div>
        </button>
        <button className="tile" onClick={() => onPlan('movie')}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div className="tile-icon" style={{ background: 'var(--gold)', color: 'var(--ink)' }}><Film size={24} /></div>
            <Arrow size={22} className="muted" />
          </div>
          <div>
            <div className="tile-title">A movie</div>
            <div className="meta-sm" style={{ fontSize: 14, marginTop: 6 }}>Showtimes nearby · Letterboxd ratings</div>
          </div>
        </button>
      </div>

      {!state.me.letterboxd && (
        <button className="list-item outline" style={{ width: '100%', textAlign: 'left', color: 'var(--text)' }} onClick={() => setSheet(true)}>
          <div className="thumb" style={{ background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Film size={22} className="gold" /></div>
          <div className="grow">
            <div className="title-sm">Connect Letterboxd</div>
            <div className="meta-sm">Films on both your watchlists float to the top.</div>
          </div>
          <Arrow size={18} className="muted" />
        </button>
      )}

      {state.history.length > 0 && (
        <section className="stack">
          <h2 className="eyebrow" style={{ margin: 0 }}>Recent dates</h2>
          {state.history.slice(0, 3).map((b) => (
            <div key={b.confirmation} className="list-item outline">
              <div className="grow">
                <div className="title-sm">{b.title}</div>
                <div className="meta-sm">{fmtDay(b.date)} · {fmtTime(b.slot.time)} · {b.confirmation}</div>
              </div>
            </div>
          ))}
        </section>
      )}

      {sheet && <ProfileSheet state={state} apply={apply} onClose={() => setSheet(false)} />}
    </div>
  );
}

export async function endSession(id: string) {
  return api(`/sessions/${id}/end`, {});
}
