import { useEffect, useRef, useState } from 'react';
import type { ScreenProps } from '../App.tsx';
import { api } from '../api.ts';

export function ProfileSheet({ state, apply, onClose }: ScreenProps & { onClose: () => void }) {
  const [name, setName] = useState(state.me.name);
  const [phone, setPhone] = useState(state.me.phone);
  const [lb, setLb] = useState(state.me.letterboxd ?? '');
  const first = useRef<HTMLInputElement>(null);

  useEffect(() => {
    first.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [onClose]);

  async function save() {
    apply(await api('/me', { name, phone, letterboxd: lb }, 'PATCH'));
    onClose();
  }

  const [armed, setArmed] = useState(false);
  async function unpair() {
    if (!armed) return setArmed(true);
    apply(await api('/couple/leave', {}));
    onClose();
  }

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
        <div className="grabber" />
        <h2 id="sheet-title" className="h2" style={{ fontSize: 28 }}>You</h2>
        <div className="field">
          <label htmlFor="p-name">First name</label>
          <input ref={first} id="p-name" className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="p-phone">Phone for reservations</label>
          <input id="p-phone" className="input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="p-lb">Letterboxd username</label>
          <input id="p-lb" className="input" placeholder="@yourname" value={lb} onChange={(e) => setLb(e.target.value)} autoCapitalize="off" />
          <div className="meta-sm">We read your watchlist so films you both want to see get a boost.</div>
        </div>
        <button className="btn btn-primary btn-block" onClick={save}>Save</button>
        {state.partner && (
          <button className="link-btn" onClick={unpair} style={armed ? { color: 'var(--tobiko-ink)' } : undefined}>{armed ? `Tap again to unpair from ${state.partner.name}` : `Unpair from ${state.partner.name}`}</button>
        )}
      </div>
    </>
  );
}
