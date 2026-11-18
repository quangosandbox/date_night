// Crash reporting: uncaught errors are sent to /api/report and land in the server log
// (Vercel → Project → Logs, search "[client-error]"). Swap in Sentry later by replacing report().
import { API_BASE, LOCAL } from './api.ts';

let sent = 0;
const seen = new Set<string>();

export function report(error: unknown, where = 'window') {
  if (LOCAL) return; // the on-device build has no server to report to
  const e = error instanceof Error ? error : new Error(String(error));
  const sig = `${e.message}|${where}`;
  if (seen.has(sig) || sent >= 5) return; // a handful per page load is plenty
  seen.add(sig);
  sent++;
  const body = JSON.stringify({ message: e.message, stack: e.stack, where, url: location.href.split('?')[0], ua: navigator.userAgent });
  fetch(`${API_BASE}/api/report`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {});
}

export function installErrorReporting() {
  addEventListener('error', (ev) => report(ev.error ?? ev.message, 'window.onerror'));
  addEventListener('unhandledrejection', (ev) => report(ev.reason, 'unhandledrejection'));
}
