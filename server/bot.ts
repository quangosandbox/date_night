// Demo partner: a bot that swipes a couple of cards ahead of you with plausible taste.
import type { User } from '../shared/types.ts';
import { applyVote, progress, type Session } from './engine.ts';
import { rng } from './util.ts';

type Hooks = { onChange: (s: Session) => void; onMatch: (s: Session, bot: User) => Promise<void> };
let hooks: Hooks | null = null;
export const setBotHooks = (h: Hooks) => (hooks = h);

const running = new Set<string>();
const STEP_MS = Number(process.env.BOT_STEP_MS ?? 650);

export function scheduleBot(s: Session, members: User[]) {
  const bot = members.find((m) => m?.isBot);
  const human = members.find((m) => m && !m.isBot);
  if (!bot || !human || running.has(s.id)) return;
  running.add(s.id);

  const tick = async () => {
    if (s.status !== 'swiping') return running.delete(s.id);
    const target = Math.min(s.deck.length, progress(s, human.id) + 2);
    const next = s.deck.find((o) => s.votes[bot.id]?.[o.id] === undefined);
    if (!next || progress(s, bot.id) >= target) return running.delete(s.id);

    const r = rng(`${bot.id}|${next.id}`);
    const roll = r();
    const like = roll < 0.42 || (next.rating >= 4.6 && roll < 0.7) || next.badges.length > 0;
    const vote = like ? (r() < 0.15 ? 'super' : 'like') : 'pass';
    const outcome = applyVote(s, bot.id, next.id, vote);
    hooks?.onChange(s);
    if (outcome.kind === 'matched') {
      await hooks?.onMatch(s, bot);
      return running.delete(s.id);
    }
    setTimeout(tick, STEP_MS);
  };
  setTimeout(tick, STEP_MS);
}
