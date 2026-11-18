import { useState } from 'react';
import type { ScreenProps } from '../App.tsx';
import { api, fmtTime } from '../api.ts';
import { CardArt } from '../components/CardArt.tsx';
import { Dice } from '../components/Icons.tsx';
import { endSession } from './Home.tsx';

export function NoMatch({ state, apply }: ScreenProps) {
  const s = state.session!;
  const partner = state.partner!;
  const [busy, setBusy] = useState<string | null>(null);

  async function run(key: string, path: string, body: object = {}) {
    setBusy(key);
    try {
      apply(await api(`/sessions/${s.id}${path}`, body));
    } finally {
      setBusy(null);
    }
  }

  const best = (slots: { time: string }[]) => (slots[0] ? fmtTime(slots[0].time) : '');
  const isMovie = s.mode === 'movie';

  return (
    <div className="screen" style={{ paddingTop: 56 }}>
      <div className="stack">
        <h1 className="h1" style={{ fontSize: 40 }}>
          So close. <span className="italic" style={{ background: 'var(--gold)', padding: '0 8px', borderRadius: 12, border: '2px solid var(--ink)', display: 'inline-block', transform: 'rotate(-1.5deg)' }}>Pick a tiebreaker.</span>
        </h1>
        <p className="lede">
          {s.deck.length
            ? `You both made it through all ${s.deck.length} without a mutual yes.${s.nearMisses.length ? ' Here’s where one of you wanted to go.' : ''}`
            : 'Nothing was open for those filters. Widen the net and we’ll look again.'}
        </p>
      </div>

      {s.nearMisses.length > 0 && (
        <ul className="stack" style={{ listStyle: 'none', margin: 0, padding: 0, gap: 8 }}>
          {s.nearMisses.slice(0, 5).map((n) => (
            <li key={n.option.id} className="list-item">
              <div className="thumb"><CardArt option={n.option} /></div>
              <div className="grow">
                <div className="title-sm">{n.option.title}</div>
                <div className="meta-sm" style={n.super ? { color: 'var(--ember-text)', fontWeight: 700 } : undefined}>
                  {n.likedBy === 'partner' ? `${partner.name}${n.super ? "'s must-try" : ' liked'}` : n.super ? 'Your must-try' : 'You liked'} · {best(n.option.slots)}
                </div>
              </div>
              {n.likedBy === 'partner' ? (
                <button className="btn btn-primary btn-sm" disabled={!!busy} onClick={() => run(n.option.id, '/accept', { optionId: n.option.id })}>
                  {busy === n.option.id ? <span className="spinner" /> : "I'm in"}
                </button>
              ) : (
                <span className="meta-sm" style={{ whiteSpace: 'nowrap' }}>Waiting on {partner.name}</span>
              )}
            </li>
          ))}
        </ul>
      )}

      <section className="stack">
        <h2 className="eyebrow" style={{ margin: 0 }}>Or widen the net</h2>
        <div className="wrap">
          <button className="chip" disabled={!!busy} onClick={() => run('time', '/widen', { kind: 'time' })}>± 1 hour</button>
          <button className="chip" disabled={!!busy} onClick={() => run('radius', '/widen', { kind: 'radius' })}>+ 1.5 miles</button>
          <button className="chip" disabled={!!busy} onClick={() => run('cuisine', '/widen', { kind: 'cuisine' })}>{isMovie ? 'Any genre' : 'Any cuisine or price'}</button>
        </div>
      </section>

      <div className="spacer" />
      <div className="stack" style={{ gap: 4 }}>
        {s.deck.length > 0 && (
          <button className="btn btn-gold btn-block" disabled={!!busy} onClick={() => run('fate', '/fate')}>
            <Dice /> Let fate decide
          </button>
        )}
        <button className="link-btn" onClick={async () => apply(await endSession(s.id))}>Call it a night</button>
      </div>
    </div>
  );
}
