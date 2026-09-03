# Bakkie Hire — Product & Build Spec

**Stack:** React 19 + Vite + plain CSS, wrapped with Capacitor for Android.
(An earlier draft assumed React Native / Expo. It isn't — and switching would
mean rewriting the app. Everything below works on what already exists.)

**Business model:** the app matches customers with drivers. **Money never
touches the app.** Price is agreed directly between the two of them and paid
directly to the driver. Revenue comes from a flat driver subscription — no
commission, no cut of any job.

That model is stated to users in three places in the app (driver Account tab,
vehicle detail page, listing form), so it is a promise, not just an internal
preference. Anything that contradicts it has been cut — see the end of this
document for what was removed and why.

Status tags: **[BUILT]** already works · **[PART]** partly there · untagged = new.
The tags below describe the state when this document was written.

## Built since, on the `my-changes` branch

- Real road distances for every quote (1.3a) — measured once, no maps API.
- The customer now says what they're moving, when, and whether they're
  travelling with it (1.2), and can't send until they've confirmed it.
- Customer-adjustable search radius (1.3).
- Star ratings are real, and honest when a driver has none (1.3).
- Driver "Available now" switch and working hours (2.1, 2.2).
- Photos no longer destroy listings, so delivery photos are safe to use (2.5).

Still open, in rough order of what it costs:

- Push notification to available drivers on a matching immediate request (2.1).
- Per-minute rates and platform min/max bounds on driver pricing (1.3a).
- Driver document upload and verification (§4) — and until that exists, the
  "ID & licence checked" badge on listings is claiming something nothing
  checks (§3).
- Everything in §4 beyond that: privacy policy, permission prompts, account
  deletion, data-safety declarations.

---

## 1. Customer Flow

### 1.1 Account & location
- Account creation (email/phone + auth).
- On booking, the customer sets pickup and drop-off.
- **[BUILT]** Remember the last-used location and reuse it on every open. Only
  ask again when the customer taps "change location" — never on launch.

### 1.2 Booking details
- Customer picks up to 3 vehicle types to match against.
- Goods description: preset options (furniture, appliances, building material,
  boxes/household, other) plus a free-text field.
- Timing: "Need it now", or schedule a pickup date and time.
- Toggle: "I want to travel with the goods".
- **[BUILT]** Toggle: "I'll need a lift back" — this is the existing round-trip
  feature; only relevant when the customer is travelling with the goods.
- The customer must confirm the goods description is accurate: "The driver has
  the right to know what they're transporting before accepting."

### 1.3 Matching & results
- On submit, search nearby drivers by vehicle type, availability and radius.
- Search radius is adjustable by the customer (e.g. 5/10/20/50 km), default
  10 km, with platform min/max caps.
- **[PART]** Default sort by price, low to high. Sort toggle for Top Rated and
  Available Now. (Sorting exists — "Available Now" is new, and "Top Rated" must
  be fixed to use real ratings rather than the frozen seed numbers.)
- Every result shows an **estimated total for the whole trip**, not just a rate
  per km.

### 1.3a Pricing (maps-based estimate)
- Use a routing API (Google Directions / Distance Matrix, or Mapbox) for real
  road distance and duration — not straight-line. This replaces the current
  hardcoded 26-suburb distance table, which only covers the Durban area.
  Note this bills per request; budget for it before switching on.
- Estimate per vehicle type, built around the driver's real costs:
  - Base fare — the driver's time and availability
  - plus per-km rate — fuel and vehicle wear, higher for bigger vehicles
  - plus per-minute rate — traffic and waiting time
- **[PART]** Drivers set their own base / per-km / per-minute rates, within
  platform min/max bounds so results stay comparable. (Drivers already set
  rates; the bounds and per-minute component are new.)
- The number shown is an **estimate**, and must be labelled as one. The final
  price is whatever the customer and driver agree in chat.

### 1.4 Chat & confirmation
- **[BUILT]** Customer messages a driver; the driver sees full trip details in
  chat with Accept / Decline.
- **[BUILT]** Confirm Pickup, available to both sides, locks in a date and time.
- **[BUILT]** Either party can cancel any time before the confirmed time.
- **[PART]** Before/after job photos land in the chat thread as delivery
  confirmation (see 2.5).

---

## 2. Driver Flow

### 2.1 Availability
- "Available Now" toggle for drivers waiting on on-demand work.
- While on, push a notification for each matching immediate request nearby.
- **[BUILT]** Notifications for new chat messages.

### 2.2 Editable settings
- Drivers set recurring working hours and days.
- **[PART]** Drivers edit their own rates at any time (exists; needs the new
  per-minute field and the platform bounds).
- Drivers edit their availability at any time.

### 2.3 Trip lifecycle
- **[BUILT]** Incoming request → chat with trip details → Accept / Decline.
- **[BUILT]** Confirm Pickup locks the date and time.
- **[BUILT]** Driver can cancel before the confirmed pickup time.

