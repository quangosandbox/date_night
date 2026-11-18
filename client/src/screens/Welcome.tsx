import { useState, type FormEvent } from 'react';
import type { AppState } from '../../../shared/types.ts';
import { api, setUserId } from '../api.ts';
import { Arrow } from '../components/Icons.tsx';

export function Welcome({ apply }: { apply: (s: AppState) => void }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError('What should we call you?');
    setBusy(true);
    try {
      const s = await api('/users', { name, phone });
      setUserId(s.me.id);
      apply(s);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form className="screen" onSubmit={submit} style={{ paddingTop: 64 }}>
      <div className="serif" style={{ fontSize: 26 }}>
        Date <span className="italic ember">Night</span>
      </div>
      <div className="stack" style={{ gap: 14 }}>
        <h1 className="h1" style={{ fontSize: 52 }}>
          Stop deciding.
          <br />
          <span className="italic">Start swiping.</span>
        </h1>
        <p className="lede">You and your person swipe on spots that are actually open tonight. The first place you both say yes to gets booked. That's it.</p>
      </div>

      <ol className="stack" style={{ listStyle: 'none', padding: 0, margin: 0, gap: 12 }}>
        {[
          ['Set the plan', 'Dinner or a movie, when, and where.'],
          ['Swipe privately', 'Your partner never sees your passes.'],
          ['Match & we book', 'Resy, OpenTable or tickets — done for you.'],
        ].map(([t, d], i) => (
          <li key={t} className="row" style={{ alignItems: 'flex-start' }}>
            <span className="avatar" style={{ background: i === 1 ? 'var(--gold)' : 'var(--ember)', width: 28, height: 28, fontSize: 13, border: 0 }}>{i + 1}</span>
            <div>
              <div style={{ fontWeight: 600 }}>{t}</div>
              <div className="meta-sm">{d}</div>
            </div>
          </li>
        ))}
      </ol>

      <div className="spacer" />
      <div className="stack" style={{ gap: 12 }}>
        <div className="field">
          <label htmlFor="name">Your first name</label>
          <input id="name" className="input" autoComplete="given-name" value={name} onChange={(e) => { setName(e.target.value); setError(''); }} placeholder="Alex" />
        </div>
        <div className="field">
          <label htmlFor="phone">Phone <span className="muted" style={{ fontWeight: 400 }}>· for reservations</span></label>
          <input id="phone" className="input" type="tel" autoComplete="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 555-0123" />
        </div>
        {error && <div role="alert" style={{ color: 'var(--ember-text)', fontSize: 14 }}>{error}</div>}
        <button className="btn btn-primary btn-block" disabled={busy}>
          Get started <Arrow />
        </button>
      </div>
    </form>
  );
}
