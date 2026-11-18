import { useEffect, useState, type FormEvent } from 'react';
import type { ScreenProps } from '../App.tsx';
import { api } from '../api.ts';
import { Logo } from '../components/Brand.tsx';
import { Share } from '../components/Icons.tsx';

export function PairUp({ state, apply }: ScreenProps) {
  const fromLink = new URLSearchParams(location.search).get('join') ?? '';
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
      apply(await api('/couple/local-partner', { name: partnerName }));
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
      <Logo />
      <div className="stack">
        <div className="note" style={{ fontSize: 22 }}>hi {state.me.name} —</div>
        <h1 className="h1">It takes <span className="hl">two</span> to pick.</h1>
        <p className="lede">You each swipe privately. You only ever see what you both said yes to.</p>
      </div>

      {state.localMode ? (
        <form className="panel stack" style={{ gap: 14 }} onSubmit={addHere}>
          <div className="note">both on this phone?</div>
          <div className="field">
            <label htmlFor="pname">Your partner's first name</label>
            <input id="pname" className="input" style={{ background: 'var(--peach)' }} value={partnerName} onChange={(e) => { setPartnerName(e.target.value); setError(''); }} placeholder="Sam" />
          </div>
          <button className="btn btn-red btn-block">Pass-and-play together</button>
          <div className="meta-sm" style={{ textAlign: 'center' }}>Swipe, then hand the phone over. No peeking.</div>
          {error && <div role="alert" style={{ color: 'var(--tobiko-ink)', fontSize: 14, fontWeight: 700 }}>{error}</div>}
        </form>
      ) : (
        <>
          <section className="panel stack" style={{ alignItems: 'center', gap: 18 }} aria-label="Your invite code">
            <div className="eyebrow">your invite code</div>
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
            {error && <div role="alert" style={{ color: 'var(--tobiko-ink)', fontSize: 14, fontWeight: 700 }}>{error}</div>}
          </form>
        </>
      )}

      <div className="spacer" />
      <button className="link-btn" onClick={() => api('/couple/demo', {}).then(apply)}>
        No one handy? <span style={{ color: 'var(--ink)', textDecoration: 'underline', fontWeight: 700 }}>Try it with a demo partner</span>
      </button>
    </div>
  );
}
