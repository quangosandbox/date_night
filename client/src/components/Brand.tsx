// Brand pieces: the chopsticks mark (two sticks = two people), the sushi-plate illustration,
// and a photo that falls back to illustrated card art when a listing photo isn't available.
import { useState } from 'react';
import type { Option } from '../../../shared/types.ts';
import { CardArt } from './CardArt.tsx';
import { assetUrl } from '../api.ts';

export function Chopsticks({ size = 28, color = 'currentColor', tip = '#E8473F' }: { size?: number; color?: string; tip?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <g strokeLinecap="round">
        <path d="M7 3 L14 29" stroke={color} strokeWidth="3.2" />
        <path d="M25 3 L18 29" stroke={color} strokeWidth="3.2" />
        <path d="M7 3 L8.2 7.5" stroke={tip} strokeWidth="3.2" />
        <path d="M25 3 L23.8 7.5" stroke={tip} strokeWidth="3.2" />
      </g>
    </svg>
  );
}

export function Logo() {
  return (
    <div className="logo">
      <Chopsticks size={26} color="#1A1414" />
      date night
    </div>
  );
}

/** The reference plate: a black plate with nigiri on it. */
export function SushiPlate({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 200 200" aria-hidden="true">
      <circle cx="100" cy="100" r="92" fill="#1A1414" />
      <circle cx="100" cy="100" r="92" fill="none" stroke="#2B2322" strokeWidth="10" />
      <ellipse cx="72" cy="78" rx="24" ry="22" fill="#E8473F" />
      <g fill="#A3231D" opacity="0.5">{[0, 1, 2, 3, 4, 5].map((i) => <circle key={i} cx={62 + (i % 3) * 9} cy={70 + Math.floor(i / 3) * 12} r="2" />)}</g>
      <ellipse cx="128" cy="70" rx="22" ry="20" fill="#F0C53E" />
      <circle cx="124" cy="68" r="7" fill="#EB6B3A" />
      <ellipse cx="80" cy="132" rx="26" ry="20" fill="#EC9177" transform="rotate(-18 80 132)" />
      <path d="M70 128 q10 -6 20 2" stroke="#9DAF6E" strokeWidth="4" fill="none" strokeLinecap="round" />
      <circle cx="134" cy="126" r="20" fill="#9DAF6E" />
      <circle cx="134" cy="126" r="13" fill="#EEE0CA" />
      <g fill="#1A1414">{[0, 1, 2, 3].map((i) => <ellipse key={i} cx={128 + (i % 2) * 10} cy={121 + Math.floor(i / 2) * 9} rx="2" ry="1" />)}</g>
      <path d="M150 8 L60 196" stroke="#EEE0CA" strokeWidth="7" strokeLinecap="round" />
      <path d="M168 14 L76 198" stroke="#EEE0CA" strokeWidth="7" strokeLinecap="round" />
    </svg>
  );
}

/** A movie ticket illustration for the movie tile. */
export function TicketArt({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 200 200" aria-hidden="true">
      <g transform="rotate(-18 100 100)">
        <rect x="30" y="58" width="150" height="84" rx="14" fill="#FFF7EE" />
        <circle cx="30" cy="100" r="13" fill="#1A1414" />
        <circle cx="180" cy="100" r="13" fill="#1A1414" />
        <path d="M128 64 V136" stroke="#1A1414" strokeWidth="3" strokeDasharray="4 6" />
        <rect x="50" y="80" width="60" height="9" rx="4" fill="#E8473F" />
        <rect x="50" y="96" width="44" height="7" rx="3.5" fill="#1A1414" opacity="0.25" />
        <rect x="50" y="110" width="52" height="7" rx="3.5" fill="#1A1414" opacity="0.25" />
        <circle cx="154" cy="100" r="12" fill="#F0C53E" />
      </g>
    </svg>
  );
}

/** Listing photo with a source credit; illustrated art if there's no photo or it fails to load. */
export function Photo({ option, index = 0, className, credit = true, poster }: { option: Option; index?: number; className?: string; credit?: boolean; poster?: boolean }) {
  const photo = option.photos[index];
  const [failed, setFailed] = useState(false);
  if (!photo || failed) return index === 0 ? <CardArt option={option} className={className} poster={poster} /> : null;
  const label = photo.source === 'Sample' ? `sample photo${photo.attribution ? ` · ${photo.attribution}` : ''}` : `photo · ${photo.attribution ?? photo.source}`;
  return (
    <div className={`photo ${className ?? ''}`}>
      <img src={assetUrl(photo.url)} alt="" loading={index === 0 ? 'eager' : 'lazy'} onError={() => setFailed(true)} draggable={false} />
      {credit && (
        <span className="credit">
          {photo.attributionUrl ? <a href={photo.attributionUrl} target="_blank" rel="noreferrer">{label}</a> : label}
        </span>
      )}
    </div>
  );
}

export function Plate({ option, photo, art, seed = 'x', size = 52 }: { option?: Option; photo?: string; art?: Option['art']; seed?: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const url = photo ?? option?.photos[0]?.url;
  if (!option && art) option = { id: seed, title: '', art } as Option;
  return (
    <span className="plate" style={{ width: size, height: size }} aria-hidden="true">
      {url && !failed ? (
        <span><img src={assetUrl(url)} alt="" onError={() => setFailed(true)} draggable={false} /></span>
      ) : option ? (
        <span><CardArt option={option} className="fill" /></span>
      ) : (
        <span style={{ background: '#EC9177' }} />
      )}
    </span>
  );
}
