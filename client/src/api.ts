import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppState, Area } from '../../shared/types.ts';

// The signed-in credential lives in localStorage: "<userId>.<token>" for accounts, or a bare
// user id for guests. Add ?u=2 to the URL to act as a second person in the same browser.
const profile = new URLSearchParams(location.search).get('u') ?? '';
const KEY = `dn.user${profile ? `.${profile}` : ''}`;

function store(key: string, value: string | null) {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    /* storage blocked */
  }
}
export const getCredential = () => {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
};
export const setCredential = (credential: string | null) => store(KEY, credential);

/**
 * People who use this phone (you, plus a pass-and-play partner) and how to sign each in.
 * Linked partners on their own phone aren't here. Stored as { userId: credential }.
 */
const DEVICE_KEY = `dn.deviceUsers${profile ? `.${profile}` : ''}`;
function deviceUsers(): Record<string, string> {
  try {
    const raw = JSON.parse(localStorage.getItem(DEVICE_KEY) ?? '{}');
    return Array.isArray(raw) ? Object.fromEntries(raw.map((id: string) => [id, id])) : raw; // older builds kept a list of ids
  } catch {
    return {};
  }
}
export function rememberOnDevice(id: string, credential = id) {
  store(DEVICE_KEY, JSON.stringify({ ...deviceUsers(), [id]: credential }));
}
export const forgetDevice = () => store(DEVICE_KEY, null);
export function onThisDevice(id: string | undefined) {
  if (!id) return false;
  if (LOCAL) return true; // fully on-device: everyone is on this phone
  return id in deviceUsers();
}

/** Hosted API for linked accounts (e.g. the iOS app pointing at the beta server). Empty = same origin. */
export const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Run fully on-device (iOS app, shareable build, or ?local=1) instead of talking to a server. */
export const LOCAL =
  !API_BASE && (import.meta.env.VITE_BACKEND === 'local' || location.protocol === 'capacitor:' || new URLSearchParams(location.search).has('local'));

type Local = typeof import('./localBackend.ts');
let localMod: Promise<Local> | null = null;
const local = () => (localMod ??= import('./localBackend.ts'));

export async function api<T = AppState>(path: string, body?: unknown, method = body === undefined ? 'GET' : 'POST'): Promise<T> {
  if (LOCAL) {
    const { handle } = await local();
    const r = await handle(method, path, getCredential(), body === undefined ? undefined : JSON.parse(JSON.stringify(body)));
    if (r.status !== 200) throw new ApiError(r.status, (r.body as { error?: string }).error ?? 'Something went wrong');
    const out = JSON.parse(JSON.stringify(r.body)) as T; // detach from the live store
    if (out && typeof out === 'object' && 'me' in out) (out as unknown as AppState).localMode = true;
    return out;
  }
  const res = await fetch(`${API_BASE}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'x-user-id': getCredential() ?? '' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? 'Something went wrong');
  return data as T;
}

export interface Meta {
  areas: Area[];
  cuisines: string[];
  genres: string[];
  formats: string[];
  modes: ('dinner' | 'movie')[];
  bookingMode: 'handoff' | 'auto';
  liveData: boolean; // real Google Places data (vs. the demo venues)
}

/** App state with realtime updates over Server-Sent Events. */
export function useAppState() {
  const [state, setState] = useState<AppState | null>(null);
  const [loading, setLoading] = useState(Boolean(getCredential()));
  const seq = useRef(0);

  const refresh = useCallback(async () => {
    if (!getCredential()) return setLoading(false);
    const mine = ++seq.current;
    try {
      const s = await api('/state');
      if (mine === seq.current) setState(s);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setCredential(null);
        setState(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const apply = useCallback((s: AppState) => {
    seq.current++;
    setState(s);
  }, []);

  const userId = state?.me.id;
  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!userId || !LOCAL) return;
    let off = () => {};
    local().then(({ subscribe }) => (off = subscribe(userId, () => refresh())));
    return () => off();
  }, [userId, refresh]);

  // Serverless hosting (Vercel) can't hold a live connection open, so poll instead.
  const poll = state?.realtime === 'poll';
  useEffect(() => {
    if (!userId || LOCAL || !poll) return;
    const t = setInterval(() => document.visibilityState === 'visible' && refresh(), 2500);
    const onVis = () => document.visibilityState === 'visible' && refresh();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [userId, poll, refresh]);

  useEffect(() => {
    if (!userId || LOCAL || poll) return;
    let es: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout>;
    const connect = () => {
      es = new EventSource(`${API_BASE}/api/events?user=${encodeURIComponent(getCredential() ?? '')}`);
      es.addEventListener('update', () => refresh());
      es.addEventListener('hello', () => refresh());
      es.onerror = () => {
        es?.close();
        retry = setTimeout(connect, 2000);
      };
    };
    connect();
    const onVis = () => document.visibilityState === 'visible' && refresh();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      es?.close();
      clearTimeout(retry);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [userId, poll, refresh]);

  /** Pass-and-play: hand the phone to your partner. */
  const switchTo = useCallback(
    (uid: string) => {
      setCredential(deviceUsers()[uid] ?? uid);
      refresh();
    },
    [refresh],
  );

  /** After sign up / log in / saving an account: keep the new credential on this device. */
  const signIn = useCallback(
    (s: AppState) => {
      const credential = s.token ?? s.me.id;
      setCredential(credential);
      rememberOnDevice(s.me.id, credential);
      apply(s);
    },
    [apply],
  );

  const signOut = useCallback(async () => {
    await api('/auth/logout', {}).catch(() => {});
    setCredential(null);
    forgetDevice();
    seq.current++;
    setState(null);
  }, []);

  return { state, loading, apply, refresh, switchTo, signIn, signOut };
}

export function useMeta() {
  const [meta, setMeta] = useState<Meta | null>(null);
  useEffect(() => {
    api<Meta>('/meta').then(setMeta).catch(() => {});
  }, []);
  return meta;
}

// ---------- formatting ----------
export function fmtTime(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return m ? `${h12}:${String(m).padStart(2, '0')} ${suffix}` : `${h12} ${suffix}`;
}

export function fmtTimeShort(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')}`;
}

export function localISODate(d = new Date()) {
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

export function fmtDay(iso: string) {
  const today = localISODate();
  const tomorrow = localISODate(new Date(Date.now() + 86400000));
  if (iso === today) return 'Tonight';
  if (iso === tomorrow) return 'Tomorrow';
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

/** "Add to calendar" as a Google Calendar link: works in browsers, the artifact viewer and the iOS app. */
export function calendarLink(b: { title: string; date: string; slot: { time: string }; address?: string; confirmation: string }, minutes = 120) {
  const start = new Date(`${b.date}T${b.slot.time}:00`);
  const end = new Date(start.getTime() + minutes * 60000);
  const z = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const q = new URLSearchParams({
    action: 'TEMPLATE',
    text: `Date night · ${b.title}`,
    dates: `${z(start)}/${z(end)}`,
    location: b.address ?? '',
    details: `Booked with Date Night · confirmation ${b.confirmation}`,
  });
  return `https://calendar.google.com/calendar/render?${q}`;
}
