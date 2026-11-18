// A playful stylized map: your neighborhood pin, the spot's pin, and a dotted route between them.
export function MiniMap({ seed, distanceMi, from, to }: { seed: string; distanceMi: number; from: string; to: string }) {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const spread = Math.min(1, Math.max(0.25, distanceMi / 3));
  const ax = 58;
  const ay = 86;
  const bx = ax + 60 + spread * 150;
  const by = 30 + (h % 50);
  const midX = (ax + bx) / 2;
  const midY = Math.min(ay, by) - 18;

  return (
    <div className="mini-map">
      <svg viewBox="0 0 320 128" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" role="img" aria-label={`${to} is ${distanceMi} miles from ${from}`}>
        <rect width="320" height="128" fill="#F3E9D8" />
        {/* water + park */}
        <path d="M0 108 C60 98 110 124 180 112 S290 100 320 112 V128 H0 Z" fill="#EC9177" opacity="0.55" />
        <rect x={(h % 120) + 150} y="66" width="54" height="30" rx="10" fill="#9DAF6E" opacity="0.7" />
        {/* streets */}
        <g stroke="#1A1414" strokeOpacity="0.12" strokeWidth="6" strokeLinecap="round">
          <path d="M-10 40 L330 22" />
          <path d="M-10 78 L330 60" />
          <path d="M40 -10 L70 140" />
          <path d="M140 -10 L170 140" />
          <path d="M240 -10 L270 140" />
        </g>
        <path d={`M${ax} ${ay} Q${midX} ${midY} ${bx} ${by}`} fill="none" stroke="#1A1414" strokeWidth="2.5" strokeDasharray="2 6" strokeLinecap="round" />
        {/* from pin */}
        <circle cx={ax} cy={ay} r="9" fill="#1A1414" />
        <circle cx={ax} cy={ay} r="3.5" fill="#FFF7EE" />
        {/* to pin */}
        <g transform={`translate(${bx} ${by})`}>
          <path d="M0 14 C-10 2 -11 -2 -11 -6 A11 11 0 1 1 11 -6 C11 -2 10 2 0 14 Z" fill="#E8473F" stroke="#1A1414" strokeWidth="2" />
          <circle cy="-6" r="3.5" fill="#1A1414" />
        </g>
        <g fontFamily="DM Sans, sans-serif" fontWeight="800" fontSize="10" fill="#1A1414">
          <text x={ax - 14} y={ay + 22}>{from}</text>
        </g>
      </svg>
    </div>
  );
}
