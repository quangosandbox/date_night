// Opening hours → suggested times. With Google-only data there are no live tables, so the deck
// shows places that are open for (at least) a full dinner inside your window.
import type { Filters, Slot } from '../shared/types.ts';
import { fromMinutes, toMinutes } from './util.ts';

/** Google Places "periods": day 0 = Sunday. A period with no close means open 24 hours. */
export interface Period {
  open: { day: number; hour: number; minute?: number };
  close?: { day: number; hour: number; minute?: number };
}

export const MEAL_MINUTES = 75; // a table at 9:30 needs the kitchen open until ~10:45

/** Minute ranges (relative to midnight of `date`) when the place is open on that date. */
export function openIntervals(periods: Period[], date: string): [number, number][] {
  const day = new Date(`${date}T12:00:00`).getDay();
  const out: [number, number][] = [];
  for (const p of periods) {
    if (!p.close) return [[0, 48 * 60]]; // always open
    const start = p.open.hour * 60 + (p.open.minute ?? 0);
    let end = p.close.hour * 60 + (p.close.minute ?? 0);
    const spans = (p.close.day - p.open.day + 7) % 7;
    end += spans * 1440;
    if (spans === 0 && end <= start) end += 7 * 1440; // open all week
    if (p.open.day === day) out.push([start, end]);
    // A period that started yesterday and runs past midnight into today.
    if ((p.open.day + 1) % 7 === day && end > 1440) out.push([start - 1440, end - 1440]);
  }
  return out;
}

/** Suggested reservation times (every 15 min) inside the window when the place is open. */
export function slotsFromHours(placeId: string, periods: Period[] | undefined, f: Filters): Slot[] {
  if (!periods?.length) return [];
  const intervals = openIntervals(periods, f.date);
  const slots: Slot[] = [];
  for (let t = toMinutes(f.windowStart); t <= toMinutes(f.windowEnd); t += 15) {
    if (intervals.some(([a, b]) => t >= a && t + MEAL_MINUTES <= b)) {
      const time = fromMinutes(t);
      slots.push({ id: `handoff:${placeId}:${f.date}:${time}`, time, provider: 'handoff' });
    }
  }
  return slots;
}
