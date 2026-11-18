import { useState, type FormEvent } from 'react';
import type { AppState } from '../../../shared/types.ts';
import { api, LOCAL } from '../api.ts';
import { Logo, SushiPlate } from '../components/Brand.tsx';
import { Arrow } from '../components/Icons.tsx';

type Tab = 'signup' | 'login';

export function Welcome({ signIn }: { signIn: (s: AppState) => void }) {
  // The on-device build has no server to hold accounts, so it starts with just a name.
  const [tab, setTab] = useState<Tab>('signup');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const pick = (t: Tab) => {
    setTab(t);
    setError('');
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    if ((LOCAL || tab === 'signup') && !name.trim()) return setError('What should we call you?');
    setBusy(true);
    try {
      const s = LOCAL
        ? await api('/users', { name, phone })
        : tab === 'signup'
          ? await api('/auth/signup', { name, phone, email, password })
          : await api('/auth/login', { email, password });
      signIn(s);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  const clear = () => setError('');

  return (
    <form className="screen" onSubmit={submit} style={{ position: 'relative', overflow: 'hidden', gap: 22 }}>
      <SushiPlate className="welcome-plate" />
      <Logo />
      <div className="stack" style={{ gap: 14, marginTop: 150, position: 'relative' }}>
        <div className="note" style={{ fontSize: 24 }}>for two people who say</div>
        <h1 className="h1" style={{ fontSize: 46, lineHeight: 0.98 }}>“I don't mind, <span className="hl">you pick.</span>”</h1>
        <p className="lede">Swipe on real restaurants that are open in your window. The first place you both say yes to is the one — we send you straight to reserve it. Then you rate the night, and the next deck gets smarter.</p>
      </div>

      <div className="spacer" />
      <div className="stack" style={{ gap: 12, position: 'relative' }}>
        {!LOCAL && (
          <div className="auth-tabs" role="tablist" aria-label="Account">
            <button type="button" role="tab" aria-selected={tab === 'signup'} onClick={() => pick('signup')}>Create account</button>
            <button type="button" role="tab" aria-selected={tab === 'login'} onClick={() => pick('login')}>Log in</button>
          </div>
        )}

        {(LOCAL || tab === 'signup') && (
          <div className="field">
            <label htmlFor="name">Your first name</label>
            <input id="name" className="input" autoComplete="given-name" value={name} onChange={(e) => { setName(e.target.value); clear(); }} placeholder="Alex" />
          </div>
        )}
        {!LOCAL && (
          <>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input id="email" className="input" type="email" autoComplete="email" inputMode="email" autoCapitalize="off" value={email} onChange={(e) => { setEmail(e.target.value); clear(); }} placeholder="alex@example.com" />
            </div>
            <div className="field">
              <label htmlFor="password">Password{tab === 'signup' && <span className="muted" style={{ fontWeight: 400 }}> · 8+ characters</span>}</label>
              <input id="password" className="input" type="password" autoComplete={tab === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={(e) => { setPassword(e.target.value); clear(); }} />
            </div>
          </>
        )}
        {(LOCAL || tab === 'signup') && (
          <div className="field">
            <label htmlFor="phone">Phone <span className="muted" style={{ fontWeight: 400 }}>· for reservations, optional</span></label>
            <input id="phone" className="input" type="tel" autoComplete="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 555-0123" />
          </div>
        )}
        {error && <div role="alert" className="form-error">{error}</div>}
        <button className="btn btn-block" disabled={busy}>
          {LOCAL || tab === 'signup' ? "Let's eat" : 'Log in'} <Arrow />
        </button>
      </div>
    </form>
  );
}
