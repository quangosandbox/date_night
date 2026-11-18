import { useCallback, useEffect, useRef, useState } from 'react';
import type { Option, Vote } from '../../../shared/types.ts';
import type { ScreenProps } from '../App.tsx';
import { api, fmtDay, fmtTime, fmtTimeShort } from '../api.ts';
import { onThisDevice } from '../api.ts';
import { Chopsticks, Photo } from '../components/Brand.tsx';
import { Arrow, Close, Heart, Pin, Star } from '../components/Icons.tsx';
import { HomeButton } from '../components/HomeButton.tsx';
import { MiniMap } from '../components/MiniMap.tsx';
import { endSession } from './Home.tsx';

const THRESHOLD = 110;
const DOTS = ['#E8473F', '#F0C53E', '#9DAF6E', '#EC9177', '#EB6B3A'];

export function Swipe({ state, apply, switchTo, goHome }: ScreenProps) {
  const s = state.session!;
  const partner = state.partner!;
  const [local, setLocal] = useState<Record<string, Vote>>({});
  const [leaving, setLeaving] = useState<{ id: string; vote: Vote } | null>(null);
  const [toast, setToast] = useState<string | null>(s.bookingError);
  const passAndPlay = !partner.isBot && onThisDevice(partner.id);

  useEffect(() => setToast(s.bookingError), [s.bookingError]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);
  // New identity (pass-and-play hand-off) → forget the previous person's optimistic swipes.
  useEffect(() => setLocal({}), [state.me.id]);

  const voted = { ...s.myVotes, ...local };
  const remaining = s.deck.filter((o) => !voted[o.id]);
  const [top, next] = remaining;
  const done = s.deck.length - remaining.length;

  const send = useCallback(
    (option: Option, vote: Vote, note?: string) => {
      if (leaving) return;
      setLeaving({ id: option.id, vote });
      if (note) setToast(`You hearted ${/review|vibe|pitch/.test(note) ? note : `the ${note.toLowerCase()}`}. ${partner.name} only sees it if you match.`);
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

  // Two taps to end (no system dialogs: the artifact viewer and iOS web views block confirm()).
  const [armed, setArmed] = useState(false);
  async function quit() {
    if (!armed) {
      setArmed(true);
      setToast(`Tap ✕ again to end this for you and ${partner.name}.`);
      setTimeout(() => setArmed(false), 3500);
      return;
    }
    apply(await endSession(s.id));
  }

  const sticks = Math.min(s.deck.length, 24);

  return (
    <div className="screen" style={{ gap: 14, paddingLeft: 14, paddingRight: 14 }}>
      <header className="swipe-top">
        <div className="row" style={{ gap: 6, flexShrink: 0 }}>
          <HomeButton onClick={goHome} />
          <button className="icon-btn" onClick={quit} aria-label={armed ? 'Tap again to end session' : 'End session'} title="End session" style={armed ? { background: 'var(--tobiko)' } : undefined}><Close size={18} /></button>
        </div>
        <div style={{ flex: 1, minWidth: 0, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontFamily: 'var(--display)', fontSize: 15 }}>
            {s.mode === 'dinner' ? 'Dinner' : 'Movie'} · {fmtDay(s.filters.date).toLowerCase()}
          </div>
          <div className="progress-sticks" aria-label={`Card ${Math.min(done + 1, s.deck.length)} of ${s.deck.length}`}>
            {Array.from({ length: sticks }, (_, i) => <i key={i} className={i < Math.round((done / s.deck.length) * sticks) ? 'on' : ''} />)}
          </div>
        </div>
        {passAndPlay ? (
          <button className="pill" onClick={() => switchTo(partner.id)} aria-label={`Hand the phone to ${partner.name}`}>
            Pass to {partner.name} <Arrow size={14} />
          </button>
        ) : (
          <div className="pill" aria-label={`${partner.name} has swiped ${s.partnerProgress} of ${s.deck.length}`}>
            <span className="pulse-dot" style={{ background: partner.color, animationPlayState: s.partnerProgress < s.deck.length ? 'running' : 'paused' }} />
            {partner.name} {s.partnerProgress}/{s.deck.length}
          </div>
        )}
      </header>

      <div className="deck">
        {top ? (
          <>
            {next && <div className="card behind" aria-hidden="true" />}
            <ProfileCard key={top.id} option={top} leaving={leaving?.id === top.id ? leaving.vote : null} onVote={(v, note) => send(top, v, note)} />
          </>
        ) : (
          <div className="stack" style={{ alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center', gap: 14 }}>
            <Chopsticks size={64} color="#1A1414" />
            <h2 className="h2">You're through the deck.</h2>
            <p className="lede">
              {passAndPlay
                ? `Your turn's done — hand the phone to ${partner.name}.`
                : `Waiting on ${partner.name} — ${s.deck.length - s.partnerProgress} to go. If you both said yes to something, you'll know instantly.`}
            </p>
            {passAndPlay && <button className="btn btn-red" onClick={() => switchTo(partner.id)}>Pass to {partner.name}</button>}
          </div>
        )}
      </div>

      {top && (
        <>
          <div className="actions">
            <button className="act big pass" onClick={() => send(top, 'pass')} aria-label={`Pass on ${top.title}`}><Close size={28} strokeWidth={3} /></button>
            <button className="act mid" onClick={() => send(top, 'super')} aria-label={`Must-try: ${top.title}`}><Star size={24} /></button>
            <button className="act big yes" onClick={() => send(top, 'like')} aria-label={`Yes to ${top.title}`}><Heart size={30} /></button>
          </div>
          <div className="hint">scroll · swipe · heart {top.kind === 'movie' ? 'a review' : top.highlights.length ? 'a dish' : 'the vibe'}</div>
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
  const span = slots.length ? `${fmtTimeShort(slots[0].time)}${slots.length > 1 ? `–${fmtTimeShort(slots[slots.length - 1].time)}` : ''}` : '';
  const [genre, runtime] = option.subtitle.split(' · ');
  const hasPhoto = option.photos.length > 0;

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
      <div className="hanko yes" style={{ opacity: yes }}>YES<br />please</div>
      <div className="hanko nope" style={{ opacity: nope }}>NAH</div>
      <div className="hanko must" style={{ opacity: must }}>MUST<br />TRY</div>

      <div className="card-scroll">
        <div className="hero">
          <Photo option={option} poster={isMovie} />
          {(hasPhoto || !isMovie) && <div className="hero-scrim" />}
          <div className="hero-badges">
            {option.badges.map((b) => <span key={b} className="sticker gold">{b}</span>)}
            {!isMovie && option.tags.slice(0, 2).map((t) => <span key={t} className="sticker">{t}</span>)}
          </div>
          <div className="rating-seal" aria-label={`Rated ${option.rating} on ${option.ratingSource}`}>
            <b>{option.rating.toFixed(1)}</b>
            <small>{option.ratingSource}</small>
          </div>
          {!(isMovie && !hasPhoto) && (
            <div className="hero-text">
              <div className="hero-title">{option.title}</div>
              <div className="hero-sub">{isMovie ? `${genre} · ${option.tags[0]}` : `${genre} · ${option.areaName}`}</div>
            </div>
          )}
        </div>

        {option.why && <div className="why note">↳ {option.why.charAt(0).toLowerCase() + option.why.slice(1)}</div>}

        <div className="facts">
          {!isMovie && option.price ? (
            <span className="fact price" aria-label={`Price level ${option.price} of 4`}>
              {'$'.repeat(option.price)}<span style={{ opacity: 0.35 }}>{'$'.repeat(4 - option.price)}</span>
            </span>
          ) : null}
          {isMovie && <span className="fact">{runtime}</span>}
          {option.distanceMi != null && <span className="fact"><Pin size={14} /> {option.distanceMi} mi</span>}
          {span && <span className="fact">{isMovie ? 'showing' : option.handoff ? 'open' : 'tables'} {span}</span>}
          {option.providers[0] && <span className="fact">via {option.providers.join(' / ')}</span>}
          {option.handoff?.reservable && <span className="fact">takes reservations</span>}
        </div>

        <section className="section salmon">
          <div className="section-label">{isMovie ? 'the pitch' : 'the vibe'}</div>
          <div className="prompt">{option.blurb}</div>
          <HeartBtn label={isMovie ? 'the pitch' : 'the vibe'} onClick={() => onVote('like', isMovie ? 'the pitch' : 'the vibe')} corner />
        </section>

        {option.photos[1] && <Photo option={option} index={1} className="inline-photo" />}

        {option.highlights.length > 0 && (
        <section className="section rice">
          <div className="section-label">{isMovie ? 'why watch' : 'order this'}</div>
          {option.highlights.map((d, i) => (
            <div className="dish" key={d.name}>
              {!isMovie && (
                <span className="plate" style={{ width: 40, height: 40 }} aria-hidden="true">
                  <span style={{ background: DOTS[(i + option.id.length) % DOTS.length] }} />
                </span>
              )}
              <div className="grow">
                <div className="dish-name">{d.name}{d.tag && <span className="tag-mini">← {d.tag.toLowerCase()}</span>}</div>
                <div className="meta-sm">{d.desc}</div>
              </div>
              {d.price && <span className="dish-price">{d.price}</span>}
              {!isMovie && <HeartBtn label={d.name} onClick={() => onVote('like', d.name)} />}
            </div>
          ))}
        </section>
        )}

        {option.reviews.length > 0 && (
        <section className="section tamago">
          <div className="section-label">what people say</div>
          {option.reviews.map((r) => (
            <div className="review" key={r.text}>
              <div className="review-text">“{r.text}”</div>
              <div className="review-by">
                <span className="stars" aria-label={`${r.stars} stars`}>{Array.from({ length: Math.round(r.stars) }, (_, i) => <Star key={i} size={12} />)}</span>
                — {r.authorUrl ? <a href={r.authorUrl} target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>{r.author}</a> : r.author}{r.when ? `, ${r.when}` : ''}
              </div>
              <HeartBtn label={`${r.author}'s review`} onClick={() => onVote('like', `${r.author}'s review`)} style={{ position: 'absolute', right: 0, top: 0 }} />
            </div>
          ))}
        </section>
        )}

        <section className="section">
          <div className="section-label">{isMovie ? 'showtimes in your window' : option.handoff ? 'open for dinner at' : 'tables in your window'}</div>
          <div className="wrap">
            {slots.slice(0, 8).map((sl) => (
              <span key={sl.id} className="slot-chip" style={{ background: 'var(--rice)' }}>
                {fmtTime(sl.time)}
                {isMovie && sl.label ? ` · ${sl.label.split(' · ')[1]}` : sl.label ? ' · bar' : ''}
              </span>
            ))}
          </div>
        </section>

        {option.distanceMi != null && (
          <section className="section rice">
            <div className="section-label">where</div>
            <MiniMap seed={option.id} distanceMi={option.distanceMi} from={option.areaName} to={option.title} />
            <div style={{ marginTop: 12 }}>
              <div style={{ fontWeight: 700 }}>{option.address}</div>
              <div className="meta-sm">{option.distanceMi} mi from {option.areaName} · about {Math.max(2, Math.round(option.distanceMi * 20))} min walk</div>
            </div>
          </section>
        )}

        <div className="wrap" style={{ padding: '16px 14px 0' }}>
          {option.links.map((l) => (
            <a key={l.label} className="link-pill" href={l.url} target="_blank" rel="noreferrer">{l.label} <Arrow size={14} /></a>
          ))}
        </div>
        {option.dataAttribution && <div className="attribution">Place info, photos and reviews from {option.dataAttribution}</div>}
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
