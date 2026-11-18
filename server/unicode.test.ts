import { describe, expect, it } from 'vitest';
import { clip } from './providers/googlePlaces.ts';
import { toDbJson } from './vercel.ts';

const hasLoneSurrogate = (s: string) => /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(s);

describe('emoji-safe text for Postgres', () => {
  it('clip never splits an emoji', () => {
    // 236 chars + emoji puts the cut point exactly inside the surrogate pair.
    const text = 'x'.repeat(236) + '👍👍👍👍👍';
    const out = clip(text, 240);
    expect(hasLoneSurrogate(out)).toBe(false);
    expect(out.endsWith('…')).toBe(true);
    expect(clip('short 👍', 240)).toBe('short 👍');
  });

  it('toDbJson replaces lone surrogates so jsonb accepts it', () => {
    const broken = 'Roast pork 叉烧 - good \uD83D';
    const json = toDbJson({ note: broken, nested: [{ t: '\uDC4D oops' }], ok: 'fine 👍' });
    expect(json).not.toMatch(/\\ud8[0-9a-f]{2}|\\udc[0-9a-f]{2}/i);
    expect(JSON.parse(json).ok).toBe('fine 👍');
  });
});
