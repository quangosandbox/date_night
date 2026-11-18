import { useState, type FormEvent } from 'react';
import type { AppState } from '../../../shared/types.ts';
import { api, rememberOnDevice, setUserId } from '../api.ts';
import { Logo, SushiPlate } from '../components/Brand.tsx';
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
      rememberOnDevice(s.me.id);
      apply(s);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

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
        <div className="field">
          <label htmlFor="name">Your first name</label>
          <input id="name" className="input" autoComplete="given-name" value={name} onChange={(e) => { setName(e.target.value); setError(''); }} placeholder="Alex" />
        </div>
        <div className="field">
          <label htmlFor="phone">Phone <span className="muted" style={{ fontWeight: 400 }}>· for reservations</span></label>
          <input id="phone" className="input" type="tel" autoComplete="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 555-0123" />
        </div>
        {error && <div role="alert" style={{ color: 'var(--tobiko-ink)', fontSize: 14, fontWeight: 700 }}>{error}</div>}
        <button className="btn btn-block" disabled={busy}>Let's eat <Arrow /></button>
      </div>
    </form>
  );
}
