import { describe, expect, it } from 'vitest';
import { handle } from './core.ts';
import { db } from './store.ts';

const call = async (method: string, path: string, credential: string | null, body?: unknown) => handle(method, path, credential, body) as Promise<{ status: number; body: any }>;
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
});
