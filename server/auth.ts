// Accounts: email + password, with per-device sign-in tokens.
// Uses Web Crypto only, so the same code runs on the server and in the on-device build.
import type { User } from '../shared/types.ts';

/** Server-only fields on a stored user. Never sent to a client (see publicUser). */
export interface StoredUser extends User {
  auth?: { salt: string; iterations: number; hash: string };
  /** SHA-256 of each live sign-in token's secret, newest last. */
  tokens?: string[];
}

const enc = new TextEncoder();
const subtle = () => globalThis.crypto.subtle;
const hex = (b: ArrayBuffer | Uint8Array) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
export const randomHex = (bytes = 32) => hex(globalThis.crypto.getRandomValues(new Uint8Array(bytes)));
export const sha256 = async (s: string) => hex(await subtle().digest('SHA-256', enc.encode(s)));

const ITERATIONS = 210_000; // OWASP's PBKDF2-SHA256 recommendation
const MAX_TOKENS = 10;

export async function hashPassword(password: string, salt = randomHex(16), iterations = ITERATIONS) {
  const key = await subtle().importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await subtle().deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations }, key, 256);
  return { salt, iterations, hash: hex(bits) };
}

function sameHex(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifyPassword(password: string, auth: NonNullable<StoredUser['auth']>) {
  const { hash } = await hashPassword(password, auth.salt, auth.iterations);
  return sameHex(hash, auth.hash);
}

/** A credential is "<userId>.<secret>" for account holders, or a bare user id for guests. */
export const credentialUserId = (credential: string | null | undefined) => (credential ? credential.split('.')[0] || null : null);

/** Issues a new sign-in token for this user and returns the credential to hand to the client. */
export async function issueToken(user: StoredUser) {
  const secret = randomHex(32);
  user.tokens = [...(user.tokens ?? []), await sha256(secret)].slice(-MAX_TOKENS);
  return `${user.id}.${secret}`;
}

export async function revokeToken(user: StoredUser, credential: string | null) {
  const secret = credential?.split('.')[1];
  if (!secret) return;
  const h = await sha256(secret);
  user.tokens = (user.tokens ?? []).filter((t) => t !== h);
}

/**
 * Who is calling? Account holders must present a valid token; guests (no password yet,
 * pass-and-play partners, the demo partner) are still identified by id alone.
 */
export async function authenticate(users: Record<string, StoredUser>, credential: string | null | undefined) {
  const uid = credentialUserId(credential);
  const user = uid ? users[uid] : undefined;
  if (!user) return undefined;
  if (!user.auth) return user;
  const secret = credential!.split('.')[1];
  if (!secret) return undefined;
  return user.tokens?.includes(await sha256(secret)) ? user : undefined;
}

export const normalizeEmail = (email: unknown) => String(email ?? '').trim().toLowerCase();

export function validateCredentials(email: string, password: unknown): string | null {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 120) return 'Enter a valid email address.';
  if (typeof password !== 'string' || password.length < 8) return 'Use a password with at least 8 characters.';
  if (password.length > 200) return 'That password is too long.';
  return null;
}

/** What a client may see. Your own email is shown to you; your partner's isn't. */
export function publicUser(u: StoredUser, self: boolean): User {
  const { auth, tokens: _tokens, email, ...rest } = u;
  return { ...rest, ...(self && email ? { email } : {}), hasAccount: Boolean(auth) };
}
