import { useCallback, useEffect, useRef, useState } from 'react';
import type { Option, Vote } from '../../../shared/types.ts';
import type { ScreenProps } from '../App.tsx';
import { api, fmtDay, fmtTime, fmtTimeShort } from '../api.ts';
import { CardArt } from '../components/CardArt.tsx';
import { Arrow, Close, Heart, Pin, Star } from '../components/Icons.tsx';
import { MiniMap } from '../components/MiniMap.tsx';
import { endSession } from './Home.tsx';

const THRESHOLD = 110;
const DOT_COLORS = ['#E8473F', '#F0C53E', '#9DAF6E', '#EC9177', '#EB6B3A'];

export function Swipe({ state, apply }: ScreenProps) {
  const s = state.session!;
  const partner = state.partner!;
  const [local, setLocal] = useState<Record<string, Vote>>({});
  const [leaving, setLeaving] = useState<{ id: string; vote: Vote } | null>(null);
  const [toast, setToast] = useState<string | null>(s.bookingError);

  useEffect(() => setToast(s.bookingError), [s.bookingError]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const voted = { ...s.myVotes, ...local };
  const remaining = s.deck.filter((o) => !voted[o.id]);
  const [top, next] = remaining;
  const done = s.deck.length - remaining.length;

  const send = useCallback(
    (option: Option, vote: Vote, note?: string) => {
      if (leaving) return;
      setLeaving({ id: option.id, vote });
      if (note) setToast(`You hearted ${note.length > 40 ? 'their review' : note}. ${partner.name} sees it only if you match.`);
      // Let the fly-out animation play, then commit.
      setTimeout(() => {
        setLocal((l) => ({ ...l, [option.id]: vote }));
        setLeaving(null);
        api(`/sessions/${s.id}/vote`, { optionId: option.id, vote, note }).then(apply).catch(() => {
          setLocal((l) => {
            const { [option.id]: _drop, ...rest } = l;
            return rest;
          });
          setToast("Couldn't save that swipe. Try again.");
        });
      }, 260);
    },
    [leaving, s.id, apply, partner.name],
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
    <div className="screen" style={{ gap: 14, paddingLeft: 14, paddingRight: 14 }}>
      <header className="swipe-top">
        <button className="icon-btn" onClick={quit} aria-label="End session"><Close size={18} /></button>
        <div style={{ textAlign: 'center', minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800 }}>{title}</div>
          <div className="meta-sm" style={{ fontSize: 12, fontWeight: 600 }}>
            {fmtTime(s.filters.windowStart)}–{fmtTime(s.filters.windowEnd)} · {Math.min(done + 1, s.deck.length)} of {s.deck.length}
          </div>
        </div>
        <div className="pill" aria-label={`${partner.name} has swiped ${s.partnerProgress} of ${s.deck.length}`}>
          <span className="pulse-dot" style={{ background: partner.color, animationPlayState: s.partnerProgress < s.deck.length ? 'running' : 'paused' }} />
          {partner.name} {s.partnerProgress}/{s.deck.length}
        </div>
      </header>

      <div className="deck">
        {top ? (
          <>
            {next && <div className="card behind" aria-hidden="true" />}
            <ProfileCard
              key={top.id}
              option={top}
              leaving={leaving?.id === top.id ? leaving.vote : null}
              onVote={(v, note) => send(top, v, note)}
            />
          </>
        ) : (
          <div className="empty stack" style={{ alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <div className="spinner" style={{ width: 32, height: 32 }} />
            <h2 className="h2" style={{ color: 'var(--ink)' }}>You're through the deck.</h2>
            <p className="lede">Waiting on {partner.name} — {s.deck.length - s.partnerProgress} cards to go. If you both said yes to something, you'll know instantly.</p>
          </div>
        )}
      </div>

      {top && (
        <>
          <div className="actions">
            <button className="act big" onClick={() => send(top, 'pass')} aria-label={`Pass on ${top.title}`}>
              <Close size={28} strokeWidth={3} />
            </button>
            <button className="act mid" onClick={() => send(top, 'super')} aria-label={`Must-try: ${top.title}`}>
              <Star size={24} />
            </button>
            <button className="act big yes" onClick={() => send(top, 'like')} aria-label={`Yes to ${top.title}`}>
              <Heart size={30} />
            </button>
          </div>
          <div className="hint">Scroll the card · swipe sideways · or heart {top.kind === 'movie' ? 'a review' : 'a dish'}</div>
        </>
      )}

      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

function ProfileCard({ option, leaving, onVote }: { option: Option; leaving: Vote | null; onVote: (v: Vote, note?: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState({ x: 0, y: 0, active: false });
  const start = useRef<{ x: number; y: number; axis: 'x' | 'y' | null; id: number } | null>(null);
  const isMovie = option.kind === 'movie';

  // Horizontal drags swipe; vertical drags scroll the profile (touch-action: pan-y).
  function onPointerDown(e: React.PointerEvent) {
    if ((e.target as HTMLElement).closest('button, a')) return;
    start.current = { x: e.clientX, y: e.clientY, axis: null, id: e.pointerId };
  }
  function onPointerMove(e: React.PointerEvent) {
    const st = start.current;
    if (!st) return;
    const dx = e.clientX - st.x;
    const dy = e.clientY - st.y;
    if (!st.axis) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      st.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      if (st.axis === 'x') ref.current?.setPointerCapture(st.id);
    }
    if (st.axis === 'x') setDrag({ x: dx, y: dy * 0.2, active: true });
  }
  function onPointerUp() {
    const st = start.current;
    start.current = null;
    if (!st || st.axis !== 'x') return;
    if (drag.x > THRESHOLD) onVote('like');
    else if (drag.x < -THRESHOLD) onVote('pass');
    else setDrag({ x: 0, y: 0, active: false });
  }

  let transform = `translate(${drag.x}px, ${drag.y}px) rotate(${drag.x / 18}deg)`;
  let transition = drag.active ? 'none' : 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)';
  if (leaving) {
    const [dx, dy] = leaving === 'like' ? [1, 0] : leaving === 'pass' ? [-1, 0] : [0, -1];
    transform = `translate(${dx * 600}px, ${dy * 900}px) rotate(${dx * 24}deg)`;
    transition = 'transform 0.28s ease-in';
  }
  const clamp = (n: number) => Math.max(0, Math.min(1, n));
  const yes = leaving === 'like' ? 1 : clamp(drag.x / THRESHOLD);
  const nope = leaving === 'pass' ? 1 : clamp(-drag.x / THRESHOLD);
  const must = leaving === 'super' ? 1 : 0;

  const slots = [...option.slots].sort((a, b) => a.time.localeCompare(b.time));
  const firstLast = slots.length ? `${fmtTimeShort(slots[0].time)}${slots.length > 1 ? `–${fmtTimeShort(slots[slots.length - 1].time)}` : ''}` : '';
  const [genre, runtime] = isMovie ? [option.subtitle.split(' · ')[0], option.subtitle.split(' · ')[1]] : ['', ''];
  const cuisine = option.subtitle.split(' · ')[0];

  return (
    <div
      ref={ref}
      className="card top"
      style={{ transform, transition }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => { start.current = null; setDrag({ x: 0, y: 0, active: false }); }}
      role="group"
      aria-roledescription="profile card"
      aria-label={`${option.title}, ${option.subtitle}`}
    >
      <div className="stamp yes" style={{ opacity: yes }}>Yes!</div>
      <div className="stamp nope" style={{ opacity: nope }}>Nah</div>
      <div className="stamp must" style={{ opacity: must }}>Must-try</div>

      <div className="card-scroll">
        {/* Hero */}
        <CardArt option={option} className="hero">
          {(option.badges.length > 0 || (!isMovie && option.tags.length > 0)) && (
            <div className="card-badges">
              {option.badges.map((b) => <span key={b} className="sticker gold tilt">{b}</span>)}
              {!isMovie && option.tags.slice(0, 2).map((t, i) => <span key={t} className={`sticker${i === 0 ? ' tilt' : ''}`}>{t}</span>)}
            </div>
          )}
          <div className="rating-badge" aria-label={`Rated ${option.rating} on ${option.ratingSource}`}>
            <b>{option.rating.toFixed(1)}</b>
            <small>{option.ratingSource}</small>
          </div>
          <div className="hero-title" style={{ color: option.art.fg }}>
            {option.title}
            <div className="hero-sub">{isMovie ? `${genre} · ${option.tags[0]}` : `${cuisine} · ${option.areaName}`}</div>
          </div>
        </CardArt>

        {/* Quick facts */}
        <div className="facts">
          {!isMovie && option.price ? <span className="fact price" aria-label={`Price level ${option.price} of 4`}>{'$'.repeat(option.price)}<span style={{ opacity: 0.35 }}>{'$'.repeat(4 - option.price)}</span></span> : null}
          {isMovie && <span className="fact">{runtime}</span>}
          {option.distanceMi != null && <span className="fact"><Pin size={14} /> {option.distanceMi} mi away</span>}
          {firstLast && <span className="fact">{isMovie ? 'Showing' : 'Open'} {firstLast}</span>}
          {option.providers[0] && <span className="fact">via {option.providers.join(' / ')}</span>}
        </div>

        {/* Prompt: the vibe */}
        <section className="section tint-salmon">
          <div className="section-label">{isMovie ? 'The pitch' : 'The vibe'}</div>
          <div className="prompt">{option.blurb}</div>
          <HeartBtn label={isMovie ? 'the pitch' : 'the vibe'} onClick={() => onVote('like', isMovie ? 'the pitch' : 'the vibe')} corner />
        </section>

        {/* Menu highlights / why watch */}
        <section className="section">
          <div className="section-label">{isMovie ? 'Why watch' : 'Order this'}</div>
          {option.highlights.map((d, i) => (
            <div className="dish" key={d.name}>
              {!isMovie && <span className="dish-dot" style={{ background: DOT_COLORS[(i + option.id.length) % DOT_COLORS.length] }} aria-hidden="true" />}
              <div className="grow">
                <div className="dish-name">{d.name}{d.tag && <span className="tag-mini">{d.tag}</span>}</div>
                <div className="meta-sm">{d.desc}</div>
              </div>
              {d.price && <span className="dish-price">{d.price}</span>}
              {!isMovie && <HeartBtn label={d.name} onClick={() => onVote('like', d.name)} />}
            </div>
          ))}
        </section>

        {/* Reviews */}
        <section className="section tint-yellow">
          <div className="section-label">What people say</div>
          {option.reviews.map((r) => (
            <div className="review" key={r.text} style={{ position: 'relative' }}>
              <div className="review-text">{r.text}</div>
              <div className="row meta-sm" style={{ gap: 8, marginTop: 6 }}>
                <span className="stars" aria-label={`${r.stars} stars`}>{Array.from({ length: Math.round(r.stars) }, (_, i) => <Star key={i} size={12} />)}</span>
                <span style={{ fontWeight: 700 }}>{r.author}</span> · {r.when} · {r.source}
              </div>
              <HeartBtn label={`${r.author}'s review`} onClick={() => onVote('like', `${r.author}'s review`)} style={{ position: 'absolute', right: 0, top: 0 }} />
            </div>
          ))}
        </section>

        {/* Times */}
        <section className="section">
          <div className="section-label">{isMovie ? 'Showtimes in your window' : 'Tables in your window'}</div>
          <div className="wrap">
            {slots.slice(0, 8).map((sl) => (
              <span key={sl.id} className="slot-chip">
                {fmtTimeShort(sl.time)}
                {isMovie && sl.label ? <span className="muted" style={{ fontWeight: 600 }}> · {sl.label.split(' · ')[1]}</span> : sl.label ? <span className="muted" style={{ fontWeight: 600 }}> · bar</span> : null}
              </span>
            ))}
          </div>
        </section>

        {/* Location */}
        {option.distanceMi != null && (
          <section className="section tint-cream">
            <div className="section-label">Where</div>
            <MiniMap seed={option.id} distanceMi={option.distanceMi} from={option.areaName} to={option.title} />
            <div className="row" style={{ marginTop: 10, gap: 8, alignItems: 'flex-start' }}>
              <Pin size={18} className="ember" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <div style={{ fontWeight: 800 }}>{option.address}</div>
                <div className="meta-sm">{option.distanceMi} mi from {option.areaName} · about {Math.max(2, Math.round(option.distanceMi * 20))} min walk</div>
              </div>
            </div>
          </section>
        )}

        {/* Links */}
        <div className="wrap" style={{ padding: '14px 14px 0' }}>
          {option.links.map((l) => (
            <a key={l.label} className="link-pill" href={l.url} target="_blank" rel="noreferrer">
              {l.label} <Arrow size={14} />
            </a>
          ))}
        </div>
        <div className="card-end" />
      </div>
    </div>
  );
}

function HeartBtn({ label, onClick, corner, style }: { label: string; onClick: () => void; corner?: boolean; style?: React.CSSProperties }) {
  return (
    <button className={`heart-btn${corner ? ' corner' : ''}`} onClick={onClick} aria-label={`Like — heart ${label}`} style={style}>
      <Heart size={20} />
    </button>
  );
}
