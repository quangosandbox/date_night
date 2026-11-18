# Date Night — Product Spec & Logic Flow

> Two people swipe on real, bookable options until they agree. Then the app books it.

## 1. Problem

Couples burn 20+ minutes going "I don't know, what do you want?" The real blockers are:

1. **Indecision** — too many options, nobody wants to be the one who picks.
2. **Dead ends** — you finally agree on a place and it has no tables at 7:30.
3. **Busywork** — someone still has to open Resy/OpenTable/Fandango and book.

Date Night solves all three: it only ever shows options that are **actually available in the time window you chose**, lets both partners vote privately, and **books the first mutual match automatically**.

## 2. Core principles

| Principle | What it means in the product |
|---|---|
| Only show what's bookable | Every card in the deck has at least one open slot in the filter window. No "sorry, fully booked" after a match. |
| Votes are private | You never see your partner's swipes — only matches. Removes social pressure. |
| One match is enough | The first mutual "yes" ends the session and books. No second-guessing. |
| Zero-typing booking | Party size, name, phone and payment are stored once at onboarding. |
| Never a dead end | Deck runs out → show near-misses, offer to widen filters or let fate decide among your likes. |

## 3. Users & roles

- **Partner A / Partner B** — two accounts linked as a **Couple** (1:1). Either can start a session.
- **Session host** — whoever starts the session; sets filters. The partner can see filters and nudge, but filters lock once both start swiping (so the deck is identical for both).

## 4. Domain model

```
User        { id, name, phone, avatarColor, coupleId }
Couple      { id, inviteCode, memberIds[2] }
Session     { id, coupleId, mode: 'dinner'|'movie', filters, status, deck[], swipes{userId:{optionId:vote}}, matchId?, booking? }
Filters     { date, windowStart, windowEnd, partySize, area, radiusMi,
              dinner: { cuisines[], prices[1-4] }, movie: { genres[], formats[] } }
Option      { id, kind, provider, title, subtitle, image, rating, tags[], meta, slots[] }
Slot        { id, time, label, providerRef }
Swipe       'like' | 'pass' | 'super'
Booking     { optionId, slot, provider, confirmation, bookedBy, bookedAt }
```

Session status machine:

```
draft ──(host confirms filters)──▶ swiping ──(mutual like)──▶ matched ──(book ok)──▶ booked
                                     │                         │
                                     │                         └─(slot gone)─▶ try next slot ─▶ none left ─▶ swiping (option removed)
                                     └─(both exhausted deck)──▶ exhausted ──(widen filters)──▶ swiping
                                                                     └──(let fate pick)──▶ matched
```

## 5. Logic flow

### 5.1 Onboarding (once)
1. Enter first name + phone (used for reservations). No password in MVP — device token.
2. **Create couple** → get a 6-character invite code + share link, **or** **join** with partner's code.
3. Until the partner joins, you can browse the deck in "solo preview" but cannot match.

### 5.2 Start a session
1. Pick **Dinner** or **Movie**.
2. Filters (sensible defaults pre-filled — the whole step can be one tap):
   - **When**: Tonight / Tomorrow / pick date; time window (default 7:00–9:00 PM).
   - **Where**: neighborhood + radius.
   - **Dinner**: cuisines (multi), price ($–$$$$).
   - **Movie**: genres (multi), format (Standard / IMAX / Dolby).
   - Party size defaults to 2.
3. Partner gets a push/in-app prompt: "Alex started a dinner date for tonight 7–9 PM. Start swiping."

### 5.3 Build the deck (server)
1. **Discover** candidates from providers in the area (Google Places for restaurants; theater showtimes for movies).
2. **Check availability** in parallel (Resy + OpenTable for restaurants, showtime provider for movies) for the date/window/party size.
3. **Drop** anything with zero slots in the window.
4. **De-dupe** restaurants listed on both Resy and OpenTable (match by normalized name + address); keep the union of slots, prefer the provider with the slot closest to the window's midpoint.
5. **Rank**: rating × review-volume confidence, + boost for slots near midpoint, + boost for filter matches. Movies: Letterboxd average rating, + **big boost if the film is on either partner's Letterboxd watchlist** ("On both your watchlists!" badge).
6. Cap at 30 cards. Both partners get the **same deck in the same order** — this maximizes the chance you both reach the same card early.

