# Bakkie app — notes for Claude

Two people build this app together (Megan and a friend). We stay in sync through GitHub.

## Before you start working — catch up on what happened last

At the start of a session, read these so you know the current state:

1. **`WORKLOG.md`** — the newest entry (top of the file) says what the other person changed last and why.
2. **Recent git history** — run `git log --oneline -10` to see the last handful of changes.
3. Pull the latest before making changes: `git pull`

## After you make a meaningful change — leave a note for the other person

1. Add a short, plain-English entry to the TOP of `WORKLOG.md`: what you changed, why, and anything half-finished.
2. Write a clear commit message describing the change.
3. Push so the other person can pull it.

Keep entries plain and friendly — the other person may not be technical, and their Claude reads these too.

## How the app works (quick orientation)

- React + Vite app, wrapped with Capacitor to run as an Android APK.
- Data lives on the device in localStorage (`src/lib/storage.js`, `threads.js`,
  `drivers.js`, `customers.js`) AND, when a backend is configured, syncs to
  Supabase so two phones share it — see `src/lib/sync.js` and `supabase/schema.sql`.
- The backend is optional by design. With no `.env` the app is exactly the
  old single-device prototype, and Vite compiles Supabase out of the bundle.
  To run against the backend, copy `.env.example` to `.env` and fill it in.
- The APK gets those values from GitHub repository secrets — see the build
  workflow. If they're missing the build fails on purpose, because an APK
  without them looks fine but never syncs.
- Who is signed in is deliberately NOT synced; that stays per-device.
- The database policies are wide open for testing. Real auth must replace them
  before real users — see the warning at the top of `supabase/schema.sql`.
- Full collaboration guide for humans: `COLLABORATION.md`.

## Setting up on a second machine (Daniel)

The app runs with no setup at all — `npm install`, `npm run dev`, done. That
gives you the single-device version: everything saves to your own browser and
nothing is shared. Fine for working on screens and layout.

To see the same data as Megan's phone, you need the backend switched on:

1. `cp .env.example .env`
2. Ask Megan for the two values (the Supabase project URL and the key) and paste
   them in. **They are deliberately not in this repo** — the repo is public, and
   while the database policies are still wide open for testing, anyone who found
   the key could read and write everything in it.
3. `npm run dev` again — Vite only reads `.env` at startup, so a running server
   will not pick it up.

`.env` is git-ignored. Never commit it.

To check it is actually on: with the backend configured the app fetches from
`supabase.co` on load. With it off, Supabase is compiled out of the bundle
entirely, so there is nothing to see in the network tab.

### Known rough edges — please read before spending time on these

- **Live push does not work yet.** Supabase's realtime WebSocket rejects the
  new-style `sb_publishable_` key because it wants a JWT. Until the project's
  legacy anon key is available, the app re-reads every 2.5 seconds instead, so
  the other phone updates within a few seconds rather than instantly. Details in
  `WORKLOG.md`.
- Photos and star ratings used to be listed here as broken. Both are fixed:
  photos are shrunk before saving (`src/lib/photos.js`) so they no longer blow
  the storage limit, and the browse cards show real customer ratings, falling
  back to the seeded star marked "no rating yet".
