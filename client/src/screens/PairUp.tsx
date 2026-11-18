import { useEffect, useState, type FormEvent } from 'react';
import type { ScreenProps } from '../App.tsx';
import { api } from '../api.ts';
import { Share } from '../components/Icons.tsx';

export function PairUp({ state, apply }: ScreenProps) {
  const fromLink = new URLSearchParams(location.search).get('join') ?? '';
  const [code, setCode] = useState(fromLink.toUpperCase());
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  // Make sure there's a couple (and an invite code) to share — unless we arrived via an invite link.
  useEffect(() => {
    if (!state.couple && !fromLink) api('/couple', {}).then(apply).catch(() => {});
  }, [state.couple, fromLink, apply]);

  // Arrived from an invite link: join right away.
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

  async function share() {
    const invite = state.couple?.inviteCode ?? '';
    const url = `${location.origin}/?join=${invite}`;
    const text = `Let's plan date night. Join me on Date Night with code ${invite}`;
    try {
      if (navigator.share) await navigator.share({ title: 'Date Night', text, url });
      else {
        await navigator.clipboard.writeText(`${text}: ${url}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      /* user dismissed */
    }
  }

  const invite = state.couple?.inviteCode ?? '······';

  return (
    <div className="screen" style={{ paddingTop: 48 }}>
      <div className="stack">
        <div className="eyebrow">Hi {state.me.name}</div>
        <h1 className="h1" style={{ fontSize: 40 }}>
          Bring your <span className="italic ember">person.</span>
        </h1>
        <p className="lede">Send them this code. You'll each swipe privately — you only ever see what you both said yes to.</p>
      </div>

      <section className="panel stack" style={{ borderRadius: 24, padding: '28px 20px', alignItems: 'center', gap: 18 }} aria-label="Your invite code">
        <div className="eyebrow">Your invite code</div>
        <div className="code-grid" aria-label={invite.split('').join(' ')}>
          {invite.split('').map((c, i) => (
            <div key={i} className="code-cell" aria-hidden="true">{c}</div>
          ))}
        </div>
        <button className="btn btn-primary btn-block" onClick={share} disabled={!state.couple}>
          <Share size={18} /> {copied ? 'Link copied' : 'Share invite link'}
        </button>
        <div className="row" style={{ gap: 8, fontSize: 13, color: 'var(--muted)' }} aria-live="polite">
          <span className="pulse-dot" /> Waiting for your partner to join…
        </div>
      </section>

      <div className="divider">or</div>

      <form className="field" onSubmit={join}>
        <label htmlFor="code">Have a code?</label>
        <div className="row" style={{ gap: 8 }}>
          <input id="code" className="input code-input" maxLength={6} autoComplete="off" autoCapitalize="characters" value={code} onChange={(e) => { setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')); setError(''); }} placeholder="6 characters" />
          <button className="btn btn-dark btn-sm" style={{ height: 52, borderRadius: 14 }} disabled={busy}>Join</button>
        </div>
        {error && <div role="alert" style={{ color: 'var(--ember-text)', fontSize: 14 }}>{error}</div>}
      </form>

      <div className="spacer" />
      <button className="link-btn" onClick={() => api('/couple/demo', {}).then(apply)}>
        No one handy? <span style={{ color: 'var(--ink)', textDecoration: 'underline', fontWeight: 800 }}>Try it with a demo partner</span>
      </button>
    </div>
  );
}
