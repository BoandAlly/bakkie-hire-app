import { useEffect, useRef, useState } from 'react'
// MapLibre 6 dropped its default export; these are the only three pieces used.
import { Map as MapLibreMap, Marker, LngLatBounds } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { routeShape } from '../lib/geocode.js'

// The trip on a map: where it starts, where it ends, and the road between.
//
// Tiles come from OpenFreeMap - OpenStreetMap data, no API key, no request
// limits, no billing. The style URL is the only thing to change if that ever
// needs to become a self-hosted server.
//
// OpenStreetMap requires attribution wherever its data is shown. MapLibre puts
// it in the corner by default and it must not be removed.
const STYLE = 'https://tiles.openfreemap.org/styles/liberty'

const pin = (color, label) => {
  const el = document.createElement('div')
  el.className = 'mappin'
  el.style.background = color
  el.textContent = label
  return el
}

export default function TripMap({ pickup, dropoff, height = 200, onMove = null }) {
  const holder = useRef(null)
  const map = useRef(null)
  const markers = useRef({ pickup: null, dropoff: null })
  const [failed, setFailed] = useState(false)
  const [ready, setReady] = useState(false)

  // The map is built ONCE. Coordinates are handled by the effect below, moving
  // the markers in place — rebuilding on every change would tear the map down
  // mid-drag, flashing and throwing away whatever the person had panned to.
  useEffect(() => {
    if (!holder.current || !pickup || !dropoff) return

    let cancelled = false
    const m = new MapLibreMap({
      container: holder.current,
      style: STYLE,
      center: [(pickup.lng + dropoff.lng) / 2, (pickup.lat + dropoff.lat) / 2],
      zoom: 10,
      attributionControl: { compact: true },
      // A map inside a scrolling page shouldn't eat the scroll; people can
      // still pinch and drag deliberately.
      scrollZoom: false,
    })
    map.current = m
    if (import.meta.env.DEV) window.__tripmap = m

    // A tile server that's down or blocked must not leave a broken grey box.
    m.on('error', (e) => {
      if (import.meta.env.DEV) console.error('[TripMap]', e?.error?.message ?? e)
      if (!cancelled) setFailed(true)
    })

    m.on('load', () => {
      if (cancelled) return
      const draggable = Boolean(onMove)

      markers.current.pickup = new Marker({ element: pin('#0369a1', 'A'), draggable })
        .setLngLat([pickup.lng, pickup.lat])
        .addTo(m)
      markers.current.dropoff = new Marker({ element: pin('#15803d', 'B'), draggable })
        .setLngLat([dropoff.lng, dropoff.lat])
        .addTo(m)

      // Dragging is how someone corrects a pin that landed on the street
      // instead of at their gate — South African house numbers are largely
      // absent from OpenStreetMap, so that is the normal case, not an edge one.
      if (draggable) {
        for (const leg of ['pickup', 'dropoff']) {
          markers.current[leg].on('dragend', () => {
            const { lat, lng } = markers.current[leg].getLngLat()
            onMove(leg, { lat, lng })
          })
        }
      }

      m.addSource('route', {
        type: 'geojson',
        data: { type: 'Feature', geometry: { type: 'LineString', coordinates: [] } },
      })
      // Two lines: a wide pale casing under a solid one, so the route stays
      // readable over both dark roads and pale ground.
      m.addLayer({
        id: 'route-casing',
        type: 'line',
        source: 'route',
        paint: { 'line-color': '#ffffff', 'line-width': 7, 'line-opacity': 0.9 },
        layout: { 'line-cap': 'round', 'line-join': 'round' },
      })
      m.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        paint: { 'line-color': '#0369a1', 'line-width': 4 },
        layout: { 'line-cap': 'round', 'line-join': 'round' },
      })

      setReady(true)
    })

    return () => {
      cancelled = true
      m.remove()
      map.current = null
      markers.current = { pickup: null, dropoff: null }
      setReady(false)
    }
    // Built once for a given trip; see the effect below for coordinate changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Boolean(pickup && dropoff)])

  // Coordinates changed — either a new address, or a pin dragged. Move the
  // markers and redraw the route without touching the map itself.
  useEffect(() => {
    const m = map.current
    if (!ready || !m || !pickup || !dropoff) return

    markers.current.pickup?.setLngLat([pickup.lng, pickup.lat])
    markers.current.dropoff?.setLngLat([dropoff.lng, dropoff.lat])

    let cancelled = false
    const ac = new AbortController()

    routeShape(pickup, dropoff, { signal: ac.signal }).then((shape) => {
      if (cancelled || !map.current) return

      const bounds = new LngLatBounds(
        [pickup.lng, pickup.lat],
        [pickup.lng, pickup.lat],
      ).extend([dropoff.lng, dropoff.lat])

      const src = m.getSource('route')
      if (src) {
        src.setData({
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: shape ?? [] },
        })
      }
      if (shape) for (const c of shape) bounds.extend(c)

      m.fitBounds(bounds, { padding: 36, maxZoom: 15, duration: 300 })
    })

    return () => {
      cancelled = true
      ac.abort()
    }
  }, [ready, pickup?.lat, pickup?.lng, dropoff?.lat, dropoff?.lng])

  if (!pickup || !dropoff) return null

  if (failed) {
    return (
      <p className="tripmap-failed">
        Map unavailable right now - the distance and prices below are unaffected.
      </p>
    )
  }

  return (
    <>
      <div className="tripmap" ref={holder} style={{ height }} />
      {onMove && (
        <p className="tripmap-hint">
          House numbers are often missing from the map, so a pin can land on the street
          rather than at the gate. Drag either pin to the exact spot.
        </p>
      )}
    </>
  )
}
