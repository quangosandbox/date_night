import { useState } from 'react';
import type { Booking, Mode } from '../../../shared/types.ts';
import type { ScreenProps } from '../App.tsx';
import { api, fmtDay } from '../api.ts';
import { Pair } from '../components/Avatar.tsx';
import { Logo, Plate, SushiPlate, TicketArt } from '../components/Brand.tsx';
import { Arrow } from '../components/Icons.tsx';
import { ProfileSheet } from './ProfileSheet.tsx';

export function Home({ state, apply, switchTo, onPlan, onRate }: ScreenProps & { onPlan: (m: Mode) => void; onRate: (b: Booking) => void }) {
  const [sheet, setSheet] = useState(false);
  const hour = new Date().getHours();
  const when = hour >= 21 ? 'tomorrow' : 'tonight';
  const greeting = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  const partner = state.partner!;
  const pending = state.toRate[0];
  const passAndPlay = state.localMode && !partner.isBot;

  return (
    <div className="screen" style={{ gap: 22 }}>
      <header className="row" style={{ justifyContent: 'space-between' }}>
        <Logo />
        <button style={{ background: 'none', border: 0, padding: 0 }} onClick={() => setSheet(true)} aria-label="Profile and settings">
          <Pair me={state.me} partner={partner} />
        </button>
      </header>

      <div className="stack" style={{ gap: 4 }}>
        <div className="note" style={{ fontSize: 22 }}>{greeting}, {state.me.name} &amp; {partner.name} ✶</div>
        <h1 className="h1">What are we doing <span className="hl">{when}?</span></h1>
      </div>

      {pending && (
        <button className="rate-banner" onClick={() => onRate(pending)}>
          <Plate option={pending.option} size={60} />
          <div className="grow">
            <div className="note">psst — how was it?</div>
            <div style={{ fontFamily: 'var(--display)', fontSize: 18, lineHeight: 1.1, marginTop: 2 }}>Rate {pending.title}</div>
            <div className="meta-sm" style={{ color: 'rgba(255,247,238,0.7)' }}>{fmtDay(pending.date)} · teaches us your taste</div>
          </div>
          <Arrow size={22} />
        </button>
      )}

      <div className="stack" style={{ gap: 12 }}>
        <button className="mode-tile" style={{ background: 'var(--tobiko)' }} onClick={() => onPlan('dinner')}>
          <SushiPlate className="art" />
          <span className="note" style={{ color: 'var(--ink)' }}>hungry?</span>
          <span className="title">Dinner</span>
          <span className="sub">Resy · OpenTable · Google</span>
        </button>
        <button className="mode-tile" style={{ background: 'var(--ink)', color: 'var(--cream)' }} onClick={() => onPlan('movie')}>
          <TicketArt className="art" />
          <span className="note" style={{ color: 'var(--tamago)' }}>or…</span>
          <span className="title">A movie</span>
          <span className="sub">Showtimes nearby · Letterboxd ratings</span>
        </button>
      </div>

      {state.taste.into.length + state.taste.notInto.length > 0 && (
        <section className="stack" style={{ gap: 8 }}>
          <div className="eyebrow">what we've learned about you two</div>
          <div className="taste">
            {state.taste.into.map((t) => <span key={t} className="tag">{t}</span>)}
            {state.taste.notInto.map((t) => <span key={t} className="tag no">{t}</span>)}
          </div>
        </section>
      )}

      {state.ourList.length > 0 && (
        <section className="stack">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h2 className="h2" style={{ fontSize: 22 }}>Our list</h2>
            <span className="note" style={{ fontSize: 18 }}>ranked by you two</span>
          </div>
          {state.ourList.slice(0, 6).map((p, i) => (
            <div key={p.confirmation} className="list-row">
              <span className="rank">{i + 1}</span>
              <Plate photo={p.photo} art={p.art} seed={p.optionId} size={48} />
              <div className="grow">
                <div className="title-sm">{p.title}</div>
                <div className="meta-sm">
                  you {p.mine?.score.toFixed(1)}
                  {p.partner ? ` · ${partner.name} ${p.partner.score.toFixed(1)}` : ` · waiting on ${partner.name}`}
                </div>
              </div>
              <span className={`score ${p.mine?.verdict ?? 'fine'}`} aria-label={`Together ${p.together}`}>{p.together?.toFixed(1)}</span>
            </div>
          ))}
        </section>
      )}

      {passAndPlay && (
        <button className="btn btn-cream btn-block" onClick={() => switchTo(partner.id)}>
          Hand the phone to {partner.name} <Arrow size={18} />
        </button>
      )}

      {!state.me.letterboxd && (
        <button className="list-item outline" style={{ width: '100%', textAlign: 'left', color: 'var(--ink)' }} onClick={() => setSheet(true)}>
          <div className="grow">
            <div className="title-sm">Connect Letterboxd</div>
            <div className="meta-sm">Films on both your watchlists float to the top.</div>
          </div>
          <Arrow size={18} />
        </button>
      )}

      {sheet && <ProfileSheet state={state} apply={apply} switchTo={switchTo} onClose={() => setSheet(false)} />}
    </div>
  );
}

export async function endSession(id: string) {
  return api(`/sessions/${id}/end`, {});
}
