# Bakkie Hire — Session Handoff (2026-08-31)

"Uber for bakkies" marketplace (Airbnb-style vehicle-hire listings for SA). Money never
touches the app; revenue = driver subscription. Vite + React 19, plain CSS.

- **Path:** `C:\Users\Windows 10 Pro\Desktop\bakkie-app`
- **Run:** `npm run dev` → http://localhost:5199
- **Roles:** app opens on a role chooser. Customers browse without signing in; drivers sign
  in with email + password. All state is in `localStorage` (no backend yet).

---

## What we built this session — 4 features, all DONE & verified in-browser

### 1. Round-trip service badge
Driver toggle "Willing to take the client back home?" → `roundTrip` bool on a listing.
- Checkbox: `src/pages/CreateListing.jsx` (section 3) + in `BLANK`.
- Shows as: blue "Round trip" pill on `src/pages/Nearby.jsx` cards, a filter chip there, and
  a Feature line on `src/pages/TruckDetail.jsx`.
- Seeded on 7 of 12 listings in `src/data/listings.js`.

### 2. In-chat fare calculator (customer-only)
`FareCalculator` inside `src/pages/Chat.jsx`, gated by `isCustomer` (driver chat uses
`viewAs="owner"` so never sees it). Pick-up/drop-off selects → `routeDistanceKm()` →
`quote(listing, {distanceKm})`. Prices off **that driver's own rate** (per-km or per-hour),
respects call-out fee + minimum. "Ask <driver> about this trip" drops a prefilled message
into the chat. No maps API — distance is the local suburb table in `src/data/places.js`.

### 3. Driver "Book a pickup" card (driver-only)
`BookingForm` in `src/pages/Chat.jsx` (date / time / pickup / dropoff) → posts a structured
booking message into the thread, rendered by `BookingCard` as a ticket (Date/Time/From/To +
driver name & tap-to-call number). Same card both sides.
- Message model extended: `newMessage(from, text, extra)` spreads an optional payload; App's
  `sendMessage` gained a 4th arg. Booking payload:
  `{id, status, date, time, pickup, dropoff, driverName, driverPhone, customerName}`.
- Helpers `bookingDateLabel` / `bookingSummary` in `src/lib/threads.js`. Inbox previews use
  the summary text, so they still read fine.

### 4. Two-way star ratings (post-trip)
Trigger = driver's **"Job done"** button on the booking card (single manual completion step).
- `status` goes `booked → done`; header flips green "Trip complete".
- Driver rates the customer (`custRating`); customer's chat unlocks a picker to rate the
  driver (`driverRating`). Half-star `StarPicker` (hover preview, 0.5 steps) → "Submit".
- Driver card also shows "<customer> rated you ★" once the customer submits.
- Ratings stored ON the booking; `patchBooking(id, patch)` in `App.jsx` mutates the booking
  message in place (passed to both Chats as `onPatchBooking`).
- **Customer "notification"** = in-app only (real phone push needs a backend): green
  "✓ Trip done — rate your driver" flag + unread dot on the customer's `Messages` row
  (`bookingsAwaitingCustomerRating`).
- **Driver dashboard** = the **Account** tab → new "Your ratings" panel: average + stars,
  count, per-customer list (name + their stars + score, newest tagged "Most recent"). Fed by
  `driverRatingsReceived(threads, myListingIds)` + `averageRating` in `src/lib/threads.js`.
- Shared fractional `Stars` component added to `src/components/Icon.jsx`.

---

## THE ONE PENDING TASK — wire real ratings into the PUBLIC listing score

**Problem:** the star on the browse cards / TruckDetail is still the frozen seed value
(`listing.rating`, e.g. 4.8). The real ratings customers give only show on the driver's own
dashboard — they do NOT change the public number. So a driver rated 2★ still shows 4.8 to
shoppers.

**Why it updates instantly once wired:** everything is React state. A rating submit calls
`patchBooking` → `setThreads` → re-render. Any component reading that state updates the same
tick. The card just needs to read the *live* average instead of the frozen field.

**Two ways (both immediate):**
- **A (recommended) — derive:** compute the card's score from the driver's real ratings at
  render time (`averageRating(driverRatingsReceived(threads, {listing.id}))`); drop reliance
  on the frozen `listing.rating`. Single source of truth, can't drift.
- **B — write-back:** on each rating submit, recompute the driver's average and overwrite
  `listing.rating` via `setListings`. Keeps the existing field working everywhere.

**OPEN DECISION (Daniel to answer):** for a driver with **zero** real ratings yet, show
"New — no ratings yet", OR keep their seeded star until real ratings arrive? (The 12 seed
listings will look unrated if we go real-only.)

**Caveat:** "immediate" = same browser. True cross-device real-time (customer's phone →
driver's phone) needs the backend the app doesn't have yet.

---

## Test data note
The rating flow was verified by seeding a fake driver into `bakkie.drivers.v1` with Sipho's
phone (`082 445 1190`) + a test booking, since the 12 seed operators have no real login.
That test driver + booking live in the preview's localStorage only. **Reset it** anytime via
**Reset demo data** in the driver Account tab (or clear the `bakkie.*` localStorage keys).

## Bigger open items (pre-existing, not this session)
Real auth (passwords are plain-text in localStorage), real routing/maps API, real photos,
deployment (nothing deployed), ToS/POPIA, GIT-insurance handling. See the `bakkie-hire-app`
memory file for the full history.