### 2.4 Pre-departure reminders
**[BUILT]** — already works exactly as specified. Leave-time is the confirmed
pickup time minus estimated travel time from the driver's location, and three
reminders fire at 30 minutes before, 5 minutes before, and at leave-time. All
three are relative to when the driver must *depart*, not the pickup time.

Improvement worth making: feed live traffic ETA into the calculation instead of
the current flat 35 km/h assumption.

### 2.5 Proof of goods
- **[PART]** Photo before loading and after delivery, each tagged with GPS
  position and time of capture. Both post automatically into the customer's
  chat thread.
- **Blocked until the photo bug is fixed.** Photos are currently stored at full
  camera resolution, which overflows the storage limit — the save fails silently
  and the listing is lost. Images must be shrunk before this feature is usable.

---

## 3. Positioning: a matching platform, not a carrier

The app introduces customers to drivers. It does not take custody of goods,
carry them, or handle payment.

- Terms must state the platform is not a common carrier, takes no custody of
  goods, and is not liable for damage, loss or delay in transit. That risk sits
  between customer and driver.
- Require drivers to hold their own goods-in-transit or vehicle insurance as an
  onboarding condition. The platform does not provide cover.
- Drivers are independent contractors, not employees.
- **The app currently displays "ID & licence checked" and an insured-to amount
  on listings, and verifies neither.** Claiming a check you don't perform is a
  real liability. Either verify it (see driver vetting in §4) or remove the
  claim.
- Have a lawyer review the wording before launch. Liability and contractor
  classification are jurisdiction-specific.

---

## 4. App store compliance (Apple + Google)

- Privacy policy linked in-app and in both store listings, disclosing exactly
  what is collected: location, photos, contact details.
- **Location:** request "when in use" by default. Only request background
  location if it is core to a feature (live ETA during an active trip), and
  justify it in the prompt and in Play Console's background-location form.
  Google Play requires a prominent in-app disclosure here — this is a common
  rejection reason, so decide early whether live tracking is worth it.
- **Camera:** request when the driver is about to take a photo, not on launch.
- **Push:** request when first relevant, not on first open.
- **Account deletion:** both stores require an in-app way for customers and
  drivers to delete their account and data.
- **Driver vetting:** ID verification and vehicle document upload at onboarding.
  Needed anyway to back the claims in §3.
- **Data safety forms:** Play Console "Data safety" and Apple "App Privacy" must
  match what is actually collected, and stay in sync as that changes.

---

## 5. Data model additions (Supabase)

- `trips` — customer_id, driver_id, pickup_location, dropoff_location,
  route_distance_km, route_duration_min, vehicle_type, goods_description,
  accompany_bool, needs_return_bool, requested_time, status
  (requested / accepted / confirmed / en_route / completed / cancelled),
  confirmed_pickup_at, estimated_price.
- `driver_availability` — driver_id, is_available_now, working_hours (recurring
  schedule JSON), search_radius_km.
- `driver_vehicles` — driver_id, vehicle_type, base_fare, price_per_km,
  price_per_min, within platform min/max bounds.
- `trip_photos` — trip_id, type (before/after), photo_url, lat, lng, captured_at.
- `notifications_log` — trip_id, driver_id, type
  (30min / 5min / leave_now / new_request), sent_at.
- `driver_documents` — driver_id, doc_type (ID / licence / vehicle registration
  / insurance), file_url, verified_bool.

Note: photos belong in file storage with the URL kept here — never as image data
inside a row.

---

## Removed from the original draft, and why

Five items were cut because they require the platform to handle money, which
contradicts the model the app already promises its users.

1. **Platform commission** (added on top, or deducted from driver payout).
   The app tells drivers "no commission, no cut of your jobs". Revenue is the
   subscription.

2. **Guaranteed fixed quote** — "the price shown at booking is the price
   charged". The platform never holds the money, so nothing stops a driver
   asking more on the day. That would be advertising a promise with no
   mechanism behind it, and customers would blame the app. Shown as an
   *estimate* instead.

3. **"Payment facilitator" positioning.** The app facilitates matching and
   chat. It does not process payments.

4. **Cancellation / no-show fees.** Charging a fee means holding card details:
   a payment processor, PCI scope, refunds, chargebacks, and disputes where
   customers blame the platform for a driver's behaviour — the whole
   operational burden the subscription model exists to avoid, to recover a
   small amount per incident.
   *Cheaper alternative:* record no-shows and let them affect the driver's
   rating and search ranking. Reputation does the enforcing, at no cost.

5. **Payment processing in the store-compliance checklist.** Nothing to
   process.

None of these are bad ideas — a commission marketplace is a sound business.
But adopting any of them means becoming a payments company, which is a founder
decision rather than a feature, and would mean changing what the app currently
promises drivers.