### 5.4 Swiping
- Right = like, left = pass, up/star = **super like** (shown as "Must-try" to partner *only on a match*; also used for tie-breaks).
- Each swipe is posted to the server immediately (idempotent per user/option).
- **Match rule**: an option is a match the instant both users have `like` or `super` on it. Evaluated server-side on every swipe — the second swiper triggers it.
- If two matches would happen simultaneously (race), the first committed wins; the session transitions atomically.
- Both clients receive the `matched` event in real time (Server-Sent Events) and show the match screen, even mid-swipe.

### 5.5 Booking
1. On match, pick the **best slot**: closest to the window midpoint, ties → earliest.
2. Session setting `autoBook` (default **on**): server books immediately using the matcher's saved details. With autoBook off, either partner taps "Book 7:30 PM" and can choose another slot.
3. Re-verify availability at booking time. If the slot vanished → try next-best slot. If no slots remain → remove the option, notify both ("That one just filled up — keep swiping"), return to `swiping`.
4. On success: confirmation code, add-to-calendar, directions, and "Share with partner" (both already see it).
5. Movies: tickets require payment; in MVP we create a hold/deep link to checkout with seats pre-selected. Restaurants: most bookings need no payment (card-guarantee venues prompt for card on file).

### 5.6 Deck exhausted
When both partners have swiped every card with no match:
- **Near misses**: options one of you liked (super likes first). Either partner can tap "I'd go there" to convert a partner's like into a match.
- **Widen**: one-tap +30 min window, +1 mi radius, or clear cuisine filter → rebuild deck (excluding already-passed-by-both).
- **Let fate decide**: random pick among options *either* of you liked, weighted toward super likes.

## 6. Provider integrations (reality check)

| Source | Use | Access |
|---|---|---|
| **Google Places API (New)** | Restaurant discovery, photos, ratings, hours, address | Public, API key, pay-as-you-go |
| **Resy** | Availability + booking | No public API. Requires a partnership (Resy for Partners / Amex). |
| **OpenTable** | Availability + booking | Partner/Affiliate API, application required. Fallback: deep link to booking page with date/time/party pre-filled. |
| **Letterboxd** | Film ratings, posters, **users' watchlists** | API access by application only. Fallback: TMDB for metadata + user-uploaded Letterboxd CSV export for watchlists. |
| **Showtimes & tickets** | Letterboxd has no showtimes | Needs a showtime provider: Fandango/Atom affiliate, MovieGlu, or Gracenote. |

Architecture consequence: every source sits behind a **provider adapter interface** (`discover`, `availability`, `book`). The MVP ships with **mock adapters** generating realistic data so the full experience is testable today; real adapters drop in as partnerships land. When an adapter can only deep-link (no booking API), the booking step returns a pre-filled link and the confirmation screen says "Tap to confirm on OpenTable".

## 7. Screens

1. **Welcome** — value prop, "Get started".
2. **Pair up** — create (show code) / join (enter code). Waiting state animates until partner joins.
3. **Home** — "Plan tonight": two big tiles (Dinner / Movie), recent bookings.
4. **Filters** — one screen, defaults pre-filled, single primary CTA "Start swiping".
5. **Swipe deck** — full-bleed card, photo, name, rating, price/genre, distance, **available time chips**. Buttons: pass / super / like. Progress "12 of 30". Partner status pill ("Sam is swiping").
6. **It's a match** — celebratory, the option, chosen slot, auto-booking spinner → confirmed.
7. **Booked** — confirmation, calendar, directions, "Plan another".
8. **No match** — near misses, widen, let fate decide.

## 8. Non-functional

- Mobile-first web app (PWA-installable); works one-handed; 44px+ touch targets; full keyboard support (← → ↑ on desktop).
- Real-time updates < 1s via SSE; clients re-sync state on reconnect.
- Swipes are private: API never returns partner's votes, only match results and partner progress count.
- Idempotent booking (one booking per session, guarded server-side).

## 9. Metrics

- Time from session start → booking (target: < 3 min median).
- Match rate per session; % sessions ending in "let fate decide".
- Booking failure rate after match (target < 2% thanks to availability-first deck).

## 10. Out of scope (MVP)

Group dates (>2 people), payments in-app, reviews, chat, ride booking. Future: "Dinner + movie" combo sessions where the deck pairs a restaurant slot with a showtime 90+ min later nearby.
