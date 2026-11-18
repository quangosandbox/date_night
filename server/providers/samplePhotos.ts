// Sample food/room photos (Unsplash, free to use) standing in for listing photos until the
// Google Places / Resy / OpenTable integrations are live. Loaded by the phone at runtime; the
// card falls back to its illustrated art if a photo can't load.
import type { Photo } from '../../shared/types.ts';
import { hash } from '../util.ts';

const u = (id: string) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=900&q=70`;

const DISH: Record<string, string[]> = {
  Italian: ['1563379926898-05f4575a45d8', '1565299624946-b28f40a0ae38', '1551183053-bf91a1d81141'],
  Japanese: ['1579871494447-9811cf80d66c', '1569718212165-3a8278d5f624', '1553621042-f6e147245754'],
  Mexican: ['1551504734-5ee1c4a1479b', '1565299585323-38d6b0865b47'],
  French: ['1414235077428-338989a2e8c0', '1600891964092-4316c288032e'],
  Thai: ['1559314809-0d155014e29e', '1562565652-a0d8f0c59eb4'],
  Korean: ['1590301157890-4810ed352733', '1498654896293-37aacf113fd9'],
  Indian: ['1565557623262-b51c2513a641', '1585937421612-70a008356fbe'],
  Mediterranean: ['1540189549336-e6e99c3679fe', '1546069901-ba9599a7e63c'],
  American: ['1550547660-d9450f859349', '1544025162-d76694265947'],
  Chinese: ['1496116218417-1a781b1c416c', '1525755662778-989d0524087e'],
};
const ROOMS = ['1517248135467-4c7edcad34c4', '1555396273-367ea4eb4db5', '1424847651672-bf20a4b0982b', '1552566626-52f8b828add9'];

export function sampleDishPhoto(venueId: string, cuisine: string): Photo {
  const list = DISH[cuisine] ?? DISH.American;
  return { url: u(list[hash(venueId) % list.length]), source: 'Sample', attribution: 'Unsplash' };
}

export function sampleRoomPhoto(venueId: string): Photo {
  return { url: u(ROOMS[hash(`room${venueId}`) % ROOMS.length]), source: 'Sample', attribution: 'Unsplash' };
}
