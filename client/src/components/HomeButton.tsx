import { House } from './Icons.tsx';

/** The one way back to Home, on every screen. */
export function HomeButton({ onClick, dark }: { onClick: () => void; dark?: boolean }) {
  return (
    <button className={`icon-btn${dark ? ' on-dark' : ''}`} onClick={onClick} aria-label="Home" title="Home">
      <House />
    </button>
  );
}
