import { useEffect, useState } from 'react';
import type { AppState, Mode } from '../../shared/types.ts';
import { useAppState, useMeta } from './api.ts';
import { Filters } from './screens/Filters.tsx';
import { Home } from './screens/Home.tsx';
import { Match } from './screens/Match.tsx';
import { NoMatch } from './screens/NoMatch.tsx';
import { PairUp } from './screens/PairUp.tsx';
import { Swipe } from './screens/Swipe.tsx';
import { Welcome } from './screens/Welcome.tsx';

export interface ScreenProps {
  state: AppState;
  apply: (s: AppState) => void;
}

export function App() {
  const { state, loading, apply } = useAppState();
  const meta = useMeta();
  const [planning, setPlanning] = useState<Mode | null>(null);

  // Whoever starts a session, both partners jump straight into the deck.
  const sessionId = state?.session?.id;
  useEffect(() => setPlanning(null), [sessionId]);

  const screenKey = !state ? 'welcome' : !state.partner ? 'pair' : state.session ? `${state.session.id}:${state.session.status}` : planning ?? 'home';
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [screenKey]);

  let screen;
  if (loading) screen = <div className="screen" aria-busy="true" />;
  else if (!state) screen = <Welcome apply={apply} />;
  else if (!state.partner) screen = <PairUp state={state} apply={apply} />;
  else if (state.session?.status === 'swiping') screen = <Swipe state={state} apply={apply} />;
  else if (state.session && (state.session.status === 'matched' || state.session.status === 'booked'))
    screen = <Match state={state} apply={apply} />;
  else if (state.session?.status === 'exhausted') screen = <NoMatch state={state} apply={apply} />;
  else if (planning && meta) screen = <Filters key={planning} mode={planning} meta={meta} state={state} apply={apply} onBack={() => setPlanning(null)} />;
  else screen = <Home state={state} apply={apply} onPlan={setPlanning} />;

  return <main className="app">{screen}</main>;
}
