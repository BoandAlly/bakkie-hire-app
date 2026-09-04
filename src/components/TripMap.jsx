import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { routeShape, isLocatable } from '../lib/geocode.js'

// The trip on a map: where it starts, where it ends, and the road between.
//
// Leaflet rather than MapLibre, on purpose. MapLibre needs WebGL and costs about
// a megabyte; Leaflet draws plain images, weighs a seventh of that, and works on
// cheap Android phones where WebGL is patchy. For a map you glance at to check
// the route looks right, vector tiles are not worth the difference — and the
// listing form already uses Leaflet, so this is one library instead of two.
//
// Tiles come from Carto rather than tile.openstreetmap.org. OSM's tile policy
// forbids "distributing an app that uses tiles from openstreetmap.org", and
// access can be cut off without warning; Carto serves the same OpenStreetMap
// data and permits this. Attribution is required either way and is shown below.
const TILES = 'https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png'
const ATTRIBUTION = '&copy; OpenStreetMap contributors &copy; CARTO'

/** A round lettered pin, matching the ones in the rest of the app. */
const pinIcon = (color, label) =>
  L.divIcon({
    className: '',
    html: `<div class="mappin" style="background:${color}">${label}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  })

export default function TripMap({ pickup, dropoff, height = 200, onMove = null }) {
  const holder = useRef(null)
  const map = useRef(null)
  const layers = useRef({ pickup: null, dropoff: null, route: null })
  const [failed, setFailed] = useState(false)

  // Built once. Coordinates are handled by the effect below, moving the markers
  // in place — rebuilding on every change would tear the map down mid-drag and
  // throw away whatever the person had panned to.
  useEffect(() => {
    if (!holder.current || !isLocatable(pickup) || !isLocatable(dropoff)) return

    const m = L.map(holder.current, {
      // A map inside a scrolling page shouldn't eat the scroll; people can still
      // pinch and drag deliberately.
      scrollWheelZoom: false,
      zoomControl: false,
    }).setView([pickup.lat, pickup.lng], 11)

    L.tileLayer(TILES, { attribution: ATTRIBUTION, maxZoom: 19 })
      // A tile server that's down must not leave a broken grey box.
      .on('tileerror', () => setFailed(true))
      .addTo(m)

    L.control.zoom({ position: 'bottomright' }).addTo(m)

    const draggable = Boolean(onMove)
    layers.current.pickup = L.marker([pickup.lat, pickup.lng], {
      icon: pinIcon('#0369a1', 'A'),
      draggable,
    }).addTo(m)
    layers.current.dropoff = L.marker([dropoff.lat, dropoff.lng], {
      icon: pinIcon('#15803d', 'B'),
      draggable,
    }).addTo(m)

    // Dragging is how someone corrects a pin that landed on the street instead
    // of at their gate — South African house numbers are largely absent from
    // OpenStreetMap, so that is the normal case, not an edge one.
    if (draggable) {
      for (const leg of ['pickup', 'dropoff']) {
        layers.current[leg].on('dragend', (e) => {
          const { lat, lng } = e.target.getLatLng()
          onMove(leg, { lat, lng })
        })
      }
    }

    map.current = m
    return () => {
      m.remove()
      map.current = null
      layers.current = { pickup: null, dropoff: null, route: null }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLocatable(pickup) && isLocatable(dropoff)])

  // Coordinates changed — a new address, or a pin dragged. Move the markers and
  // redraw the route without touching the map itself.
  useEffect(() => {
    const m = map.current
    if (!m || !isLocatable(pickup) || !isLocatable(dropoff)) return

    layers.current.pickup?.setLatLng([pickup.lat, pickup.lng])
    layers.current.dropoff?.setLatLng([dropoff.lat, dropoff.lng])

    let cancelled = false
    const ac = new AbortController()

    routeShape(pickup, dropoff, { signal: ac.signal }).then((shape) => {
      if (cancelled || !map.current) return

      if (layers.current.route) {
        m.removeLayer(layers.current.route)
        layers.current.route = null
      }

      let bounds = L.latLngBounds([pickup.lat, pickup.lng], [dropoff.lat, dropoff.lng])

      if (shape) {
        // OSRM returns [lng, lat]; Leaflet wants the other way round.
        const line = shape.map(([lng, lat]) => [lat, lng])
        layers.current.route = L.polyline(line, {
          color: '#0369a1',
          weight: 4,
          opacity: 0.9,
        }).addTo(m)
        bounds = layers.current.route.getBounds()
      }

      m.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 })
    })

    return () => {
      cancelled = true
      ac.abort()
    }
    // The legs themselves, so the linter can check this list. They only change
    // identity when the trip changes - Explore rebuilds them on an edit and
    // nothing else touches them - so this does not redraw on every render.
  }, [pickup, dropoff])

  // An address with no map location has nothing to draw.
  if (!isLocatable(pickup) || !isLocatable(dropoff)) return null

  if (failed) {
    return (
      <p className="tripmap-failed">
        Map unavailable right now - the distance and prices are unaffected.
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
