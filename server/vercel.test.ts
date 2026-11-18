// Runs the Vercel entry against a real (embedded) Postgres: persistence across requests,
// two phones, and simultaneous swipes on the same card.
// Skipped unless DN_PG_TEST=1 (it downloads/starts a Postgres binary).
import EmbeddedPostgres from 'embedded-postgres';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runApi } from './vercel.ts';

const enabled = process.env.DN_PG_TEST === '1';
const PORT = 54329;
let server: EmbeddedPostgres;
let pool: pg.Pool;

describe.skipIf(!enabled)('Vercel entry on Postgres', () => {
  beforeAll(async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dn-pg-'));
    server = new EmbeddedPostgres({ databaseDir: dir, user: 'dn', password: 'dn', port: PORT, persistent: false, createPostgresUser: true });
    await server.initialise();
    await server.start();
    await server.createDatabase('date_night');
    pool = new pg.Pool({ connectionString: `postgres://dn:dn@localhost:${PORT}/date_night`, max: 4 });
  }, 120_000);

  afterAll(async () => {
    await pool?.end();
    await server?.stop();
  });

  const call = async (method: string, p: string, uid: string | null, body?: unknown) => {
    const r = await runApi(method, p, uid, body, pool);
    if (r.status !== 200) throw new Error(`${p}: ${JSON.stringify(r.body)}`);
    return r.body as any;
  };

  it('pairs two phones, persists everything, and matches exactly once under simultaneous swipes', async () => {
    const a = (await call('POST', '/users', null, { name: 'Alex' })).me.id;
    const code = (await call('POST', '/couple', a)).couple.inviteCode;
    const b = (await call('POST', '/users', null, { name: 'Sam' })).me.id;
    const joined = await call('POST', '/couple/join', b, { code });
    expect(joined.partner.name).toBe('Alex');
    expect(joined.realtime).toBe('poll');

    // Nothing lives in memory between requests: Alex sees Sam via the database.
    expect((await call('GET', '/state', a)).partner.name).toBe('Sam');

    let st = await call('POST', '/sessions', a, { mode: 'dinner', filters: { area: 'west-village', radiusMi: 2, date: '2026-11-21', windowStart: '18:00', windowEnd: '21:00' } });
    const sid = st.session.id;
    const [first, second] = st.session.deck;

    // Both swipe yes on two cards at the same moment.
    await Promise.all([
      call('POST', `/sessions/${sid}/vote`, a, { optionId: second.id, vote: 'pass' }),
      call('POST', `/sessions/${sid}/vote`, b, { optionId: second.id, vote: 'pass' }),
    ]);
    await Promise.all([
      call('POST', `/sessions/${sid}/vote`, a, { optionId: first.id, vote: 'like' }),
      call('POST', `/sessions/${sid}/vote`, b, { optionId: first.id, vote: 'super' }),
    ]);
    st = await call('GET', '/state', a);
    expect(st.session.status).toBe('matched');
    expect(st.session.match.option.id).toBe(first.id);
    expect(st.session.myProgress).toBe(2);
    expect(st.session.partnerProgress).toBe(2); // neither swipe was lost

    st = await call('POST', `/sessions/${sid}/booked`, b, { time: st.session.match.option.slots[0].time });
    expect(st.session.status).toBe('booked');
    expect((await call('GET', '/state', a)).toRate).toHaveLength(1);
  });

  it('runs the demo partner synchronously', async () => {
    const a = (await call('POST', '/users', null, { name: 'Jo' })).me.id;
    await call('POST', '/couple/demo', a);
    let st = await call('POST', '/sessions', a, { mode: 'dinner', filters: { area: 'lower-east-side', radiusMi: 2 } });
    const sid = st.session.id;
    st = await call('POST', `/sessions/${sid}/vote`, a, { optionId: st.session.deck[0].id, vote: 'like' });
    expect(st.session.partnerProgress).toBeGreaterThanOrEqual(1); // bot swiped within the same request
  });

  it('rejects unknown users and keeps the schema idempotent', async () => {
    expect((await runApi('GET', '/state', 'nope', undefined, pool)).status).toBe(401);
    const { rows } = await pool.query(`SELECT count(*)::int AS n FROM dn_docs WHERE kind = 'user'`);
    expect(rows[0].n).toBeGreaterThanOrEqual(3);
  });
});
