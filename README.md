# Date Night

Two people swipe on restaurants or movies that are **actually bookable in the time window you chose**. The first spot you both say yes to gets booked automatically.

- **Product spec & logic flow:** [`docs/PRODUCT_SPEC.md`](docs/PRODUCT_SPEC.md)

## Run it

```bash
npm install
npm run dev        # API on :8787, web app on http://localhost:5173
```

Try it alone: open the app, enter a name, then tap **"Try it with a demo partner"** — a bot partner swipes alongside you.

Try it as two people on one machine: open `http://localhost:5173/` and `http://localhost:5173/?u=2` in two tabs (the `u` param gives each tab its own identity). Share the invite code from one tab and join from the other, or open the invite link `/?join=CODE&u=2`.

```bash
npm test           # matching/booking engine + deck builder tests
npm run typecheck
npm run build && npm start   # production: one server on :8787 serving the built app
```

## How it works

```
client/ (React, mobile-first PWA)      server/ (Express)
  Welcome → Pair → Home → Filters        deck.ts     discover → availability → drop unbookable → rank
  → Swipe → Match/Booked | No match      engine.ts   votes, match on 2nd "yes", near misses, fate, booking fallback
        ▲  Server-Sent Events  │         bot.ts      demo partner
        └──────────────────────┘         providers/  adapter interfaces + mock Google/Resy/OpenTable/Letterboxd/showtimes
```

- Both partners get the **same deck in the same order**; votes are private (the API only exposes your own votes and your partner's progress count).
- A match happens the instant the second partner says yes. With auto-book on, the server books the slot closest to the middle of your window, falling back to the next slot if one vanished, and drops the option (back to swiping) if none are left.
- Run out of cards? You get near misses ("I'm in" on your partner's likes), one-tap widening (±1 hour, +1.5 miles, any cuisine), or **Let fate decide**.

## Integrations

All data is currently from **mock adapters with fictional venues and films** (`server/providers/mock.ts`). Real adapters implement the interfaces in `server/providers/types.ts` and are swapped in at `server/providers/index.ts`:

| Service | Status / access |
|---|---|
| Google Places API (New) | Public API, needs an API key — discovery, photos, ratings |
| Resy | No public API — needs a partnership |
| OpenTable | Partner/affiliate API by application; deep links as a fallback |
| Letterboxd | API by application; TMDB + watchlist CSV import as a fallback |
| Showtimes & tickets | Letterboxd has none — needs Fandango/Atom, MovieGlu or Gracenote |

Storage is an in-memory store persisted to `data/db.json`; swap for Postgres/Redis before running more than one server.
