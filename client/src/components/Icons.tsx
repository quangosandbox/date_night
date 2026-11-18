import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement> & { size?: number };
const base = (size = 20, rest: SVGProps<SVGSVGElement>) => ({
  width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2,
  strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true, ...rest,
});

export const Back = ({ size, ...r }: P) => <svg {...base(size, r)}><path d="M19 12H5M11 6l-6 6 6 6" /></svg>;
export const House = ({ size, ...r }: P) => <svg {...base(size, r)}><path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 9.5V20h13V9.5" /><path d="M10 20v-5h4v5" /></svg>;
export const Close = ({ size, ...r }: P) => <svg {...base(size, r)}><path d="M6 6l12 12M18 6 6 18" /></svg>;
export const Arrow = ({ size, ...r }: P) => <svg {...base(size, r)}><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
export const Check = ({ size, ...r }: P) => <svg {...base(size, r)}><path d="m5 12 5 5 9-10" /></svg>;
export const Pin = ({ size, ...r }: P) => <svg {...base(size, r)}><path d="M12 22s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12z" /><circle cx="12" cy="10" r="2.5" /></svg>;
export const Share = ({ size, ...r }: P) => <svg {...base(size, r)}><path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" /><path d="M16 6l-4-4-4 4M12 2v13" /></svg>;
export const Fork = ({ size, ...r }: P) => <svg {...base(size, r)}><path d="M7 3v8a2 2 0 0 0 2 2v8" /><path d="M5 3v5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2V3" /><path d="M17 21V3c-2 1-3 3-3 6v4h3" /></svg>;
export const Film = ({ size, ...r }: P) => <svg {...base(size, r)}><rect x="3" y="7" width="18" height="13" rx="2" /><path d="m3 7 4-4M10 7l4-4M17 7l4-4" /></svg>;
export const Calendar = ({ size, ...r }: P) => <svg {...base(size, r)}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></svg>;
export const Dice = ({ size, ...r }: P) => (
  <svg {...base(size, r)}><rect x="3" y="3" width="18" height="18" rx="4" /><circle cx="8.5" cy="8.5" r="1.2" fill="currentColor" /><circle cx="15.5" cy="15.5" r="1.2" fill="currentColor" /><circle cx="12" cy="12" r="1.2" fill="currentColor" /></svg>
);
export const User = ({ size, ...r }: P) => <svg {...base(size, r)}><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></svg>;
export const Star = ({ size = 20, ...r }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...r}><path d="m12 2 3 6.5 7 .8-5.2 4.8 1.5 7L12 17.6 5.7 21l1.5-7L2 9.3l7-.8z" /></svg>
);
export const Heart = ({ size = 20, ...r }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...r}><path d="M12 21s-7.5-4.6-9.4-9.3C1.3 8.4 3.4 5 6.8 5c2 0 3.5 1.1 5.2 3 1.7-1.9 3.2-3 5.2-3 3.4 0 5.5 3.4 4.2 6.7C19.5 16.4 12 21 12 21z" /></svg>
);
