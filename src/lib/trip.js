// The job the customer is trying to price: where from, where to.
//
// It lives here rather than inside a screen because two screens need the same
// answer — the browse list prices every driver against it, and the chat quotes
// one driver against it. Asking twice would be the app forgetting something the
// person had already told it.

export const TRIP_KEY = 'bakkie.trip.v1'

const BLANK = { pickup: null, dropoff: null }

// A leg is {label, lat, lng, kind, detail}. Anything else — including trips
// saved before addresses existed, when these were plain suburb names — is
// dropped rather than half-read, so an old value can't produce a bad quote.
const validLeg = (v) =>
  v &&
  typeof v === 'object' &&
  typeof v.label === 'string' &&
  Number.isFinite(v.lat) &&
  Number.isFinite(v.lng)
    ? v
    : null

export function loadTrip() {
  try {
    const saved = JSON.parse(localStorage.getItem(TRIP_KEY)) ?? {}
    return { pickup: validLeg(saved.pickup), dropoff: validLeg(saved.dropoff) }
  } catch {
    return { ...BLANK }
  }
}

export function saveTrip(trip) {
  try {
    localStorage.setItem(TRIP_KEY, JSON.stringify(trip))
  } catch {
    /* private window — they'll just be asked again next time */
  }
}

/** Both ends chosen, and not the same place. */
export const isTripSet = (trip) =>
  Boolean(trip?.pickup && trip?.dropoff && trip.pickup.label !== trip.dropoff.label)
