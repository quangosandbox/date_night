import { useMemo, useState } from 'react';
import type { ScreenProps } from '../App.tsx';
import { api, fmtDay, fmtTime, fmtTimeShort, icsFor } from '../api.ts';
import { Pair } from '../components/Avatar.tsx';
import { CardArt } from '../components/CardArt.tsx';
import { Calendar, Check, Pin } from '../components/Icons.tsx';
import { endSession } from './Home.tsx';

const PROVIDER_NAMES: Record<string, string> = { resy: 'Resy', opentable: 'OpenTable', atom: 'Atom', fandango: 'Fandango' };

export function Match({ state, apply }: ScreenProps) {
  const s = state.session!;
  const m = s.match!;
  const partner = state.partner!;
  const booking = s.booking;
  const option = m.option;
  const [slotId, setSlotId] = useState(m.slot?.id ?? option.slots[0]?.id);
  const [busy, setBusy] = useState(false);

  const headline =
    m.via === 'fate' ? (
      <>Fate <span className="italic">has spoken.</span></>
    ) : m.via === 'nearMiss' ? (
      <>Done <span className="italic">deal.</span></>
    ) : (
      <>It's a <span className="italic">match.</span></>
    );

  const why = useMemo(() => {
    const supers = m.superBy.map((id) => (id === state.me.id ? 'You' : partner.name));
    if (m.via === 'fate') return 'Picked at random from the spots you liked.';
    if (m.via === 'nearMiss') return 'One of you liked it, the other said "I\'m in."';
    if (supers.length === 2) return 'You both marked it a must-try.';
    if (supers.length === 1) return `You both said yes. ${supers[0]} called it a must-try.`;
    const idx = s.deck.findIndex((o) => o.id === option.id);
    return `You both said yes on card ${idx + 1}.`;
  }, [m, state.me.id, partner.name, s.deck, option.id]);

  async function book() {
    setBusy(true);
    try {
      apply(await api(`/sessions/${s.id}/book`, { slotId }));
    } finally {
      setBusy(false);
    }
  }

  const slot = booking?.slot ?? m.slot;
  const autoBooking = !booking && s.filters.autoBook;
  const isMovie = option.kind === 'movie';
  const place = isMovie ? slot?.label?.split(' · ')[0] : option.address;
  const directions = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${isMovie ? place : option.title} ${option.address ?? ''} New York`)}`;

  return (
    <div className="screen match-screen" style={{ position: 'relative', paddingTop: 40, gap: 20, overflow: 'hidden' }}>
      <Confetti />
      <div className="stack" style={{ alignItems: 'center', textAlign: 'center', gap: 14, position: 'relative' }}>
        <Pair me={state.me} partner={partner} size="lg" />
        <h1 className="h1" style={{ fontSize: 50, lineHeight: 0.95 }}>{headline}</h1>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 500 }}>{why}</p>
      </div>

      <section className="match-card" style={{ position: 'relative' }} aria-labelledby="match-title">
        <CardArt option={option} poster={isMovie} />
        <div className="stack" style={{ padding: 20, gap: 14 }}>
          {!isMovie && (
            <div>
              <h2 id="match-title" className="card-title" style={{ margin: 0, fontSize: 30 }}>{option.title}</h2>
              <div className="meta-sm" style={{ fontSize: 14, marginTop: 6 }}>{option.address} · {option.subtitle.split(' · ').slice(0, 2).join(' · ')}</div>
            </div>
          )}
          {isMovie && <h2 id="match-title" className="sr-only">{option.title}</h2>}
          {isMovie && place && <div className="meta-sm" style={{ fontSize: 14 }}>{place}</div>}

          <div className="stat-grid">
            <div className="stat"><div className="k">{fmtDay(s.filters.date)}</div><div className="v">{slot ? fmtTime(slot.time) : '—'}</div></div>
            <div className="stat"><div className="k">{isMovie ? 'Tickets' : 'Party'}</div><div className="v">{s.filters.partySize}</div></div>
            <div className="stat"><div className="k">Via</div><div className="v">{slot ? PROVIDER_NAMES[slot.provider] ?? slot.provider : '—'}</div></div>
          </div>

          {booking ? (
            <div className="status-ok" role="status">
              <Check size={18} strokeWidth={2.4} /> Booked · Confirmation {booking.confirmation}
            </div>
          ) : autoBooking ? (
            <div className="status-wait" role="status"><span className="spinner" /> Booking {slot ? fmtTime(slot.time) : 'your table'}…</div>
          ) : (
            <div className="stack" style={{ gap: 10 }}>
              <div className="eyebrow">Pick a time</div>
              <div className="wrap" role="group" aria-label="Available times">
                {option.slots.map((sl) => (
                  <button key={sl.id} className="slot-chip" aria-pressed={sl.id === slotId} onClick={() => setSlotId(sl.id)}>
                    {fmtTimeShort(sl.time)}
                  </button>
                ))}
              </div>
              <button className="btn btn-primary btn-block" onClick={book} disabled={busy || !slotId}>
                {busy ? <span className="spinner" /> : null}
                Book {fmtTime(option.slots.find((x) => x.id === slotId)?.time ?? '19:00')}
              </button>
            </div>
          )}
        </div>
      </section>

      <div className="spacer" />
      {booking && (
        <div className="stack" style={{ gap: 10, position: 'relative' }}>
          <div className="row" style={{ gap: 10 }}>
            <a className="btn btn-dark" style={{ flex: 1 }} href={icsFor(booking, isMovie ? 150 : 120)} download={`date-night-${booking.confirmation}.ics`}>
              <Calendar size={18} /> Calendar
            </a>
            <a className="btn btn-outline-ink" style={{ flex: 1 }} href={directions} target="_blank" rel="noreferrer">
              <Pin size={18} /> Directions
            </a>
          </div>
          <button className="link-btn" style={{ color: 'var(--ink)' }} onClick={async () => apply(await endSession(s.id))}>Done</button>
        </div>
      )}
    </div>
  );
}

function Confetti() {
  const bits = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.6,
        dur: 1.8 + Math.random() * 1.4,
        color: ['#17111C', '#F5C451', '#F7F1EA'][i % 3],
        rot: Math.random() * 180,
      })),
    [],
  );
  return (
    <div className="confetti" aria-hidden="true">
      {bits.map((b, i) => (
        <i key={i} style={{ left: `${b.left}%`, background: b.color, animationDuration: `${b.dur}s`, animationDelay: `${b.delay}s`, transform: `rotate(${b.rot}deg)` }} />
      ))}
    </div>
  );
}
