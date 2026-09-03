// Fetch real road distances between every pair of suburbs, once, and write
// them into src/data/distances.js.
//
// WHY THIS IS A SCRIPT AND NOT A LIVE API CALL. The distance between two
// suburbs does not change, so paying to look it up on every quote is waste.
// Running this occasionally — when suburbs are added — costs one request and
// leaves the app with no map provider, no API key, and no per-quote cost. The
// app works offline and answers instantly.
//
// Uses the public OSRM demo server (OpenStreetMap data, no key). One request
// returns the whole matrix, so this is a single hit, not one per pair.
//
//   npm run build:distances
//
// If OSRM is unreachable the script exits without touching anything, so a
// failed run can never leave the app with half a distance table.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const PLACES_FILE = join(root, 'src/data/places.js')
const OUT_FILE = join(root, 'src/data/distances.js')

const OSRM = 'https://router.project-osrm.org/table/v1/driving'

// Read the suburb list straight out of places.js so there is one list, not two.
const { PLACES } = await import(`file://${PLACES_FILE.replace(/\\/g, '/')}`)

if (!Array.isArray(PLACES) || PLACES.length < 2) {
  console.error('Could not read PLACES from src/data/places.js')
  process.exit(1)
}

console.log(`Asking OSRM for road distances between ${PLACES.length} suburbs…`)

// OSRM wants lng,lat — the opposite order to how the app stores them.
const coords = PLACES.map((p) => `${p.lng},${p.lat}`).join(';')
const url = `${OSRM}/${coords}?annotations=distance`

let body
try {
  const res = await fetch(url, { signal: AbortSignal.timeout(60000) })
  if (!res.ok) throw new Error(`OSRM returned HTTP ${res.status}`)
  body = await res.json()
} catch (err) {
  console.error('\nCould not reach OSRM:', err.message)
  console.error('Nothing was written. Try again later, or check your connection.')
  process.exit(1)
}

if (body.code !== 'Ok' || !Array.isArray(body.distances)) {
  console.error('\nOSRM could not build the matrix:', body.code, body.message ?? '')
  process.exit(1)
}

// Metres to kilometres, one decimal. A null means OSRM found no road route
// between the pair; the app falls back to its own estimate for those.
const matrix = body.distances.map((row) =>
  row.map((m) => (typeof m === 'number' ? Math.round(m / 100) / 10 : null)),
)

const missing = matrix.flat().filter((v) => v === null).length
const names = PLACES.map((p) => p.name)

const out = `// GENERATED FILE — do not edit by hand.
// Rebuild with:  npm run build:distances
//
// Real road distances in kilometres between the suburbs in places.js, from
// OpenStreetMap via OSRM. The matrix is directional: [from][to], because a
// one-way system means the trip back is not always the same length.
//
// Generated ${new Date().toISOString().slice(0, 10)} for ${names.length} suburbs.

export const DISTANCE_PLACES = ${JSON.stringify(names, null, 2)}

const INDEX = new Map(DISTANCE_PLACES.map((n, i) => [n, i]))

// [from][to] in km, or null where OSRM found no road route.
export const DISTANCE_KM = [
${matrix.map((row) => '  [' + row.map((v) => (v === null ? 'null' : v)).join(', ') + '],').join('\n')}
]

/** Road distance in km between two suburb names, or null if we don't have it. */
export function roadDistanceKm(fromName, toName) {
  const i = INDEX.get(fromName)
  const j = INDEX.get(toName)
  if (i === undefined || j === undefined) return null
  return DISTANCE_KM[i][j]
}
`

mkdirSync(dirname(OUT_FILE), { recursive: true })
writeFileSync(OUT_FILE, out)

// A quick sanity read-out, so a bad run is obvious rather than silent.
const sample = (a, b) => {
  const i = names.indexOf(a)
  const j = names.indexOf(b)
  return i < 0 || j < 0 ? '?' : `${matrix[i][j]} km`
}

console.log(`\nWrote ${OUT_FILE.replace(root, '.')}`)
console.log(`  ${names.length} suburbs, ${names.length ** 2} pairs`)
if (missing) console.log(`  ${missing} pairs had no road route — the app estimates those`)
console.log('\nSpot checks:')
console.log(`  Durban CBD -> Umhlanga     ${sample('Durban CBD', 'Umhlanga')}`)
console.log(`  Umhlanga -> Ballito        ${sample('Umhlanga', 'Ballito')}`)
console.log(`  Durban CBD -> Richards Bay ${sample('Durban CBD', 'Richards Bay')}`)
