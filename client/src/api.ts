import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppState, Area } from '../../shared/types.ts';

// Identity lives in localStorage. Add ?u=2 to the URL to act as a second person in the same browser.
const profile = new URLSearchParams(location.search).get('u') ?? '';
const KEY = `dn.user${profile ? `.${profile}` : ''}`;

export const getUserId = () => localStorage.getItem(KEY);
export const setUserId = (id: string | null) => (id ? localStorage.setItem(KEY, id) : localStorage.removeItem(KEY));

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function api<T = AppState>(path: string, body?: unknown, method = body === undefined ? 'GET' : 'POST'): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'x-user-id': getUserId() ?? '' },
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
}

/** App state with realtime updates over Server-Sent Events. */
export function useAppState() {
  const [state, setState] = useState<AppState | null>(null);
  const [loading, setLoading] = useState(Boolean(getUserId()));
  const seq = useRef(0);

  const refresh = useCallback(async () => {
    if (!getUserId()) return setLoading(false);
    const mine = ++seq.current;
    try {
      const s = await api('/state');
      if (mine === seq.current) setState(s);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setUserId(null);
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
    if (!userId) return;
    let es: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout>;
    const connect = () => {
      es = new EventSource(`/api/events?user=${encodeURIComponent(userId)}`);
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
  }, [userId, refresh]);

  return { state, loading, apply, refresh };
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

export function icsFor(b: { title: string; date: string; slot: { time: string }; address?: string; confirmation: string }, minutes = 120) {
  const start = new Date(`${b.date}T${b.slot.time}:00`);
  const end = new Date(start.getTime() + minutes * 60000);
  const z = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Date Night//EN', 'BEGIN:VEVENT',
    `UID:${b.confirmation}@datenight`, `DTSTAMP:${z(new Date())}`, `DTSTART:${z(start)}`, `DTEND:${z(end)}`,
    `SUMMARY:Date night · ${b.title}`, `LOCATION:${b.address ?? ''}`, `DESCRIPTION:Confirmation ${b.confirmation}`,
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
  return URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
}
