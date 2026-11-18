import type { Option } from '../../../shared/types.ts';

// Generative card art: an oversized motif per cuisine/genre in the option's palette.
// Real deployments would use provider photos (Google Places) or posters (Letterboxd/TMDB).
const MOTIFS: Record<string, string> = {
  pasta: 'M-10 40c20-20 40 20 60 0s40 20 60 0 40 20 60 0M-10 70c20-20 40 20 60 0s40 20 60 0 40 20 60 0M-10 100c20-20 40 20 60 0s40 20 60 0 40 20 60 0M-10 130c20-20 40 20 60 0s40 20 60 0 40 20 60 0',
  wave: 'M0 60q25-30 50 0t50 0 50 0 50 0M0 95q25-30 50 0t50 0 50 0 50 0M0 130q25-30 50 0t50 0 50 0 50 0',
  sun: 'M100 80m-24 0a24 24 0 1 0 48 0a24 24 0 1 0-48 0M100 80m-46 0a46 46 0 1 0 92 0a46 46 0 1 0-92 0M100 80m-70 0a70 70 0 1 0 140 0a70 70 0 1 0-140 0',
  wine: 'M80 20h40c0 40-4 56-20 60-16-4-20-20-20-60zM100 80v50M80 130h40',
  leaf: 'M40 140C40 70 90 30 160 30c0 70-40 110-110 110zM40 140 140 40M70 110h40M95 85h35',
  flame: 'M100 150c-30 0-46-22-40-50 5-22 24-30 22-60 26 14 52 44 48 80-2 20-12 30-30 30zM100 150c-12 0-18-10-14-22 3-10 12-14 14-28 12 10 20 22 14 36-3 8-8 14-14 14z',
  lantern: 'M70 50h60v80H70zM85 40h30v10H85zM85 130h30v10H85zM100 140v18M70 70h60M70 90h60M70 110h60',
  moon: 'M120 30a55 55 0 1 0 0 100 45 45 0 1 1 0-100z',
  eye: 'M30 80q70-60 140 0-70 60-140 0zM100 80m-22 0a22 22 0 1 0 44 0a22 22 0 1 0-44 0',
  heart: 'M100 150s-60-36-70-74C22 46 40 24 64 24c16 0 26 9 36 22 10-13 20-22 36-22 24 0 42 22 34 52-10 38-70 74-70 74z',
  orbit: 'M100 80m-20 0a20 20 0 1 0 40 0a20 20 0 1 0-40 0M20 80a80 28 -20 1 0 160 0a80 28 -20 1 0-160 0',
  star: 'M100 20l16 42 44 4-34 28 11 44-37-24-37 24 11-44-34-28 44-4z',
  compass: 'M100 80m-60 0a60 60 0 1 0 120 0a60 60 0 1 0-120 0M100 30l14 50-14 50-14-50z',
};

export function CardArt({ option, poster, className }: { option: Option; poster?: boolean; className?: string }) {
  const { bg, fg, motif } = option.art;
  let h = 0;
  for (const c of option.id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const rot = (h % 40) - 20;
  const dx = (h % 60) - 10;
  return (
    <div className={`card-art ${className ?? ''}`} style={{ background: bg, color: fg }}>
      <svg className="motif" viewBox="0 0 200 160" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <g transform={`translate(${dx} -6) rotate(${rot} 100 80) scale(1.25) translate(-20 -16)`} fill="none" stroke={fg} strokeOpacity="0.28" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d={MOTIFS[motif] ?? MOTIFS.star} />
        </g>
      </svg>
      {poster && <div className="card-poster-title" style={{ color: fg }}>{option.title}</div>}
    </div>
  );
}
