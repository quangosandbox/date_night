import { describe, expect, it, vi } from 'vitest';
import { TOKEN_TTL_MS } from './auth.ts';
import { handle } from './core.ts';
import { db } from './store.ts';

let ipSeq = 0;
const ip = () => `10.0.0.${++ipSeq}`; // each test gets its own address so rate limits don't collide
let testIp = ip();
const call = async (method: string, path: string, credential: string | null, body?: unknown) => handle(method, path, credential, body, { ip: testIp }) as Promise<{ status: number; body: any }>;
const ok = async (method: string, path: string, credential: string | null, body?: unknown) => {
  const r = await call(method, path, credential, body);
  if (r.status !== 200) throw new Error(`${path}: ${r.status} ${JSON.stringify(r.body)}`);
  return r.body;
};
const email = (n: string) => `${n}-${Math.random().toString(36).slice(2)}@example.com`;

describe('accounts', () => {
  it('signs up, logs in on another device, and logs out', async () => {
    const addr = email('alex');
    const signup = await ok('POST', '/auth/signup', null, { name: 'Alex', email: addr.toUpperCase(), password: 'correct horse' });
    expect(signup.token).toMatch(new RegExp(`^${signup.me.id}\\.[0-9a-f]{64}$`));
    expect(signup.me).toMatchObject({ name: 'Alex', email: addr, hasAccount: true });
    expect(signup.me.auth).toBeUndefined();
    expect(signup.me.tokens).toBeUndefined();

    // The token works; the bare id no longer does once you have an account.
    expect((await ok('GET', '/state', signup.token)).me.id).toBe(signup.me.id);
    expect((await call('GET', '/state', signup.me.id)).status).toBe(401);
    expect((await call('GET', '/state', `${signup.me.id}.${'0'.repeat(64)}`)).status).toBe(401);

    expect((await call('POST', '/auth/login', null, { email: addr, password: 'wrong password' })).status).toBe(401);
    const second = await ok('POST', '/auth/login', null, { email: ` ${addr} `, password: 'correct horse' });
    expect(second.me.id).toBe(signup.me.id);
    expect(second.token).not.toBe(signup.token);

    await ok('POST', '/auth/logout', second.token, {});
    expect((await call('GET', '/state', second.token)).status).toBe(401);
    expect((await call('GET', '/state', signup.token)).status).toBe(200); // other device still signed in
  });

  it('rejects duplicate emails and weak passwords', async () => {
    const addr = email('sam');
    await ok('POST', '/auth/signup', null, { name: 'Sam', email: addr, password: 'longenough' });
    expect((await call('POST', '/auth/signup', null, { name: 'Sam 2', email: addr, password: 'longenough' })).status).toBe(409);
    expect((await call('POST', '/auth/signup', null, { name: 'Jo', email: email('jo'), password: 'short' })).status).toBe(400);
    expect((await call('POST', '/auth/signup', null, { name: 'Jo', email: 'not-an-email', password: 'longenough' })).status).toBe(400);
  });

  it('lets a guest save their profile as an account, keeping their partner', async () => {
    const guest = (await ok('POST', '/users', null, { name: 'Kim' })).me.id;
    await ok('POST', '/couple/demo', guest);
    const saved = await ok('POST', '/me/account', guest, { email: email('kim'), password: 'longenough' });
    expect(saved.me.hasAccount).toBe(true);
    expect(saved.partner.name).toBe('Sam');
    expect(saved.partner.email).toBeUndefined();
    expect((await call('GET', '/state', guest)).status).toBe(401);
    expect((await ok('GET', '/state', saved.token)).partner.name).toBe('Sam');
    expect((await call('POST', '/me/account', saved.token, { email: email('kim2'), password: 'longenough' })).status).toBe(409);
  });

  it('changes password and signs out other devices', async () => {
    const addr = email('lee');
    const a = await ok('POST', '/auth/signup', null, { name: 'Lee', email: addr, password: 'first-password' });
    const b = await ok('POST', '/auth/login', null, { email: addr, password: 'first-password' });
    expect((await call('POST', '/me/password', a.token, { current: 'nope-nope', password: 'second-password' })).status).toBe(401);
    const changed = await ok('POST', '/me/password', a.token, { current: 'first-password', password: 'second-password' });
    expect((await call('GET', '/state', b.token)).status).toBe(401);
    expect((await call('GET', '/state', changed.token)).status).toBe(200);
    expect((await call('POST', '/auth/login', null, { email: addr, password: 'first-password' })).status).toBe(401);
    await ok('POST', '/auth/login', null, { email: addr, password: 'second-password' });
  });

  it('never stores the password or raw tokens', async () => {
    const s = await ok('POST', '/auth/signup', null, { name: 'Ri', email: email('ri'), password: 'plaintext-secret' });
    const stored = JSON.stringify(db.users[s.me.id]);
    expect(stored).not.toContain('plaintext-secret');
    expect(stored).not.toContain(s.token.split('.')[1]);
  });

  it('deletes an account, its couple and shared sessions, but not the partner', async () => {
    testIp = ip();
    const a = await ok('POST', '/auth/signup', null, { name: 'Del', email: email('del'), password: 'longenough' });
    const code = (await ok('POST', '/couple', a.token)).couple.inviteCode;
    const b = (await ok('POST', '/users', null, { name: 'Bea' })).me.id;
    await ok('POST', '/couple/join', b, { code });
    const st = await ok('POST', '/sessions', a.token, { mode: 'dinner', filters: { area: 'west-village', radiusMi: 2 } });
    const coupleId = st.couple.id;

    expect((await call('POST', '/me/delete', a.token, { password: 'wrong-password' })).status).toBe(401);
    expect(await ok('POST', '/me/delete', a.token, { password: 'longenough' })).toEqual({ deleted: true });

    expect(db.users[a.me.id]).toBeUndefined();
    expect(db.couples[coupleId]).toBeUndefined();
    expect(Object.values(db.sessions).some((s) => s.coupleId === coupleId)).toBe(false);
    expect((await call('GET', '/state', a.token)).status).toBe(401);
    const bea = await ok('GET', '/state', b);
    expect(bea.partner).toBeNull(); // partner keeps their profile, now unpaired
    expect((await call('POST', '/auth/login', null, { email: a.me.email, password: 'longenough' })).status).toBe(401);
  });

  it('lets a guest delete themselves without a password', async () => {
    testIp = ip();
    const g = (await ok('POST', '/users', null, { name: 'Gia' })).me.id;
    await ok('POST', '/couple/demo', g);
    await ok('POST', '/me/delete', g, {});
    expect(db.users[g]).toBeUndefined();
  });

  it('rate-limits password guessing per email', async () => {
    testIp = ip();
    const addr = email('rl');
    await ok('POST', '/auth/signup', null, { name: 'Rl', email: addr, password: 'longenough' });
    const codes: number[] = [];
    for (let i = 0; i < 10; i++) {
      testIp = ip(); // a different address each time: the per-email limit still applies
      codes.push((await call('POST', '/auth/login', null, { email: addr, password: `guess-${i}-guess` })).status);
    }
    expect(codes.slice(0, 8).every((c) => c === 401)).toBe(true);
    expect(codes.slice(8)).toEqual([429, 429]);
    expect((await call('POST', '/auth/login', null, { email: addr, password: 'longenough' })).status).toBe(429); // even the right one, until the window passes
  });

  it('expires sign-in tokens after 90 days', async () => {
    testIp = ip();
    const a = await ok('POST', '/auth/signup', null, { name: 'Exp', email: email('exp'), password: 'longenough' });
    vi.useFakeTimers({ now: Date.now() + TOKEN_TTL_MS - 60_000, toFake: ['Date'] });
    try {
      expect((await call('GET', '/state', a.token)).status).toBe(200);
      vi.setSystemTime(Date.now() + 120_000);
      expect((await call('GET', '/state', a.token)).status).toBe(401);
    } finally {
      vi.useRealTimers();
    }
  });

  it('accepts crash reports without an account', async () => {
    testIp = ip();
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect((await call('POST', '/report', null, { message: 'boom', stack: 'x'.repeat(10_000) })).status).toBe(200);
    const logged = String(spy.mock.calls[0]?.[1] ?? '');
    spy.mockRestore();
    expect(logged).toContain('boom');
    expect(logged.length).toBeLessThan(6000);
  });
});
