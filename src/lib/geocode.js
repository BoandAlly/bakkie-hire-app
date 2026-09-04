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

// TomTom Search — OPTIONAL, and the reason real street addresses work.
//
// OpenStreetMap (Photon, below) has no South African house numbers, so it can
// only ever offer the road. TomTom's own map data does have them, down to the
// exact house, so with a key here "90 Round the Green" finds the actual address
// and pins the door. Its free tier needs no card (~2,500 searches/day), so
// there is no bill to run up.
//
// With NO key every search falls straight back to Photon and the app runs
// exactly as before — same optional-by-design idea as the Supabase backend, so
// a checkout with no `.env` still works.
const TOMTOM_KEY = import.meta.env.VITE_TOMTOM_API_KEY
const TOMTOM = 'https://api.tomtom.com/search/2/search'

/** Which address search is live — 'tomtom' when a key is set, else 'osm'. */
export const addressProvider = TOMTOM_KEY ? 'tomtom' : 'osm'

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
 * One TomTom result in our place shape. A "Point Address" already carries the
 * house number in its freeform address, so nothing needs prepending — the label
 * reads "90 Round The Green Street, ..." and the coordinates are the house
 * itself. A "Geography" is a suburb/area, so it gets the suburb tag and icon.
 */
function tomtomPlace(r) {
  const kind = r.type === 'Geography' ? 'suburb' : 'address'
  const label = r.address?.freeformAddress || r.poi?.name || ''
  return place(label, r.position.lat, r.position.lon, kind)
}

/** Real addresses from TomTom, biased toward Durban, limited to South Africa. */
async function tomtomSearch(query, { signal } = {}) {
  const url =
    `${TOMTOM}/${encodeURIComponent(query)}.json?key=${TOMTOM_KEY}` +
    `&typeahead=true&limit=8&countrySet=ZA&language=en-GB` +
    `&lat=${BIAS.lat}&lon=${BIAS.lon}`
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`TomTom ${res.status}`)
  const body = await res.json()
  return (body.results ?? [])
    .filter((r) => r.position)
    .map(tomtomPlace)
    .filter((p) => p.label)
}

/**
 * The free OpenStreetMap fallback (Photon). Streets, malls and landmarks, but
 * no South African house numbers — see the note at the top of the file. Used
 * when there is no TomTom key, or if a TomTom request fails.
 */
async function photonSearch(query, { signal } = {}) {
  const url =
    `${PHOTON}?q=${encodeURIComponent(query)}&limit=8&lang=en` +
    `&lat=${BIAS.lat}&lon=${BIAS.lon}&bbox=${SA_BBOX}`
  const res = await fetch(url, { signal })
  if (!res.ok) return []
  const body = await res.json()
  return (body.features ?? [])
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

/**
 * Places matching `query`, suburbs first. Never rejects: if the geocoder is
 * unreachable the suburb matches still come back, so the address box degrades
 * to the old picker rather than breaking.
 *
 * TomTom when a key is set (real house numbers), OpenStreetMap otherwise — and
 * OpenStreetMap again if TomTom errors, so search always answers with something.
 */
export async function searchPlaces(query, { signal } = {}) {
  const suburbs = suburbMatches(query)
  if (query.trim().length < 3) return suburbs

  let found = []
  try {
    found = TOMTOM_KEY
      ? await tomtomSearch(query, { signal })
      : await photonSearch(query, { signal })
  } catch {
    // A TomTom hiccup must not kill search: fall to the free map, then to the
    // suburb list alone. An aborted request (the next keystroke) just returns
    // nothing, and the caller ignores it.
    if (TOMTOM_KEY) {
      try {
        found = await photonSearch(query, { signal })
      } catch {
        /* suburbs alone are still a usable answer */
      }
    }
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

/**
 * Where the phone says it is, named. Pick-up only: a person knows where they
 * are standing, and typing their own address is the most tedious part of
 * asking for a bakkie.
 *
 * Rejects with a plain reason rather than a code, because every one of these
 * gets shown to someone.
 */
export function currentLocation() {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('This phone cannot share its location.'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        let label = 'My current location'
        try {
          const res = await fetch(`${PHOTON.replace('/api/', '/reverse')}?lat=${lat}&lon=${lng}&limit=1`)
          if (res.ok) {
            const body = await res.json()
            const p = body?.features?.[0]?.properties
            if (p) label = labelFor(p) || label
          }
        } catch {
          // Named or not, the coordinates are the part that matters.
        }
        resolve(place(label, lat, lng, 'current'))
      },
      (err) => {
        reject(
          new Error(
            err.code === 1
              ? 'Location is blocked for this app. Turn it on in your phone settings, or type the address instead.'
              : 'Could not get your location just now. Type the address instead.',
          ),
        )
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
    )
  })
}

/**
 * An address the map could not find, kept as the person typed it.
 *
 * It has no coordinates, so it cannot be routed or priced - but refusing to
 * accept it would strand anyone whose street simply is not in OpenStreetMap,
 * which in South Africa is a lot of people. The trip goes through without an
 * estimate and the driver sorts the price out in the chat.
 */
export const typedAddress = (text) => ({
  label: text.trim(),
  lat: null,
  lng: null,
  kind: 'typed',
})

/** Can this leg be routed and priced? */
export const isLocatable = (leg) =>
  Boolean(leg && Number.isFinite(leg.lat) && Number.isFinite(leg.lng))

// ---------------------------------------------------------------------------
// Distance
// ---------------------------------------------------------------------------

// Coordinates rarely change their answer, so a route is worth remembering for
// the session — the same trip gets re-quoted constantly while someone compares
// drivers, and that should cost nothing.
const routeCache = new Map()
const cacheKey = (a, b) =>
  `${a.lat.toFixed(4)},${a.lng.toFixed(4)}>${b.lat.toFixed(4)},${b.lng.toFixed(4)}`

// The drawn route is asked for separately from the distance. Distance is needed
// for every quote and must be quick, so that call skips the geometry; the shape
// is only needed when a map is actually on screen.
const shapeCache = new Map()

/**
 * The route between two places as GeoJSON coordinates, for drawing.
 * Null when routing is unavailable — the map then just shows the two pins.
 */
export async function routeShape(a, b, { signal } = {}) {
  if (!a || !b) return null

  const key = cacheKey(a, b)
  if (shapeCache.has(key)) return shapeCache.get(key)

  try {
    const url = `${OSRM}/${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson`
    const res = await fetch(url, { signal })
    if (!res.ok) return null
    const body = await res.json()
    const coords = body?.routes?.[0]?.geometry?.coordinates
    if (!Array.isArray(coords) || coords.length < 2) return null
    shapeCache.set(key, coords)
    return coords
  } catch {
    return null
  }
}

/**
 * Road distance in km between two places.
 *
 * Live routing first, because with free-text addresses there is nothing to
 * precompute. Falls back to the baked-in suburb table when both ends are
 * suburbs, and to a padded straight line otherwise — so a quote always has a
 * number, even with no network.
 */
export async function roadDistanceBetween(a, b, { signal } = {}) {
  // An address we could not find has no point on the map, so there is nothing
  // to measure. Callers treat null as "no estimate" and say so.
  if (!isLocatable(a) || !isLocatable(b)) return null

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
