import { useCallback, useEffect, useRef, useState } from 'react';
import type { Option, Vote } from '../../../shared/types.ts';
import type { ScreenProps } from '../App.tsx';
import { api, fmtDay, fmtTime, fmtTimeShort } from '../api.ts';
import { CardArt } from '../components/CardArt.tsx';
import { Close, Heart, Star } from '../components/Icons.tsx';
import { endSession } from './Home.tsx';

const THRESHOLD = 110;

export function Swipe({ state, apply }: ScreenProps) {
  const s = state.session!;
  const partner = state.partner!;
  const [local, setLocal] = useState<Record<string, Vote>>({});
  const [leaving, setLeaving] = useState<{ id: string; vote: Vote } | null>(null);
  const [toast, setToast] = useState<string | null>(s.bookingError);

  useEffect(() => setToast(s.bookingError), [s.bookingError]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  const voted = { ...s.myVotes, ...local };
  const remaining = s.deck.filter((o) => !voted[o.id]);
  const [top, next] = remaining;
  const done = s.deck.length - remaining.length;

  const send = useCallback(
    (option: Option, vote: Vote) => {
      if (leaving) return;
      setLeaving({ id: option.id, vote });
      // Let the fly-out animation play, then commit.
      setTimeout(() => {
        setLocal((l) => ({ ...l, [option.id]: vote }));
        setLeaving(null);
        api(`/sessions/${s.id}/vote`, { optionId: option.id, vote }).then(apply).catch(() => {
          setLocal((l) => {
            const { [option.id]: _drop, ...rest } = l;
            return rest;
          });
          setToast("Couldn't save that swipe. Try again.");
        });
      }, 260);
    },
    [leaving, s.id, apply],
  );

  // Keyboard: ← pass, → like, ↑ must-try
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!top || (e.target as HTMLElement).closest('input, select, textarea')) return;
      if (e.key === 'ArrowLeft') send(top, 'pass');
      else if (e.key === 'ArrowRight') send(top, 'like');
      else if (e.key === 'ArrowUp') send(top, 'super');
      else return;
      e.preventDefault();
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [top, send]);

  async function quit() {
    if (!confirm(`End this session for you and ${partner.name}?`)) return;
    apply(await endSession(s.id));
  }

  const title = `${s.mode === 'dinner' ? 'Dinner' : 'Movie'} · ${fmtDay(s.filters.date)}`;

  return (
    <div className="screen" style={{ gap: 14, paddingLeft: 16, paddingRight: 16 }}>
      <header className="swipe-top">
        <button className="icon-btn" onClick={quit} aria-label="End session"><Close size={18} /></button>
        <div style={{ textAlign: 'center', minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{title}</div>
          <div className="meta-sm" style={{ fontSize: 12 }}>
            {fmtTime(s.filters.windowStart)}–{fmtTime(s.filters.windowEnd)} · {Math.min(done + 1, s.deck.length)} of {s.deck.length}
          </div>
        </div>
        <div className="pill" aria-label={`${partner.name} has swiped ${s.partnerProgress} of ${s.deck.length}`}>
          <span className="pulse-dot" style={{ background: partner.color, animationPlayState: s.partnerProgress < s.deck.length ? 'running' : 'paused' }} />
          {partner.name} {s.partnerProgress}/{s.deck.length}
        </div>
      </header>

      <div className="deck" aria-live="polite">
        {top ? (
          <>
            {next && <Card key={next.id} option={next} position="behind" />}
            <Card
              key={top.id}
              option={top}
              position="top"
              leaving={leaving?.id === top.id ? leaving.vote : null}
              onVote={(v) => send(top, v)}
            />
          </>
        ) : (
          <div className="empty stack" style={{ alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <div className="spinner" style={{ width: 28, height: 28 }} />
            <h2 className="h2" style={{ color: 'var(--text)' }}>You're through the deck.</h2>
            <p className="lede">Waiting on {partner.name} — {s.deck.length - s.partnerProgress} cards to go. If you both said yes to something, you'll know instantly.</p>
          </div>
        )}
      </div>

      {top && (
        <>
          <div className="actions">
            <button className="act big" onClick={() => send(top, 'pass')} aria-label={`Pass on ${top.title}`}>
              <Close size={26} className="muted" strokeWidth={2.4} />
            </button>
            <button className="act mid" onClick={() => send(top, 'super')} aria-label={`Must-try: ${top.title}`}>
              <Star size={22} className="gold" />
            </button>
            <button className="act big yes" onClick={() => send(top, 'like')} aria-label={`Yes to ${top.title}`}>
              <Heart size={28} style={{ color: 'var(--ink)' }} />
            </button>
          </div>
          <div className="hint">Drag, tap, or use ← ↑ → keys</div>
        </>
      )}

      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

function Card({ option, position, leaving, onVote }: { option: Option; position: 'top' | 'behind'; leaving?: Vote | null; onVote?: (v: Vote) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState({ x: 0, y: 0, active: false });
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const isTop = position === 'top';

  function onPointerDown(e: React.PointerEvent) {
    if (!isTop || (e.target as HTMLElement).closest('button')) return;
    startRef.current = { x: e.clientX, y: e.clientY };
    ref.current?.setPointerCapture(e.pointerId);
    setDrag({ x: 0, y: 0, active: true });
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!startRef.current) return;
    setDrag({ x: e.clientX - startRef.current.x, y: e.clientY - startRef.current.y, active: true });
  }
  function onPointerUp() {
    if (!startRef.current) return;
    startRef.current = null;
    const { x, y } = drag;
    if (x > THRESHOLD) onVote?.('like');
    else if (x < -THRESHOLD) onVote?.('pass');
    else if (y < -THRESHOLD && Math.abs(x) < THRESHOLD) onVote?.('super');
    else setDrag({ x: 0, y: 0, active: false });
  }

  let transform = `translate(${drag.x}px, ${drag.y}px) rotate(${drag.x / 18}deg)`;
  let transition = drag.active ? 'none' : 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)';
  if (leaving) {
    const dir = leaving === 'like' ? [1, 0] : leaving === 'pass' ? [-1, 0] : [0, -1];
    transform = `translate(${dir[0] * 600}px, ${dir[1] * 800 + drag.y * (dir[1] ? 0 : 1)}px) rotate(${dir[0] * 24}deg)`;
    transition = 'transform 0.28s ease-in, opacity 0.28s ease-in';
  }
  const yes = leaving === 'like' ? 1 : Math.max(0, Math.min(1, drag.x / THRESHOLD));
  const nope = leaving === 'pass' ? 1 : Math.max(0, Math.min(1, -drag.x / THRESHOLD));
  const must = leaving === 'super' ? 1 : Math.max(0, Math.min(1, -drag.y / THRESHOLD)) * (Math.abs(drag.x) < THRESHOLD ? 1 : 0);

  const best = [...option.slots].sort((a, b) => a.time.localeCompare(b.time));
  const shown = best.slice(0, 5);

  return (
    <div
      ref={ref}
      className={`card ${position}`}
      style={isTop ? { transform, transition } : undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      aria-hidden={!isTop}
      role={isTop ? 'group' : undefined}
      aria-roledescription={isTop ? 'card' : undefined}
      aria-label={isTop ? `${option.title}. ${option.subtitle}. Rated ${option.rating} on ${option.ratingSource}.` : undefined}
    >
      <CardArt option={option} poster={option.kind === 'movie'} />
      {(option.badges.length > 0 || option.tags.length > 0) && (
        <div className="card-badges">
          {option.badges.map((b) => <span key={b} className="badge gold">{b}</span>)}
          {option.kind === 'dinner' && option.tags.slice(0, 2).map((t) => <span key={t} className="badge">{t}</span>)}
        </div>
      )}
      <div className="stamp yes" style={{ opacity: yes }}>YES</div>
      <div className="stamp nope" style={{ opacity: nope }}>NOPE</div>
      <div className="stamp must" style={{ opacity: must }}>MUST-TRY</div>

      <div className="card-info">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div className="card-title" style={option.kind === 'movie' ? { fontSize: 22, fontFamily: 'var(--sans)', fontWeight: 600 } : undefined}>
            {option.kind === 'movie' ? `${option.tags[0]} · ${option.subtitle.split(' · ')[1]}` : option.title}
          </div>
          <span className="rating" aria-label={`${option.rating} out of 5 on ${option.ratingSource}`}>
            <Star size={14} />{option.rating.toFixed(1)}
          </span>
        </div>
        <div className="meta-sm" style={{ fontSize: 14, marginTop: -4 }}>
          {option.kind === 'movie'
            ? `${option.subtitle.split(' · ')[0]} · ${option.subtitle.split(' · ')[2]}`
            : `${option.subtitle} · ${option.providers.join(' / ')}`}
        </div>
        <p className="lede" style={{ fontSize: 14, color: 'var(--text)', opacity: 0.85 }}>{option.blurb}</p>
        <div className="wrap" aria-label="Open times">
          {shown.map((sl) => (
            <span key={sl.id} className="slot-chip" title={sl.label}>
              {fmtTimeShort(sl.time)}
              {option.kind === 'movie' && sl.label ? <span className="muted" style={{ fontWeight: 500 }}> · {sl.label.split(' · ')[1]}</span> : null}
            </span>
          ))}
          {best.length > shown.length && <span className="slot-chip muted">+{best.length - shown.length}</span>}
        </div>
      </div>
    </div>
  );
}
