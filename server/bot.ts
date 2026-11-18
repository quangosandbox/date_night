// Demo partner: a bot that swipes a couple of cards ahead of you with plausible taste.
import type { User, Vote } from '../shared/types.ts';
import { applyVote, progress, type Session } from './engine.ts';
import { rng } from './util.ts';

type Hooks = { onChange: (s: Session) => void; onMatch: (s: Session, bot: User) => Promise<void> };
let hooks: Hooks | null = null;
export const setBotHooks = (h: Hooks) => (hooks = h);

const running = new Set<string>();
const STEP_MS = Number((typeof process !== 'undefined' && process.env?.BOT_STEP_MS) || 650);

/** The demo partner's taste: likes ~40%, loves highly rated places, sometimes hearts a dish. */
function botVote(botId: string, o: Session['deck'][number]): [Vote, string | undefined] {
  const r = rng(`${botId}|${o.id}`);
  const roll = r();
  const like = roll < 0.42 || (o.rating >= 4.6 && roll < 0.7) || o.badges.length > 0;
  const vote: Vote = like ? (r() < 0.15 ? 'super' : 'like') : 'pass';
  const item = vote !== 'pass' && r() < 0.6 ? o.highlights[0]?.name : undefined;
  return [vote, item];
}

export function scheduleBot(s: Session, members: User[]) {
  const bot = members.find((m) => m?.isBot);
  const human = members.find((m) => m && !m.isBot);
  if (!bot || !human || running.has(s.id)) return;

  // Serverless (Vercel): no timers survive the request, so the bot catches up immediately.
  if (typeof process !== 'undefined' && process.env?.DN_BOT_SYNC === '1') {
    for (let guard = 0; guard < 60 && s.status === 'swiping'; guard++) {
      const target = Math.min(s.deck.length, progress(s, human.id) + 2);
      const next = s.deck.find((o) => s.votes[bot.id]?.[o.id] === undefined);
      if (!next || progress(s, bot.id) >= target) break;
      if (applyVote(s, bot.id, next.id, ...botVote(bot.id, next)).kind === 'matched') {
        void hooks?.onMatch(s, bot);
        break;
      }
    }
    return;
  }

  running.add(s.id);

  const tick = async () => {
    if (s.status !== 'swiping') return running.delete(s.id);
    const target = Math.min(s.deck.length, progress(s, human.id) + 2);
    const next = s.deck.find((o) => s.votes[bot.id]?.[o.id] === undefined);
    if (!next || progress(s, bot.id) >= target) return running.delete(s.id);

    const outcome = applyVote(s, bot.id, next.id, ...botVote(bot.id, next));
    hooks?.onChange(s);
    if (outcome.kind === 'matched') {
      await hooks?.onMatch(s, bot);
      return running.delete(s.id);
    }
    setTimeout(tick, STEP_MS);
  };
  setTimeout(tick, STEP_MS);
}
