import { useCallback, useState } from 'react'
import { PLACES } from '../data/places.js'

const R = 6371 // km

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
  const [status, setStatus] = useState('idle') // idle | asking | ready | denied | unsupported
  const [coords, setCoords] = useState(null)
  const [areaName, setAreaName] = useState('')

  const request = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setStatus('unsupported')
      return
    }
    setStatus('asking')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const c = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setCoords(c)
        setAreaName(nearestPlace(c)?.name ?? 'your area')
        setStatus('ready')
      },
      () => setStatus('denied'),
      { timeout: 8000, maximumAge: 300000 },
    )
  }, [])

  const setManual = useCallback((placeName) => {
    const p = PLACES.find((x) => x.name === placeName)
    if (!p) return
    setCoords({ lat: p.lat, lng: p.lng })
    setAreaName(p.name)
    setStatus('ready')
  }, [])

  const reset = useCallback(() => {
    setStatus('idle')
    setCoords(null)
    setAreaName('')
  }, [])

  return { status, coords, areaName, request, setManual, reset }
}
