// Post-date review. Beli-style: pick a verdict, then a few "which was better?" comparisons
// place it in your ranked list (which sets the score). Yelp-style: tags, best dish, a note.
import { useMemo, useState } from 'react';
import type { Booking, RankedEntry, Verdict } from '../../../shared/types.ts';
import type { ScreenProps } from '../App.tsx';
import { api, fmtDay } from '../api.ts';
import { Plate } from '../components/Brand.tsx';
import { HomeButton } from '../components/HomeButton.tsx';

const TAGS = {
  dinner: ['Great food', 'Romantic', 'Great service', 'Cozy', 'Good value', 'Too loud', 'Slow service', 'Pricey', 'Would go back'],
  movie: ['Gripping', 'Funny', 'Beautiful', 'Made us talk', 'Too long', 'Great theater', 'Comfy seats', 'Would rewatch'],
};

const VERDICTS: { v: Verdict; label: string; face: string }[] = [
  { v: 'loved', label: 'Loved it', face: 'M8 14c2 3 6 3 8 0M8.5 9.5h.01M15.5 9.5h.01' },
  { v: 'fine', label: 'It was fine', face: 'M8 15h8M8.5 9.5h.01M15.5 9.5h.01' },
  { v: 'meh', label: 'Not for us', face: 'M8 16c2-2.5 6-2.5 8 0M8.5 9.5h.01M15.5 9.5h.01' },
];

type Step = 'verdict' | 'compare' | 'details' | 'done';

