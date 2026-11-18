# Run Date Night on your iPhone

The iOS app is a native shell (Capacitor) around the web app. It runs **fully on-device**:
the matching engine, demo partner, ratings and learning all run on the phone and save
locally — no server, no accounts, works offline. (Listing photos need internet; without it
cards fall back to their illustrated art.)

## What you need
- A Mac with **Xcode 16+** (free from the App Store)
- Node.js 20+
- Your iPhone + a USB cable (or the same Wi-Fi, after the first install)
- A free Apple ID is enough for installing on your own phone

## Steps
```bash
git clone <this repo> && cd date_night
git checkout claude/eager-newton-ync8kn
npm install
npm run ios            # builds the on-device app, syncs it into ios/, opens Xcode
```

In Xcode:
1. Select the **App** target → **Signing & Capabilities** → check *Automatically manage signing* →
   pick your Apple ID under **Team** (Xcode → Settings → Accounts to add it). If Xcode complains
   about the bundle id, change `app.datenight.couples` to something unique like `com.yourname.datenight`.
2. Plug in your iPhone, pick it as the run destination at the top, press **▶ Run**.
3. First time only, on the phone: **Settings → General → VPN & Device Management** → trust your
   developer certificate. On iOS 16+ also turn on **Settings → Privacy & Security → Developer Mode**.

Free-account installs expire after 7 days; just press Run again. After changing code:
`npm run ios:sync` and Run again.

## Playing
- **Demo partner** — on the pairing screen tap *Try it with a demo partner*; "Sam" swipes alongside you.
- **Pass-and-play** — add your partner's name; swipe, tap *Pass to …*, hand over the phone.
- After a match, tap *Done*, then rate the night from Home. Ratings reshape the next deck
  ("because you loved …"), and *Our list* ranks your dates Beli-style.

## No Mac handy?
`npm run build:share` produces a single self-contained page (`dist-artifact/index.html`) that runs
the same on-device build in Safari; add it to your Home Screen for an app-like icon.

## Two phones, live
For two phones in real time, run the server (`npm run build && npm start` on a computer) and open
`http://<computer-ip>:8787` on both phones (same Wi-Fi). The server build supports invite codes,
real-time matching and Google Places once `GOOGLE_PLACES_API_KEY` is set.
