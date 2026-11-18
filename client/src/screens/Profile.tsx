import { useState, type FormEvent, type ReactNode } from 'react';
import type { AppState } from '../../../shared/types.ts';
import type { ScreenProps } from '../App.tsx';
import { api, LOCAL, type Meta } from '../api.ts';
import { Plate } from '../components/Brand.tsx';
import { HomeButton } from '../components/HomeButton.tsx';

type Props = ScreenProps & { meta: Meta | null; signIn: (s: AppState) => void; signOut: () => void; onClose: () => void };

function useForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  async function run(fn: () => Promise<void>, done?: string) {
    setBusy(true);
    setError('');
    setOk('');
    try {
      await fn();
      if (done) setOk(done);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const status = (error && <div role="alert" className="form-error">{error}</div>) || (ok && <div role="status" className="form-ok">{ok}</div>);
  return { busy, run, status, clear: () => (setError(''), setOk('')) };
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="profile-card" aria-label={title}>
      <h2 className="h2" style={{ fontSize: 20 }}>{title}</h2>
      {children}
    </section>
  );
}

export function Profile({ state, apply, meta, signIn, signOut, onClose }: Props) {
  const { me, partner } = state;
  const movies = meta?.modes.includes('movie');

  // Details
  const [name, setName] = useState(me.name);
  const [phone, setPhone] = useState(me.phone);
  const [lb, setLb] = useState(me.letterboxd ?? '');
  const details = useForm();
  const dirty = name !== me.name || phone !== me.phone || lb !== (me.letterboxd ?? '');
  const saveDetails = (e: FormEvent) => {
    e.preventDefault();
    details.run(async () => apply(await api('/me', { name, phone, letterboxd: lb }, 'PATCH')), 'Saved.');
  };

  // Account (guest → account, or change password)
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [current, setCurrent] = useState('');
  const account = useForm();
  const saveAccount = (e: FormEvent) => {
    e.preventDefault();
    account.run(async () => {
      signIn(me.hasAccount ? await api('/me/password', { current, password }) : await api('/me/account', { email, password }));
      setPassword('');
      setCurrent('');
    }, me.hasAccount ? 'Password changed. Other devices were signed out.' : 'Account saved — you can log in anywhere now.');
  };

  // Unpair (two taps: system dialogs are blocked in the iOS web view)
  const [armed, setArmed] = useState(false);
  async function unpair() {
    if (!armed) return setArmed(true);
    apply(await api('/couple/leave', {}));
    setArmed(false);
  }

  const top = state.myRanking.slice(0, 3);

  const accountCard =
    !LOCAL && !me.isBot && (
        <Card title={me.hasAccount ? 'Change password' : 'Save your account'}>
          <form className="stack" style={{ gap: 12 }} onSubmit={saveAccount}>
            {!me.hasAccount && (
              <>
                <p className="meta-sm" style={{ margin: 0 }}>Right now you only exist on this device. Add an email and password so you can log in on any phone and never lose your dates.</p>
                <div className="field">
                  <label htmlFor="a-email">Email</label>
                  <input id="a-email" className="input" type="email" autoComplete="email" autoCapitalize="off" value={email} onChange={(e) => { setEmail(e.target.value); account.clear(); }} />
                </div>
              </>
            )}
            {me.hasAccount && (
              <div className="field">
                <label htmlFor="a-current">Current password</label>
                <input id="a-current" className="input" type="password" autoComplete="current-password" value={current} onChange={(e) => { setCurrent(e.target.value); account.clear(); }} />
              </div>
            )}
            <div className="field">
              <label htmlFor="a-pass">{me.hasAccount ? 'New password' : 'Password'} <span className="muted" style={{ fontWeight: 400 }}>· 8+ characters</span></label>
              <input id="a-pass" className="input" type="password" autoComplete="new-password" value={password} onChange={(e) => { setPassword(e.target.value); account.clear(); }} />
            </div>
            {account.status}
            <button className="btn btn-primary btn-block" disabled={account.busy || !password || (me.hasAccount ? !current : !email)}>
              {me.hasAccount ? 'Change password' : 'Save account'}
            </button>
          </form>
        </Card>
      );

  return (
    <div className="screen" style={{ gap: 18 }}>
      <header className="row" style={{ justifyContent: 'space-between' }}>
        <HomeButton onClick={onClose} />
        <h1 className="h2" style={{ fontSize: 24 }}>Profile</h1>
        <span style={{ width: 44 }} aria-hidden="true" />
      </header>

      <div className="profile-head">
        <span className="profile-avatar" style={{ background: me.color }} aria-hidden="true">{me.name.slice(0, 1).toUpperCase()}</span>
        <div className="grow" style={{ minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--display)', fontSize: 24, lineHeight: 1.1 }}>{me.name}</div>
          <div className="meta-sm" style={{ overflowWrap: 'anywhere' }}>
            {me.hasAccount ? me.email : LOCAL ? 'Saved on this phone' : 'Guest · only on this device'}
          </div>
          <div className="meta-sm">{partner ? `Paired with ${partner.name}${partner.isBot ? ' (demo)' : ''}` : 'Not paired yet'}</div>
        </div>
      </div>

      <div className="stat-row">
        <div className="stat"><b>{state.history.length}</b><span>dates booked</span></div>
        <div className="stat"><b>{state.myRanking.length}</b><span>places rated</span></div>
        <div className="stat"><b>{state.toRate.length}</b><span>to rate</span></div>
      </div>

      {top.length > 0 && (
        <Card title="Your top spots">
          {top.map((r, i) => (
            <div key={r.optionId} className="row" style={{ gap: 12 }}>
              <span className="rank">{i + 1}</span>
              <Plate photo={r.photo} art={r.art} seed={r.optionId} size={40} />
              <div className="grow title-sm">{r.title}</div>
              <span className={`score ${r.verdict}`}>{r.score.toFixed(1)}</span>
            </div>
          ))}
        </Card>
      )}

      {state.taste.into.length + state.taste.notInto.length > 0 && (
        <Card title="Your taste, so far">
          <div className="taste">
            {state.taste.into.map((t) => <span key={t} className="tag">{t}</span>)}
            {state.taste.notInto.map((t) => <span key={t} className="tag no">{t}</span>)}
          </div>
        </Card>
      )}

      {!me.hasAccount && accountCard}
      <Card title="Your details">
        <form className="stack" style={{ gap: 12 }} onSubmit={saveDetails}>
          <div className="field">
            <label htmlFor="p-name">First name</label>
            <input id="p-name" className="input" value={name} onChange={(e) => { setName(e.target.value); details.clear(); }} />
          </div>
          <div className="field">
            <label htmlFor="p-phone">Phone for reservations</label>
            <input id="p-phone" className="input" type="tel" value={phone} onChange={(e) => { setPhone(e.target.value); details.clear(); }} />
          </div>
          {movies && (
            <div className="field">
              <label htmlFor="p-lb">Letterboxd username</label>
              <input id="p-lb" className="input" placeholder="@yourname" value={lb} onChange={(e) => { setLb(e.target.value); details.clear(); }} autoCapitalize="off" />
              <div className="meta-sm">We read your watchlist so films you both want to see get a boost.</div>
            </div>
          )}
          {details.status}
          <button className="btn btn-primary btn-block" disabled={details.busy || !dirty || !name.trim()}>Save details</button>
        </form>
      </Card>

      {me.hasAccount && accountCard}

      <div className="stack" style={{ gap: 4, alignItems: 'center' }}>
        {partner && (
          <button className="link-btn" onClick={unpair} style={armed ? { color: 'var(--tobiko-ink)' } : undefined}>
            {armed ? `Tap again to unpair from ${partner.name}` : `Unpair from ${partner.name}`}
          </button>
        )}
        {!LOCAL && me.hasAccount && <button className="link-btn" onClick={signOut}>Log out</button>}
      </div>
    </div>
  );
}