export function Rate({ state, apply, booking, onDone }: ScreenProps & { booking: Booking; onDone: () => void }) {
  const option = booking.option;
  const kind = option?.kind ?? 'dinner';
  const [step, setStep] = useState<Step>('verdict');
  const [verdict, setVerdict] = useState<Verdict>('loved');
  const [lo, setLo] = useState(0);
  const [hi, setHi] = useState(0);
  const [asked, setAsked] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [bestItem, setBestItem] = useState<string>();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const bucket = useMemo<RankedEntry[]>(
    () => state.myRanking.filter((r) => r.kind === kind && r.verdict === verdict && r.optionId !== booking.optionId),
    [state.myRanking, kind, verdict, booking.optionId],
  );

  function pickVerdict(v: Verdict) {
    setVerdict(v);
    const size = state.myRanking.filter((r) => r.kind === kind && r.verdict === v && r.optionId !== booking.optionId).length;
    setLo(0);
    setHi(size);
    setAsked(0);
    setStep(size > 0 ? 'compare' : 'details');
  }

  // Binary insertion: at most ~3 questions even with a long list.
  const mid = Math.floor((lo + hi) / 2);
  const rival = bucket[mid];
  function answer(newIsBetter: boolean | null) {
    let nlo = lo;
    let nhi = hi;
    if (newIsBetter === null) nlo = nhi = mid; // too close to call
    else if (newIsBetter) nhi = mid;
    else nlo = mid + 1;
    setLo(nlo);
    setHi(nhi);
    setAsked(asked + 1);
    if (nlo >= nhi || asked + 1 >= 3) {
      setLo(nlo);
      setStep('details');
    }
  }

  async function submit() {
    setBusy(true);
    try {
      apply(await api('/ratings', { confirmation: booking.confirmation, verdict, insertAt: lo, tags, bestItem, note }));
      setStep('done');
    } finally {
      setBusy(false);
    }
  }

  const fresh = state.ourList.find((p) => p.confirmation === booking.confirmation);
  const partner = state.partner!;

  return (
    <div className="screen" style={{ gap: 22 }}>
      <header className="row">
        <HomeButton onClick={onDone} />
        <div className="eyebrow">{fmtDay(booking.date)} · {booking.title}</div>
      </header>

      {step === 'verdict' && (
        <>
          <div className="stack" style={{ alignItems: 'center', textAlign: 'center', gap: 16 }}>
            <Plate option={option} size={168} />
            <div className="note" style={{ fontSize: 24 }}>so…</div>
            <h1 className="h1" style={{ fontSize: 34 }}>How was {booking.title}?</h1>
            <p className="lede">{partner.name} rates it separately. You'll see each other's take after you both answer.</p>
          </div>
          <div className="verdicts">
            {VERDICTS.map(({ v, label, face }) => (
              <button key={v} className={`verdict ${v}`} onClick={() => pickVerdict(v)}>
                <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" /><path d={face} />
                </svg>
                {label}
              </button>
            ))}
          </div>
        </>
      )}

      {step === 'compare' && rival && (
        <>
          <div className="stack" style={{ textAlign: 'center', alignItems: 'center' }}>
            <div className="note" style={{ fontSize: 22 }}>tough one {asked + 1}/{Math.min(3, Math.ceil(Math.log2(bucket.length + 1)))}</div>
            <h1 className="h1" style={{ fontSize: 32 }}>Which night was better?</h1>
          </div>
          <div className="versus">
            <button className="vs-card" onClick={() => answer(true)}>
              <Plate option={option} size={110} />
              <span className="t">{booking.title}</span>
              <span className="meta-sm">this time</span>
            </button>
            <span className="vs-seal">vs</span>
            <button className="vs-card" onClick={() => answer(false)}>
              <Plate photo={rival.photo} art={rival.art} seed={rival.optionId} size={110} />
              <span className="t">{rival.title}</span>
              <span className="meta-sm">your {rival.score.toFixed(1)}</span>
            </button>
          </div>
          <button className="link-btn" onClick={() => answer(null)}>Too close to call</button>
        </>
      )}

      {step === 'details' && (
        <>
          <div className="stack">
            <div className="note" style={{ fontSize: 22 }}>{verdict === 'loved' ? 'love that' : verdict === 'fine' ? 'noted' : 'oof, noted'} —</div>
            <h1 className="h1" style={{ fontSize: 32 }}>The details</h1>
          </div>
          <section className="stack">
            <div className="eyebrow">what stood out</div>
            <div className="wrap">
              {TAGS[kind].map((t) => (
                <button key={t} className="chip" aria-pressed={tags.includes(t)} onClick={() => setTags((x) => (x.includes(t) ? x.filter((y) => y !== t) : [...x, t]))}>{t}</button>
              ))}
            </div>
          </section>
          {kind === 'dinner' && option?.highlights.length ? (
            <section className="stack">
              <div className="eyebrow">best thing you ate</div>
              <div className="wrap">
                {option.highlights.map((h) => (
                  <button key={h.name} className="chip red" aria-pressed={bestItem === h.name} onClick={() => setBestItem(bestItem === h.name ? undefined : h.name)}>{h.name}</button>
                ))}
              </div>
            </section>
          ) : null}
          <div className="field">
            <label htmlFor="note">A note for future you <span className="muted" style={{ fontWeight: 400 }}>· optional</span></label>
            <textarea id="note" className="textarea" value={note} onChange={(e) => setNote(e.target.value)} placeholder={kind === 'dinner' ? 'Ask for the corner booth. Skip dessert, get another pasta.' : 'Sit closer next time.'} />
          </div>
          <div className="spacer" />
          <button className="btn btn-block" onClick={submit} disabled={busy}>{busy ? <span className="spinner" /> : null} Save our review</button>
        </>
      )}

      {step === 'done' && fresh && (
        <>
          <div className="stack" style={{ alignItems: 'center', textAlign: 'center', gap: 18, paddingTop: 12 }}>
            <div className="score-seal" style={{ color: verdict === 'loved' ? 'var(--tobiko)' : verdict === 'fine' ? '#9a7300' : 'var(--ink)', background: 'var(--cream)' }}>
              {fresh.mine?.score.toFixed(1)}
              <small>your score</small>
            </div>
            <h1 className="h1" style={{ fontSize: 30 }}>{booking.title} is #{state.myRanking.filter((r) => r.kind === kind).findIndex((r) => r.optionId === booking.optionId) + 1} on your list</h1>
            {fresh.partner ? (
              <p className="lede">{partner.name} gave it <b>{fresh.partner.score.toFixed(1)}</b>{fresh.partner.bestItem ? ` and loved the ${fresh.partner.bestItem.toLowerCase()}` : ''}. Together: <b>{fresh.together?.toFixed(1)}</b>.</p>
            ) : (
              <p className="lede">We'll show you {partner.name}'s score once they've rated it.</p>
            )}
          </div>
          {state.taste.into.length > 0 && (
            <div className="panel stack" style={{ gap: 8 }}>
              <div className="note">so next time we'll lean into…</div>
              <div className="taste">{state.taste.into.map((t) => <span key={t} className="tag" style={{ background: 'var(--peach)' }}>{t}</span>)}</div>
            </div>
          )}
          <div className="spacer" />
          <button className="btn btn-block" onClick={onDone}>Done</button>
        </>
      )}
    </div>
  );
}
