// Turning what someone types into a place we can route between.
//
// Two sources, deliberately in this order:
//
// 1. The suburb list in places.js. Curated, always available, and the thing
//    people actually type. It has to come first because OpenStreetMap ranks
//    South African suburbs badly — searching "Umhlanga" on Photon returns the
//    uMhlangane *river* five times before it mentions the suburb.
//
// 2. Photon, an OpenStreetMap geocoder built for type-ahead. Free, no key.
//    This is what adds streets, malls and landmarks.
//
// Nominatim, the better-known OSM geocoder, is deliberately NOT used: its usage
// policy lists auto-complete as unacceptable use, and its search does not do
// prefix matching anyway ("New Yor" finds nothing).
//
// Photon's public service asks for roughly one request a second, so callers
// must debounce and we cache every answer. For real traffic both Photon and
// OSRM should be self-hosted; only the two URLs below need to change.

import { PLACES, routeDistanceKm } from '../data/places.js'
import { haversineKm } from './geo.js'

const PHOTON = 'https://photon.komoot.io/api/'
const OSRM = 'https://router.project-osrm.org/route/v1/driving'

// Roughly South Africa, so a search for "Springfield" doesn't offer Missouri.
const SA_BBOX = '16.45,-34.83,32.89,-22.13'
// Bias toward Durban — where the drivers are — so nearby matches rank first.
const BIAS = { lat: -29.85, lon: 31.02 }

// OSM tags that are never somewhere you'd load a bakkie. Rivers in particular
// crowd out real answers for South African place names.
const JUNK = new Set([
  'stream', 'river', 'canal', 'drain', 'ditch', 'water', 'coastline',
  'peak', 'ridge', 'tree', 'bay', 'wetland', 'spring',
])

/** A place, however it was found. Everything downstream uses this shape. */
const place = (label, lat, lng, kind) => ({ label, lat, lng, kind })

/**
 * The house number typed at the front of a search, if any.
 *
 * South African house numbers are largely absent from OpenStreetMap outside
 * Johannesburg and Cape Town — Nominatim returns nothing for "12 Florida Road,
 * Durban" either, so this is missing data rather than a geocoder we could swap.
 * Someone typing the number still means it, so we keep it and carry it to the
 * driver instead of throwing it away.
 */
export function leadingHouseNumber(query) {
  const m = query.trim().match(/^(\d+[a-zA-Z]?)\s+\S/)
  return m ? m[1] : ''
}

/** How a place reads once the customer's own detail is added. */
export const fullAddress = (leg) =>
  leg ? [leg.detail, leg.label].filter(Boolean).join(', ') : ''

/** Turn one Photon feature into a readable one-line address. */
function labelFor(p) {
  const line1 = [p.housenumber, p.street ?? p.name].filter(Boolean).join(' ')
  const area = p.suburb ?? p.district ?? p.city ?? p.county
  return [line1 || p.name, area, p.state].filter(Boolean).join(', ')
}

/** Suburbs from our own list whose name contains what was typed. */
function suburbMatches(query) {
  const q = query.trim().toLowerCase()
  if (!q) return []
  return PLACES.filter((p) => p.name.toLowerCase().includes(q))
    .slice(0, 4)
    .map((p) => place(p.name, p.lat, p.lng, 'suburb'))
}

/**
 * Places matching `query`, suburbs first. Never rejects: if the geocoder is
 * unreachable the suburb matches still come back, so the address box degrades
 * to the old picker rather than breaking.
 */
export async function searchPlaces(query, { signal } = {}) {
  const suburbs = suburbMatches(query)
  if (query.trim().length < 3) return suburbs

  let found = []
  try {
    const url =
      `${PHOTON}?q=${encodeURIComponent(query)}&limit=8&lang=en` +
      `&lat=${BIAS.lat}&lon=${BIAS.lon}&bbox=${SA_BBOX}`
    const res = await fetch(url, { signal })
    if (res.ok) {
      const body = await res.json()
      found = (body.features ?? [])
        .filter((f) => !JUNK.has(f.properties?.osm_value))
        .map((f) =>
          place(
            labelFor(f.properties),
            f.geometry.coordinates[1],
            f.geometry.coordinates[0],
            'address',
          ),
        )
        .filter((p) => p.label)
    }
  } catch {
    // Offline, blocked, or aborted — suburbs alone are still a usable answer.
  }

  // OSM splits a road into many ways, so one street comes back several times
  // under the same name. Keep the first of each label, and never repeat a
  // suburb we already listed above.
  const seen = new Set(suburbs.map((s) => s.label.toLowerCase()))
  const deduped = []
  for (const p of found) {
    const key = p.label.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(p)
  }

  return [...suburbs, ...deduped].slice(0, 8)
}

// ---------------------------------------------------------------------------
// Distance
// ---------------------------------------------------------------------------

// Coordinates rarely change their answer, so a route is worth remembering for
// the session — the same trip gets re-quoted constantly while someone compares
// drivers, and that should cost nothing.
const routeCache = new Map()
const cacheKey = (a, b) =>
  `${a.lat.toFixed(4)},${a.lng.toFixed(4)}>${b.lat.toFixed(4)},${b.lng.toFixed(4)}`

/**
 * Road distance in km between two places.
 *
 * Live routing first, because with free-text addresses there is nothing to
 * precompute. Falls back to the baked-in suburb table when both ends are
 * suburbs, and to a padded straight line otherwise — so a quote always has a
 * number, even with no network.
 */
export async function roadDistanceBetween(a, b, { signal } = {}) {
  if (!a || !b) return null

  const key = cacheKey(a, b)
  if (routeCache.has(key)) return routeCache.get(key)

  try {
    const url = `${OSRM}/${a.lng},${a.lat};${b.lng},${b.lat}?overview=false`
    const res = await fetch(url, { signal })
    if (res.ok) {
      const body = await res.json()
      const metres = body?.routes?.[0]?.distance
      if (typeof metres === 'number') {
        const km = Math.max(1, Math.round(metres / 1000))
        routeCache.set(key, km)
        return km
      }
    }
  } catch {
    // Fall through to the offline estimates below.
  }

  const offline =
    (a.kind === 'suburb' && b.kind === 'suburb' && routeDistanceKm(a.label, b.label)) ||
    Math.max(1, Math.round(haversineKm(a, b) * 1.35))
  routeCache.set(key, offline)
  return offline
}
