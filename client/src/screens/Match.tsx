import { useMemo, useState } from 'react';
import type { ScreenProps } from '../App.tsx';
import { api, fmtDay, fmtTime, fmtTimeShort, calendarLink } from '../api.ts';
import { Pair } from '../components/Avatar.tsx';
import { Photo } from '../components/Brand.tsx';
import { HomeButton } from '../components/HomeButton.tsx';
import { Calendar, Check, Heart, Pin } from '../components/Icons.tsx';
import { endSession } from './Home.tsx';

const PROVIDER_NAMES: Record<string, string> = { resy: 'Resy', opentable: 'OpenTable', atom: 'Atom', fandango: 'Fandango', handoff: 'Maps' };

export function Match({ state, apply, goHome }: ScreenProps) {
  const s = state.session!;
  const m = s.match!;
  const partner = state.partner!;
  const booking = s.booking;
  const option = m.option;
  const [slotId, setSlotId] = useState(m.slot?.id ?? option.slots[0]?.id);
  const [busy, setBusy] = useState(false);

  const [title, note] =
    m.via === 'fate' ? ['Fate has spoken.', `the dice picked ${option.title}`] : m.via === 'nearMiss' ? ['Done deal.', `${option.title} it is`] : ['Chopsticks down.', `you both picked ${option.title}`];

  const why = useMemo(() => {
    const supers = m.superBy.map((id) => (id === state.me.id ? 'You' : partner.name));
    if (supers.length === 2) return 'You both marked it a must-try.';
    if (supers.length === 1) return `${supers[0]} called it a must-try.`;
    if (m.via === 'swipe') return `Card ${s.deck.findIndex((o) => o.id === option.id) + 1} of ${s.deck.length}.`;
    return '';
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
  const handoff = !booking ? option.handoff : undefined;
  const autoBooking = !booking && !handoff && s.filters.autoBook;
  const [time, setTime] = useState(m.slot?.time ?? option.slots[0]?.time ?? '19:30');

  async function bookedIt() {
    setBusy(true);
    try {
      apply(await api(`/sessions/${s.id}/booked`, { time }));
    } finally {
      setBusy(false);
    }
  }
  async function noTable() {
    setBusy(true);
    try {
      apply(await api(`/sessions/${s.id}/no-table`, {}));
    } finally {
      setBusy(false);
    }
  }
  const isMovie = option.kind === 'movie';
  const place = isMovie ? slot?.label?.split(' · ')[0] ?? option.address : option.address;
  const directions = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${isMovie ? place : option.title} ${option.address ?? ''} New York`)}`;

  return (
    <div className="screen match-screen" style={{ position: 'relative', overflow: 'hidden', gap: 20 }}>
      <Confetti />
      <header className="row" style={{ position: 'relative', zIndex: 1 }}>
        <HomeButton onClick={goHome} dark />
      </header>
      <div className="match-head">
        <div className="match-sticks" aria-hidden="true">
          <span className="s l" />
          <span className="s r" />
          <span className="bite" />
        </div>
        <h1 className="match-title">{title}</h1>
        <div className="note">{note}</div>
        <div className="row" style={{ gap: 10, marginTop: 4 }}>
          <Pair me={state.me} partner={partner} />
          {why && <span style={{ fontSize: 14, fontWeight: 600, opacity: 0.85 }}>{why}</span>}
        </div>
      </div>

      <section className="ticket" aria-labelledby="ticket-title">
        <Photo option={option} className="stub-photo" poster={isMovie} />
        <div className="body">
          <div>
            <h2 id="ticket-title" className="title" style={{ margin: 0 }}>{option.title}</h2>
            <div className="meta-sm" style={{ fontSize: 14, marginTop: 6 }}>{place}</div>
          </div>
          <div className="kv">
            <div><div className="k">{fmtDay(s.filters.date)}</div><div className="v">{slot ? fmtTime(slot.time) : '—'}</div></div>
            <div><div className="k">{isMovie ? 'seats' : 'party'}</div><div className="v">{s.filters.partySize}</div></div>
            <div><div className="k">via</div><div className="v">{slot ? PROVIDER_NAMES[slot.provider] ?? slot.provider : '—'}</div></div>
          </div>
          {m.hearts.map((h) => (
            <div key={h.userId} className="heart-note">
              <Heart size={16} />
              <span>{h.userId === state.me.id ? 'you' : partner.name} hearted {/review|vibe|pitch/.test(h.item) ? h.item : `the ${h.item.toLowerCase()}`}</span>
            </div>
          ))}
          {!booking && autoBooking && <div className="status-wait" role="status"><span className="spinner" /> Booking {slot ? fmtTime(slot.time) : 'your table'}…</div>}
          {handoff && (
            <div className="stack" style={{ gap: 12 }}>
              <div className="eyebrow">1 · grab the table</div>
              <div className="meta-sm" style={{ fontSize: 14, marginTop: -6 }}>
                Aim for {fmtTime(time)}. {handoff.mapsUrl ? 'Google Maps shows a "Reserve a table" button when they take online bookings.' : ''}
              </div>
              <div className="handoff-actions">
                {handoff.mapsUrl && <a className="btn btn-red" href={handoff.mapsUrl} target="_blank" rel="noreferrer"><Pin size={16} /> Reserve</a>}
                {handoff.website && <a className="btn" href={handoff.website} target="_blank" rel="noreferrer">Website</a>}
                {handoff.phone && <a className="btn" href={`tel:${handoff.phone.replace(/[^\d+]/g, '')}`}>Call</a>}
              </div>
              {handoff.phone && <div className="mono" style={{ fontSize: 13, userSelect: 'all' }}>{handoff.phone}</div>}
              <div className="eyebrow" style={{ marginTop: 6 }}>2 · what time did you get?</div>
              <div className="wrap" role="group" aria-label="Booked time">
                {option.slots.map((sl) => (
                  <button key={sl.id} className="slot-chip" style={{ background: sl.time === time ? undefined : 'var(--rice)' }} aria-pressed={sl.time === time} onClick={() => setTime(sl.time)}>{fmtTimeShort(sl.time)}</button>
                ))}
                <label className="slot-chip" style={{ background: 'var(--rice)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  other
                  <input type="time" value={time} step={900} onChange={(e) => e.target.value && setTime(e.target.value)} aria-label="Other time" style={{ border: 0, background: 'transparent', fontFamily: 'var(--mono)', fontSize: 13, width: 92 }} />
                </label>
              </div>
              <button className="btn btn-block" onClick={bookedIt} disabled={busy}>
                {busy ? <span className="spinner" /> : <Check size={18} />} We're booked for {fmtTime(time)}
              </button>
              <button className="link-btn" onClick={noTable} disabled={busy}>No table? Drop it and keep swiping</button>
            </div>
          )}
          {!booking && !handoff && !autoBooking && (
            <div className="stack" style={{ gap: 10 }}>
              <div className="eyebrow">pick a time</div>
              <div className="wrap" role="group" aria-label="Available times">
                {option.slots.map((sl) => (
                  <button key={sl.id} className="slot-chip" style={{ background: sl.id === slotId ? undefined : 'var(--rice)' }} aria-pressed={sl.id === slotId} onClick={() => setSlotId(sl.id)}>{fmtTimeShort(sl.time)}</button>
                ))}
              </div>
              <button className="btn btn-red btn-block" onClick={book} disabled={busy || !slotId}>
                {busy ? <span className="spinner" /> : null}
                Book {fmtTime(option.slots.find((x) => x.id === slotId)?.time ?? '19:00')}
              </button>
            </div>
          )}
        </div>
        {booking && (
          <>
            <div className="perf" />
            <div className="stub">
              <div className="stack" style={{ gap: 4 }}>
                <span className="status-ok" role="status"><Check size={18} strokeWidth={2.6} /> Booked</span>
                <span className="conf">{booking.selfReported ? `ref ${booking.confirmation}` : booking.confirmation}</span>
              </div>
              <div className="barcode" aria-hidden="true" />
            </div>
          </>
        )}
      </section>
      {booking?.demo && <div className="demo-flag" style={{ color: 'rgba(255,247,238,0.6)', textAlign: 'center', marginTop: -8 }}>demo booking — no real reservation until Resy/OpenTable are connected</div>}

      <div className="spacer" />
      {booking && (
        <div className="stack" style={{ gap: 10, position: 'relative' }}>
          <div className="row" style={{ gap: 10 }}>
            <a className="btn btn-gold" style={{ flex: 1 }} href={calendarLink(booking, isMovie ? 150 : 120)} target="_blank" rel="noreferrer"><Calendar size={18} /> Calendar</a>
            <a className="btn btn-cream" style={{ flex: 1 }} href={directions} target="_blank" rel="noreferrer"><Pin size={18} /> Directions</a>
          </div>
          <button className="link-btn" style={{ color: 'var(--cream)' }} onClick={async () => apply(await endSession(s.id))}>Done — we'll ask how it went after</button>
        </div>
      )}
    </div>
  );
}

function Confetti() {
  // Falling "sushi": tobiko dots, tamago blocks, cucumber rounds, salmon slices.
  const bits = useMemo(
    () =>
      Array.from({ length: 26 }, (_, i) => ({
        left: Math.random() * 100,
        delay: 0.4 + Math.random() * 0.8,
        dur: 2.2 + Math.random() * 1.6,
        kind: i % 4,
        rot: Math.random() * 180,
      })),
    [],
  );
  const style = (k: number) =>
    [
      { width: 10, height: 10, borderRadius: '50%', background: '#E8473F' },
      { width: 16, height: 10, borderRadius: 3, background: '#F0C53E' },
      { width: 14, height: 14, borderRadius: '50%', background: '#EEE0CA', boxShadow: 'inset 0 0 0 3px #9DAF6E' },
      { width: 18, height: 9, borderRadius: '50% / 60%', background: '#EC9177' },
    ][k];
  return (
    <div className="confetti" aria-hidden="true">
      {bits.map((b, i) => (
        <i key={i} style={{ left: `${b.left}%`, animationDuration: `${b.dur}s`, animationDelay: `${b.delay}s`, transform: `rotate(${b.rot}deg)`, ...style(b.kind) }} />
      ))}
    </div>
  );
}
