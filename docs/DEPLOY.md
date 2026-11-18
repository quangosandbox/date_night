# Deploy: Vercel + Neon

The beta runs as **one Vercel project** (static web app + one Node function at `/api/*`) backed by
**one Neon Postgres database**.

## How it works on Vercel
- `npm run build:vercel` writes a prebuilt bundle to `.vercel/output` (Build Output API v3):
  the web app as static files, and `server/vercel.ts` bundled into a single function.
- Every API request is one Postgres transaction. It loads the caller, **locks their couple's row**, loads the
  couple's members and recent sessions, runs the same core logic as every other build, then writes back only
  what changed. Locking the couple means simultaneous swipes can't overwrite each other.
- The table (`dn_docs`) is created automatically on the first request. No migration step.
- Serverless functions can't hold live connections, so phones **poll every 2.5 s** for partner updates, and the
  demo partner swipes instantly within the same request.

## Environment variables (Vercel → Project → Settings → Environment Variables)
| Name | Value |
|---|---|
| `DATABASE_URL` | Neon connection string (pooled), with `sslmode=require` |
| `GOOGLE_PLACES_API_KEY` | Your Google key. **You add this yourself**; it's never shared with Claude. Without it the app runs on demo restaurants. |
| `ALLOWED_ORIGINS` | Optional, extra origins allowed to call the API (the iOS app's `capacitor://localhost` is always allowed) |

After adding or changing a variable, redeploy for it to take effect.

## Deploy
```bash
npm install
npm run build:vercel
npx vercel deploy --prebuilt --prod
```

## Point the iPhone app at it
```bash
API_URL=https://<your-project>.vercel.app npm run ios:online
```

## Test locally against Postgres
`DN_PG_TEST=1 npx vitest run server/vercel.test.ts` starts an embedded Postgres and runs the Vercel entry
through pairing, simultaneous swipes, booking and the demo partner.
