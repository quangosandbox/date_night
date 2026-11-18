# Launch checklist

**Goal:** private beta by **Sun, Nov 22, 2026**, with 10–20 real couples on two phones.

**Beta scope (decided Nov 18)**
- **Dinner only.** Movies, shows and concerts show as "coming soon."
- **Google Maps is the only data source.** No Resy/OpenTable applications yet; nothing about the idea is shared with them.
- **Handoff booking.** The deck shows only places that are open for a full dinner in your window and take reservations. After a match, you reserve on the place's Google Maps page (its "Reserve a table" button), its website, or by phone, then tap "We're booked for 8:00" so the date counts for ratings.
- **Invite-only** via TestFlight and a private web link.

**Owner key:** 🙋 you · 🤖 Claude (in this repo) · ✅ done

---

## Wed, Nov 18: decide and start approvals

- [x] ✅ Beta scope (above)
- [ ] 🙋 Check that "Date Night" is free on the App Store and as a domain. It's generic, so keep a backup name ready.
- [ ] 🙋 Enroll in the **Apple Developer Program** ($99/yr). Individual enrollment can be approved within a day or two; a company needs a D-U-N-S number, which takes much longer.
- [ ] 🙋 **Google Cloud key**
  1. Create a project and turn on billing.
  2. Enable **Places API (New)**.
  3. Create an API key and restrict it to Places API (New). Once the server is hosted, also restrict it to the server's IP address.
  4. **Set a budget alert.** The card uses photos, reviews and opening hours, which puts searches in Google's most expensive Text Search tier. Check the current price per 1,000 requests on the pricing page. Each new deck costs 1–6 searches, and repeat searches are cached for 10 minutes.
  5. Hand the key over through the secure credential form, never in chat or a commit.
- [ ] 🙋 Buy the domain.

## Thu, Nov 19: make it real

**Done today ✅**
- [x] ✅ Google Places adapter: real restaurants, listing photos, ratings, reviews, website, phone, opening hours, "takes reservations"
- [x] ✅ Deck only shows places open for a full dinner in your window that serve dinner and take reservations
- [x] ✅ Handoff booking: match → Reserve on Maps / Website / Call → "We're booked for 8:00" → rate it later; "No table?" drops it and you keep swiping
- [x] ✅ Google attribution on every card, plus photo and review author credits with links
- [x] ✅ Saved dates don't keep Google reviews or descriptions (Google's terms limit storing their content). Have a lawyer confirm the details.
- [x] ✅ Movies hidden behind a "coming soon" tile
- [x] ✅ Tests for the Google mapping, opening hours (including late-night places), the handoff flow and "no table"

**Still to do**
- [ ] 🤖 Plug in your key and test against live Google: result quality per neighborhood, photo loading, cost per deck. **Blocked on the key.**
- [ ] 🙋 Confirm the beta city. Neighborhoods are New York only right now (West Village, LES, Williamsburg, Park Slope, Midtown, Harlem).
  - [ ] 🤖 If you're launching elsewhere, swap the list or add "use my location."
- [ ] 🙋 Pick a host for the server (Render, Fly or Railway) and create an account.
- [ ] 🤖 Deploy the server with Postgres so two phones can pair and match live, and point the iOS app at it. The on-device mode stays for the demo.
- [ ] 🤖 Phone sign-in with a texted code, replacing device-only identity.
- [ ] 🤖 Error tracking, plus launch metrics: time to match, match rate, handoff tap-through, "we booked it" rate, rating rate.

## Fri, Nov 20: ship the beta

- [ ] 🙋 Privacy policy and support page. You collect names, phone numbers and dining history; the policy should also say place data comes from Google.
- [ ] 🙋 App Store Connect: create the app, fill in the App Privacy labels, add screenshots.
- [ ] 🙋 Build in Xcode, upload to **TestFlight**, submit for Beta App Review (testers outside your account need it; typically about a day). Steps: [`docs/IOS.md`](IOS.md).
- [ ] 🤖 Put the web version live on your domain the same day, as a backup if TestFlight review is slow.
- [ ] 🤖 Short landing page with an invite sign-up.

## Sat–Sun, Nov 21–22: real couples

- [ ] 🙋 Run a real date night yourself on two phones: swipe → match → reserve → go → rate.
- [ ] 🙋 Invite the first 10 couples. Ask each one specific question (e.g. "Did the match feel like something you both wanted?").
- [ ] 🤖 Triage and fix what breaks, same day.

---

## Next up after the beta

### Shows, concerts & live events (new mode)
A tile next to Dinner: comedy, concerts, theater, sports.

- [ ] 🤖 **Data source:** Ticketmaster Discovery API (free key) for events, images, venues, price ranges and on-sale status. Consider SeatGeek as a second source for resale availability.
  - 🙋 Get the Ticketmaster developer key.
- [ ] 🤖 **Filters:** date, time window, distance, category (concert / comedy / theater / sports / other), max price per ticket, "only if 2 seats together are available."
- [ ] 🤖 **Card content:** event image, headliner + lineup, venue and distance, price range, doors and start time, how close to selling out, short description, links.
- [ ] 🤖 **Deck rule:** only show events with tickets on sale for at least 2 people in the window.
- [ ] 🤖 **Booking:** handoff to the ticket seller for 2 tickets. In-app purchase needs an affiliate or partner deal.
  - 🙋 Look into the Ticketmaster affiliate program (and SeatGeek's partner program).
- [ ] 🤖 **Rating & learning:** rate the show like a date; learn categories, genres, venues and price comfort.

### Later
- [ ] 🙋 Apply to **Resy / OpenTable** partner programs when you're ready. That unlocks live table times and booking inside the app (the code is already built for it: `BOOKING_MODE=auto`).
- [ ] Movies back in, with a real showtime source (Fandango/Atom affiliate, MovieGlu or Gracenote) and Letterboxd once API access is approved.
- [ ] **Dinner + a show combos:** match on a pair (restaurant + event or showtime nearby, ~90 min apart).
- [ ] Public App Store submission after the beta feedback round.
