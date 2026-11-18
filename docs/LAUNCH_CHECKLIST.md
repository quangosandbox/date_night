# Launch checklist

**Goal:** private beta by **Sun, Nov 22, 2026**, with 10–20 real couples on two phones.

A public App Store launch isn't realistic this week: Resy/OpenTable partner approval takes weeks, and Apple's first review adds days. The beta is scoped so nothing waits on either.

**Owner key:** 🙋 you · 🤖 Claude (in this repo)

---

## Wed, Nov 18: decide, and start what takes time to approve

**Decisions**
- [ ] 🙋 Confirm beta scope:
  - **Dinner only.** There's no showtime source yet, so movies would show made-up films.
  - **Handoff booking.** After a match, tap through to Resy/OpenTable with date and party size filled in. Neither confirms bookings back to the app, so automatic booking and live open-table times wait for partner access.
  - **Invite-only**, 10–20 couples you know.
- [ ] 🙋 Check that "Date Night" is free on the App Store and as a domain. It's generic, so keep a backup name ready.

**Things with approval lead time**
- [ ] 🙋 Enroll in the **Apple Developer Program** ($99/yr). Individual enrollment can be approved within a day or two; a company needs a D-U-N-S number, which takes much longer.
- [ ] 🙋 **Google Cloud:** create a project, turn on billing, enable **Places API (New)**, create a key restricted to that API. Hand it over through the secure credential form, never in chat or a commit.
- [ ] 🙋 Apply to the **Resy** and **OpenTable** partner programs. Won't land this week; starts the clock.
- [ ] 🙋 Buy the domain.

## Thu, Nov 19: make it real

- [ ] 🙋 Pick a host for the server (Render, Fly or Railway) and create an account.
- [ ] 🤖 Switch restaurant discovery to real Google Places data. Remove the made-up venues and sample photos.
- [ ] 🤖 Show Google attribution wherever Google data appears (required by the Places API terms).
- [ ] 🤖 Build the handoff-to-book flow: match → "Book on Resy / OpenTable" with date, time window and party size pre-filled, plus "We booked it" to log the date for rating.
- [ ] 🤖 Deploy the server with a real database (Postgres) so two phones can pair and match live.
- [ ] 🤖 Point the iOS app at the hosted server (keep on-device mode for the demo).
- [ ] 🤖 Phone sign-in with a texted code, replacing device-only identity.
- [ ] 🤖 Error tracking, plus launch metrics: time to match, match rate, handoff tap-through, rating rate.
- [ ] 🤖 Hide the movie tile for the beta.

## Fri, Nov 20: ship the beta

- [ ] 🙋 Privacy policy and support page. You collect names, phone numbers and dining history.
- [ ] 🙋 App Store Connect: create the app, fill in the App Privacy labels, add screenshots.
- [ ] 🙋 Build in Xcode, upload to **TestFlight**, submit for Beta App Review (testers outside your account need it; typically about a day). Steps: [`docs/IOS.md`](IOS.md).
- [ ] 🤖 Put the web version live on your domain the same day, as a backup if TestFlight review is slow.
- [ ] 🤖 Short landing page with an invite sign-up.

## Sat–Sun, Nov 21–22: real couples

- [ ] 🙋 Run a real date night yourself on two phones: swipe → match → book → go → rate.
- [ ] 🙋 Invite the first 10 couples. Ask each one specific question (e.g. "Did the match feel like something you both wanted?").
- [ ] 🤖 Triage and fix what breaks, same day.

**Cut from this week:** movies, automatic booking, Letterboxd, public App Store release.

---

## Next up after the beta

### Shows, concerts & live events (new mode)
A third tile next to Dinner and A movie: comedy, concerts, theater, sports.

- [ ] 🤖 **Data source:** Ticketmaster Discovery API (free key) for events, images, venues, price ranges and on-sale status. Consider SeatGeek as a second source for resale availability.
  - 🙋 Get the Ticketmaster developer key.
- [ ] 🤖 **Filters:** date, time window, distance, category (concert / comedy / theater / sports / other), max price per ticket, "only if 2 seats together are available."
- [ ] 🤖 **Card content:** event image, headliner + lineup, venue and distance, price range, doors and start time, how close to selling out, short description, links (artist page, venue, preview track if available).
- [ ] 🤖 **Deck rule:** like dinner, only show events with tickets on sale for at least 2 people in the window.
- [ ] 🤖 **Booking:** handoff to the ticket seller (Ticketmaster/SeatGeek) for 2 tickets. In-app purchase needs an affiliate or partner deal.
  - 🙋 Look into the Ticketmaster affiliate program (and SeatGeek's partner program).
- [ ] 🤖 **Rating & learning:** rate the show like a date; learn categories, genres, venues and price comfort.
- [ ] 🙋 Decide whether events launch NYC-only like dinner.

### Also on deck
- [ ] Movies back in, with a real showtime source (Fandango/Atom affiliate, MovieGlu or Gracenote) and Letterboxd once API access is approved.
- [ ] Automatic booking with live open times once Resy/OpenTable partner access lands.
- [ ] **Dinner + a show combos:** match on a pair (restaurant slot + event or showtime nearby, ~90 min apart).
- [ ] Public App Store submission after the beta feedback round.
