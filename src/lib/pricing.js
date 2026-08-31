// Drivers set any amount they like, but the unit is restricted to per-km or
// per-hour. That restriction is the whole point: it means a R100/hour listing
// and a R15/km listing can be quoted against the same job and actually compared.

export const RATE_UNITS = [
  { id: 'km', label: 'per kilometre', short: '/km' },
  { id: 'hour', label: 'per hour', short: '/hr' },
]

export const unitShort = (id) => RATE_UNITS.find((u) => u.id === id)?.short ?? ''

const LOAD_HOURS = 0.5
const OFFLOAD_HOURS = 0.5

const URBAN_SPEED_KMH = 40
const HIGHWAY_SPEED_KMH = 85
const URBAN_UNTIL_KM = 25
const HIGHWAY_FROM_KM = 120

/**
 * Short hops are stop-start city driving; long runs are mostly highway. A flat
 * average badly overstates how long a Durban–Pietermaritzburg leg takes.
 */
function averageSpeedKmh(distanceKm) {
  if (distanceKm <= URBAN_UNTIL_KM) return URBAN_SPEED_KMH
  if (distanceKm >= HIGHWAY_FROM_KM) return HIGHWAY_SPEED_KMH
  const t = (distanceKm - URBAN_UNTIL_KM) / (HIGHWAY_FROM_KM - URBAN_UNTIL_KM)
  return URBAN_SPEED_KMH + t * (HIGHWAY_SPEED_KMH - URBAN_SPEED_KMH)
}

/**
 * How long the job actually ties the operator up: load it, drive it, offload it,
 * and drive home again.
 *
 * That last leg matters. Per-km operators cover the empty return inside their
 * rate, but a per-hour operator quoted only on the loaded leg is working half a
 * day for a third of it — which on a long haul is the difference between a fair
 * price and a loss.
 */
export function estimateHours(distanceKm) {
  const legHours = distanceKm / averageSpeedKmh(distanceKm)
  const raw = LOAD_HOURS + legHours + OFFLOAD_HOURS + legHours
  return Math.max(1, Math.round(raw * 2) / 2)
}

/**
 * Quote one listing against one job.
 *
 * The driver's own minimum charge is respected — that is theirs to set and is a
 * different thing from a platform-imposed floor, which we deliberately don't have.
 */
export function quote(listing, job) {
  if (!job?.distanceKm) return null

  const { distanceKm } = job
  const helpers = Math.min(job.helpers ?? 0, listing.helpersAvailable ?? 0)
  const hours = estimateHours(distanceKm)

  const base =
    listing.rateUnit === 'km'
      ? listing.rateAmount * distanceKm
      : listing.rateAmount * hours

  const callout = listing.calloutFee ?? 0
  const helperCost = helpers * (listing.helperRate ?? 0)

  // Minimum applies to the driving work, not to the extras bolted on top.
  const chargeable = Math.max(base + callout, listing.minCharge ?? 0)
  const total = chargeable + helperCost

  return {
    total: Math.round(total),
    base: Math.round(base),
    callout,
    helperCost,
    helpers,
    hours,
    distanceKm,
    minApplied: base + callout < (listing.minCharge ?? 0),
  }
}

export const rand = (n) =>
  'R' + Math.round(n).toLocaleString('en-ZA', { maximumFractionDigits: 0 })

/** "R15/km" / "R320/hr" — how the rate reads on a card. */
export function rateLabel(listing) {
  return `${rand(listing.rateAmount)}${unitShort(listing.rateUnit)}`
}
