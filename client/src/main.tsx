import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { installErrorReporting } from './report.ts';
// Fonts are bundled so the iOS app works offline.
import '@fontsource/dela-gothic-one/latin-400.css';
import '@fontsource/gochi-hand/latin-400.css';
import '@fontsource-variable/instrument-sans/index.css';
import '@fontsource/dm-mono/latin-400.css';
import '@fontsource/dm-mono/latin-500.css';
import './styles.css';

installErrorReporting();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
