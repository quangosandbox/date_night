import { Component, type ReactNode } from 'react';
import { report } from '../report.ts';
import { Chopsticks } from './Brand.tsx';

/** If a screen crashes, say so plainly and offer a way home instead of a blank page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown, info: { componentStack?: string | null }) {
    report(error, `react${info.componentStack ? `:${info.componentStack.split('\n').filter(Boolean)[0]?.trim()}` : ''}`);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="app">
        <div className="screen handoff">
          <Chopsticks size={72} color="#FFF7EE" />
          <div className="note" style={{ color: 'var(--tamago)', fontSize: 26 }}>well, that's embarrassing —</div>
          <h1 className="h1" style={{ fontSize: 40 }}>Something broke on this screen.</h1>
          <p className="lede" style={{ color: 'var(--cream)' }}>We've been told about it. Your swipes and dates are saved.</p>
          <div className="spacer" />
          <button className="btn btn-red btn-block" onClick={() => location.reload()}>Take me home</button>
        </div>
      </main>
    );
  }
}
