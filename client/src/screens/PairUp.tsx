// Two ways to play: both on one phone (pass-and-play), or two linked phones (invite code) so you
// can swipe at different times and from different places.
import { useEffect, useState, type FormEvent } from 'react';
import type { ScreenProps } from '../App.tsx';
import { api, LOCAL, rememberOnDevice } from '../api.ts';
import { Logo } from '../components/Brand.tsx';
import { Share, User } from '../components/Icons.tsx';

type Way = 'one' | 'two';

export function PairUp({ state, apply, openProfile }: ScreenProps) {
  const fromLink = new URLSearchParams(location.search).get('join') ?? '';
  const [way, setWay] = useState<Way>(fromLink ? 'two' : LOCAL ? 'one' : 'two');
  const [code, setCode] = useState(fromLink.toUpperCase());
  const [partnerName, setPartnerName] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!state.couple && !fromLink) api('/couple', {}).then(apply).catch(() => {});
  }, [state.couple, fromLink, apply]);

  useEffect(() => {
    if (fromLink.length === 6) join();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function join(e?: FormEvent) {
    e?.preventDefault();
    if (code.trim().length !== 6) return setError('Codes are 6 characters.');
    setBusy(true);
    try {
      apply(await api('/couple/join', { code }));
      history.replaceState(null, '', location.pathname + location.search.replace(/[?&]join=[^&]*/, ''));
    } catch (err) {
      setError((err as Error).message);
      if (!state.couple) api('/couple', {}).then(apply).catch(() => {});
    } finally {
      setBusy(false);
    }
  }

  async function addHere(e: FormEvent) {
    e.preventDefault();
    try {
      const s = await api('/couple/local-partner', { name: partnerName });
      if (s.partner) rememberOnDevice(s.partner.id);
      apply(s);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function share() {
    const invite = state.couple?.inviteCode ?? '';
    const url = `${location.origin}/?join=${invite}`;
    const text = `Date night? Join me on Date Night with code ${invite}`;
    try {
      if (navigator.share) await navigator.share({ title: 'Date Night', text, url });
      else {
        await navigator.clipboard.writeText(`${text}: ${url}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      /* dismissed */
    }
  }

  const invite = state.couple?.inviteCode ?? '······';

  return (
    <div className="screen">
      <header className="row" style={{ justifyContent: 'space-between' }}>
        <Logo />
        <button className="icon-btn" onClick={openProfile} aria-label="Profile and settings" title="Profile"><User /></button>
      </header>
      <div className="stack">
        <div className="note" style={{ fontSize: 22 }}>hi {state.me.name} —</div>
        <h1 className="h1">It takes <span className="hl">two</span> to pick.</h1>
        <p className="lede">You each swipe privately. You only ever see what you both said yes to.</p>
      </div>

      <div className="ways" role="tablist" aria-label="How you'll play">
        <button role="tab" aria-selected={way === 'one'} className="way" onClick={() => { setWay('one'); setError(''); }}>
          <PhonesIcon n={1} />
          <span className="way-title">Same phone</span>
          <span className="way-sub">Sitting together. Swipe, then pass it over.</span>
        </button>
        <button role="tab" aria-selected={way === 'two'} className="way" onClick={() => { setWay('two'); setError(''); }}>
          <PhonesIcon n={2} />
          <span className="way-title">Two phones</span>
          <span className="way-sub">Link accounts. Swipe anytime, from anywhere.</span>
        </button>
      </div>

      {way === 'one' && (
        <form className="panel stack" style={{ gap: 14 }} onSubmit={addHere}>
          <div className="field">
            <label htmlFor="pname">Your partner's first name</label>
            <input id="pname" className="input" style={{ background: 'var(--peach)' }} value={partnerName} onChange={(e) => { setPartnerName(e.target.value); setError(''); }} placeholder="Sam" />
          </div>
          <button className="btn btn-red btn-block">Play on this phone</button>
          <div className="meta-sm" style={{ textAlign: 'center' }}>We'll cover the screen between turns. No peeking.</div>
        </form>
      )}

      {way === 'two' && LOCAL && (
        <div className="panel stack" style={{ gap: 8 }}>
          <div className="note">needs the online version</div>
          <p className="lede" style={{ fontSize: 15 }}>This offline build can't link two phones. Install the beta (or open the web link) on both phones to pair with a code.</p>
        </div>
      )}

      {way === 'two' && !LOCAL && (
        <>
          <section className="panel stack" style={{ alignItems: 'center', gap: 18 }} aria-label="Your invite code">
            <div className="eyebrow">send them your code</div>
            <div className="code-grid" aria-label={invite.split('').join(' ')}>
              {invite.split('').map((c, i) => <div key={i} className="code-cell" aria-hidden="true">{c}</div>)}
            </div>
            <button className="btn btn-red btn-block" onClick={share} disabled={!state.couple}><Share size={18} /> {copied ? 'Link copied' : 'Share invite link'}</button>
            <div className="row" style={{ gap: 8, fontSize: 13, color: 'var(--muted)' }} aria-live="polite"><span className="pulse-dot" /> waiting for your partner…</div>
          </section>
          <div className="divider">or</div>
          <form className="field" onSubmit={join}>
            <label htmlFor="code">Have their code?</label>
            <div className="row" style={{ gap: 8 }}>
              <input id="code" className="input code-input" maxLength={6} autoComplete="off" autoCapitalize="characters" value={code} onChange={(e) => { setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')); setError(''); }} placeholder="6 chars" />
              <button className="btn btn-sm" style={{ height: 54, borderRadius: 16 }} disabled={busy}>Join</button>
            </div>
          </form>
        </>
      )}

      {error && <div role="alert" style={{ color: 'var(--tobiko-ink)', fontSize: 14, fontWeight: 700 }}>{error}</div>}

      <div className="spacer" />
      <button className="link-btn" onClick={() => api('/couple/demo', {}).then(apply)}>
        No one handy? <span style={{ color: 'var(--ink)', textDecoration: 'underline', fontWeight: 700 }}>Try it with a demo partner</span>
      </button>
    </div>
  );
}

function PhonesIcon({ n }: { n: 1 | 2 }) {
  return (
    <svg width="44" height="34" viewBox="0 0 44 34" aria-hidden="true">
      {n === 1 ? (
        <rect x="14" y="2" width="16" height="30" rx="4" fill="#1A1414" />
      ) : (
        <>
          <rect x="4" y="5" width="15" height="27" rx="4" fill="#1A1414" transform="rotate(-8 11 18)" />
          <rect x="25" y="2" width="15" height="27" rx="4" fill="#E8473F" transform="rotate(8 32 16)" />
        </>
      )}
    </svg>
  );
}
