# Work log — what changed last

Newest entry goes at the TOP. Write it like a note to the other person (and to their Claude):
plain English — what you changed, why, and anything half-finished they should know about.

When you (or Claude) make a meaningful change, add a short entry here before pushing.

---

## 2026-09-02 — Megan (later that day)
Added a real backend so two phones can finally see each other's data. Until now
every phone kept its own private copy, so you could never actually test a
customer booking a driver.

- The app now syncs to **Supabase** (Postgres, EU/Frankfurt). Vehicles, messages,
  bookings, ratings and accounts are shared; who is signed in stays per-phone,
  so you and the other person remain two different people.
- New files: `src/lib/supabase.js` (the connection), `src/lib/sync.js` (the
  syncing), `supabase/schema.sql` (the database setup, already applied).
- **It's optional.** With no `.env` file the app behaves exactly as it did
  before — one device, localStorage only — and Supabase is left out of the
  build entirely. Copy `.env.example` to `.env` to switch it on.
- The APK build now needs two repository secrets (`VITE_SUPABASE_URL` and
  `VITE_SUPABASE_ANON_KEY`). If they're missing the build stops with a clear
  message, because an APK without them installs fine and silently never syncs —
  which would be a horrible thing to debug.
- Tested end to end in the browser: sending a message saved it to the database,
  and a message added from outside appeared in the app in about 3 seconds
  without a refresh.

Still to do / know about:
- **Photos are not safe to use yet.** They're saved at full camera resolution,
  which overflows the phone's storage limit and now also means huge uploads.
  Needs shrinking before use — it silently loses listings today.
- **The database is wide open on purpose** for testing: anyone with the key can
  read and write everything. Real sign-in has to replace that before real users.
- "Reset demo data" only clears the phone, not the backend, so data comes back
  on the next load.
- Public star ratings still show the frozen seed number, not real ratings.

## 2026-09-02 — Megan
Set up collaboration so two of us can work on this app together.
- Added `COLLABORATION.md` (plain-English guide to push/pull/branches).
- Created the `friend-feature` branch as a starter example.
- Added this work log and a `CLAUDE.md` so each person's Claude reads what happened last.
- Nothing about the app itself changed yet — this was all setup.
- Next: friend (supercheese420) accepts the GitHub invite and clones the repo.
