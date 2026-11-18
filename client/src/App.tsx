import { useEffect, useState } from 'react';
import type { AppState, Booking, Mode } from '../../shared/types.ts';
import { useAppState, useMeta } from './api.ts';
import { Chopsticks } from './components/Brand.tsx';
import { Filters } from './screens/Filters.tsx';
import { Home } from './screens/Home.tsx';
import { Match } from './screens/Match.tsx';
import { NoMatch } from './screens/NoMatch.tsx';
import { PairUp } from './screens/PairUp.tsx';
import { Rate } from './screens/Rate.tsx';
import { Swipe } from './screens/Swipe.tsx';
import { Welcome } from './screens/Welcome.tsx';

export interface ScreenProps {
  state: AppState;
  apply: (s: AppState) => void;
  switchTo: (userId: string) => void;
}

export function App() {
  const { state, loading, apply, switchTo: rawSwitch } = useAppState();
  // Pass-and-play: cover the screen between turns so nobody sees the other's swipes.
  const [handoff, setHandoff] = useState<string | null>(null);
  const switchTo = (uid: string) => {
    setHandoff(state?.partner?.name ?? 'your partner');
    rawSwitch(uid);
  };
  const meta = useMeta();
  const [planning, setPlanning] = useState<Mode | null>(null);
  const [rating, setRating] = useState<Booking | null>(null);

  // Whoever starts a session, both partners jump straight into the deck.
  const sessionId = state?.session?.id;
  useEffect(() => {
    setPlanning(null);
  }, [sessionId]);

  const screenKey = !state
    ? 'welcome'
    : !state.partner
      ? 'pair'
      : rating
        ? `rate:${rating.confirmation}`
        : state.session
          ? `${state.session.id}:${state.session.status}:${state.me.id}`
          : planning ?? `home:${state.me.id}`;
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [screenKey]);

  const props = state ? { state, apply, switchTo } : null;
  let screen;
  if (loading) screen = <div className="screen" aria-busy="true" />;
  else if (!props) screen = <Welcome apply={apply} />;
  else if (!props.state.partner) screen = <PairUp {...props} />;
  else if (rating) screen = <Rate {...props} booking={rating} onDone={() => setRating(null)} />;
  else if (props.state.session?.status === 'swiping') screen = <Swipe {...props} />;
  else if (props.state.session && (props.state.session.status === 'matched' || props.state.session.status === 'booked')) screen = <Match {...props} />;
  else if (props.state.session?.status === 'exhausted') screen = <NoMatch {...props} />;
  else if (planning && meta) screen = <Filters key={planning} mode={planning} meta={meta} {...props} onBack={() => setPlanning(null)} />;
  else screen = <Home {...props} meta={meta} onPlan={setPlanning} onRate={setRating} />;

  if (handoff)
    screen = (
      <div className="screen handoff">
        <Chopsticks size={72} color="#FFF7EE" />
        <div className="note" style={{ color: 'var(--tamago)', fontSize: 26 }}>no peeking —</div>
        <h1 className="h1" style={{ fontSize: 44 }}>Hand the phone to {handoff}.</h1>
        <div className="spacer" />
        <button className="btn btn-red btn-block" onClick={() => setHandoff(null)}>I'm {handoff} — let's go</button>
      </div>
    );

  return <main className="app">{screen}</main>;
}
