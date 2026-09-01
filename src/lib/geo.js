import { useCallback, useState } from 'react'
import { PLACES } from '../data/places.js'

const R = 6371 // km

// Where the customer last told us they are. Persisted so the location gate only
// shows the first time — every reload after that reuses it until they change area.
const LOCATION_KEY = 'bakkie.location.v1'

function loadSavedLocation() {
  try {
    const raw = localStorage.getItem(LOCATION_KEY)
    const saved = raw ? JSON.parse(raw) : null
    return saved?.coords ? saved : null
  } catch {
    return null
  }
}

function saveLocation(coords, areaName) {
  try {
    localStorage.setItem(LOCATION_KEY, JSON.stringify({ coords, areaName }))
  } catch {
    // Private window or quota — it just won't be remembered next launch.
  }
}

function clearSavedLocation() {
  try {
    localStorage.removeItem(LOCATION_KEY)
  } catch {
    /* nothing to do */
  }
}

export function haversineKm(a, b) {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const la1 = (a.lat * Math.PI) / 180
  const la2 = (b.lat * Math.PI) / 180
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

/** Straight-line padded out to something road-like. */
export const roadKm = (a, b) => Math.max(1, Math.round(haversineKm(a, b) * 1.35))

/** Closest known suburb to a set of coordinates — used to name where someone is. */
export function nearestPlace(coords) {
  let best = null
  let bestKm = Infinity
  for (const p of PLACES) {
    const km = haversineKm(coords, p)
    if (km < bestKm) {
      bestKm = km
      best = p
    }
  }
  return best
}

/**
 * Location gate for the customer flow.
 *
 * Geolocation can fail in ways that aren't errors — the browser blocks it on
 * insecure origins, the user declines, or the device just never answers. Every
 * one of those has to land somewhere the customer can still use the app, so a
 * manual area picker always stays available.
 */
export function useLocation() {
  // A remembered location loads straight to 'ready', so the gate is skipped.
  const saved = loadSavedLocation()
  const [status, setStatus] = useState(saved ? 'ready' : 'idle') // idle | asking | ready | denied | unsupported
  const [coords, setCoords] = useState(saved?.coords ?? null)
  const [areaName, setAreaName] = useState(saved?.areaName ?? '')

  const request = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setStatus('unsupported')
      return
    }
    setStatus('asking')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const c = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        const name = nearestPlace(c)?.name ?? 'your area'
        setCoords(c)
        setAreaName(name)
        setStatus('ready')
        saveLocation(c, name)
      },
      () => setStatus('denied'),
      { timeout: 8000, maximumAge: 300000 },
    )
  }, [])

  const setManual = useCallback((placeName) => {
    const p = PLACES.find((x) => x.name === placeName)
    if (!p) return
    const c = { lat: p.lat, lng: p.lng }
    setCoords(c)
    setAreaName(p.name)
    setStatus('ready')
    saveLocation(c, p.name)
  }, [])

  const reset = useCallback(() => {
    setStatus('idle')
    setCoords(null)
    setAreaName('')
    clearSavedLocation()
  }, [])

  return { status, coords, areaName, request, setManual, reset }
}
