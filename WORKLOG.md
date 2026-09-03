# Work log — what changed last

Newest entry goes at the TOP. Write it like a note to the other person (and to their Claude):
plain English — what you changed, why, and anything half-finished they should know about.

When you (or Claude) make a meaningful change, add a short entry here before pushing.

---

## 2026-09-04 — Megan — big UI update, now pushed to `main`

Hey! Busy day — lots of changes, and I've pushed all of it (plus the earlier
`my-changes` work that had never made it to GitHub) up to **`main`**. So just
`git pull` and run `npm install` (there's a new library — see below) and you'll
have everything. Here's the plain-English rundown of what changed and why:

**Explore — the customer "Find a vehicle" screen**
- It no longer forces you through the "Where are you?" and "Where are you moving
  to?" screens first. It opens **straight to the list of vehicles**. Your area
  just defaults to Durban CBD, and you can still change it from the pill up top.
- All the filter chips (vehicle type, features, load, distance) now live behind
  one **Filters** button, so the vehicle list is the first thing you see. A small
  number badge shows how many filters are switched on.

**The in-chat fare estimator**
- Fixed the bug where the **"Ask <driver> about this trip"** button did nothing
  when "Need it now" was selected. It now works. (The estimate used to wait on an
  online route lookup that could hang; it now uses our built-in suburb list, so
  it's instant and the button always fires.)
- When someone ticks **"I'll need a lift back,"** it now tells them the driver may
  charge extra for the return trip.

**"Prices are estimates" — stated everywhere**
- Explore, the driver's detail page, and the fare estimate all now say clearly
  that prices are **estimates** and the driver's real price may be higher or
  lower. (Not shown on a confirmed booking — that price is the real agreed one.)

**Drivers must have a profile photo**
- A driver **can't publish a listing until they add a photo of themselves**. It's
  a required step in the listing form (red "required" marker), and it shows on
  their detail page so customers know who's turning up.

**NEW — live coverage-radius map for drivers**
- In the listing form, the "how far will you travel" slider now has a real
  **map**. The driver sees a **circle around their spot**; dragging the slider
  grows/shrinks it live, and they can **drag the pin** or tap **"Use my location"**
  to set exactly where they are.
- Wording explains it simply: *people inside the circle can see your listing,
  people outside can't — but you can still deliver anywhere; the circle only
  controls who sees you.* (That's the agreed rule — the radius is only about the
  unpaid drive to reach a customer, not about where jobs can go.)
- Under the hood: added the **`leaflet`** map library (that's why you need
  `npm install` after pulling) and a new file **`src/components/RadiusMap.jsx`**.
  Explore now measures distance from the driver's exact map pin when they've set
  one (falls back to the suburb centre otherwise).
- It uses **OpenStreetMap** — free and legal, with the "© OpenStreetMap
  contributors" credit shown on the map. It needs internet to show the streets,
  but only on that one setup screen, and if there's no signal the slider + circle
  still work. **Note for when we go live to real users:** we should swap the
  map-tile source off OSM's free/donated servers (their policy asks you not to
  lean on them for production traffic) — it's a one-line change, just flagging it
  so we don't forget.

**Still to do — designed with the AI but NOT built yet:**
- The **drop-off search** on Explore ("add your drop-off to find drivers willing
  to take you there"). We worked out exactly how it should behave, and there's
  one important rule to remember when we build it: **the drop-off is never limited
  by the driver's radius.** The radius only caps the unpaid drive *to* the
  customer (the pickup). The drop-off leg is the paid job, so a driver is happy to
  do a long one — the drop-off should only *price* the trip, never hide a driver.
  This is the next thing to build.

---

## 2026-09-03 — Megan (branch `my-changes`, not on GitHub yet)
Working through the new product spec. `SPEC.md` has the whole thing, with five
items cut because they need the platform to handle money, which contradicts what
the app promises drivers — the reasons are at the bottom of that file.

- **Real road distances.** Quotes used a straight line padded by 35%, wrong in
  both directions: Durban CBD to Richards Bay was priced at 209km against a real
  177km, and Hillcrest to Amanzimtoti at 43km when it is really 49km, so drivers
  were being underpaid on that route. All 676 suburb pairs are measured once from
  OpenStreetMap. No maps API, no key, no cost, works offline. After adding a
  suburb to `places.js`, run `npm run build:distances`.
- **Photos no longer destroy listings.** They were kept at full camera size,
  which overflowed the phone's storage limit — and the failure was silent, so a
  listing looked saved and was gone on next open. Now shrunk to 1280px (about
  87% smaller), and a refused save says so instead of losing the work quietly.
- **Star ratings are real.** The browse cards showed the frozen seed number, so
  a driver rated 2 stars still advertised 4.9. A listing shows its real average
  once it has one; until then it keeps its starting score, greyed and labelled
  "No ratings yet".
- **The customer says what they're moving**, when, and whether they're travelling
  with it — and can't send until they confirm it's accurate.
- **Customers choose how far to look** (any / 5 / 10 / 25 / 50 km). The spec
  wanted 10km as the default, but that shows 2 of our 12 listings, so it opens
  unrestricted.
- **Drivers say when they work** — an "available now" switch, plus the ordinary
  week, Mon-Sat 7 to 5 unless changed.

Still open: push notifications to available drivers, per-minute rates, and
driver document upload. Until that last one exists, the "ID & licence checked"
badge on every listing is claiming something nothing actually checks.

## 2026-09-03 — Megan
Deleted the `friend-feature` branch. **From now on we only use the `main` branch — please put all your work on `main`.**
- Don't create or push other branches. Just `main`, so we both stay on the same page.
- The deleted branch had nothing unique on it (it was just an older copy of `main`), so nothing was lost.
- **If your side still shows `friend-feature`, run `git fetch --prune` (or `git pull`) to clear it.**
- Heads up: the backend that was built locally hasn't landed on GitHub yet — GitHub still only has the app with no backend. When you push the backend, put it on `main` and tell Megan so it can be pulled and turned into a test APK.

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

**Live push is not working yet — read this before debugging it.** Supabase's
realtime WebSocket refuses the connection with the new-style `sb_publishable_`
key (browser console: "WebSocket is closed before the connection is
established"). Realtime wants a JWT, and the publishable keys are not JWTs. The
fix is to use the project's **legacy anon key** instead, but that key was
unavailable while writing this — the dashboard says "JWT secret is being
updated" on this new project. Once it appears under Settings → API Keys →
"Legacy anon, service_role", put it in `VITE_SUPABASE_ANON_KEY` and live push
should start working.

Until then the app falls back to re-reading every 2.5 seconds, so the other
phone updates within a few seconds rather than instantly. Note that phones and
browsers slow those timers down when the app is in the background, so keep the
app open on both phones while testing.

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
