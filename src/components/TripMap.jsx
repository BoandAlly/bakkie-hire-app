import { useCallback, useEffect, useRef, useState } from 'react'
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

// A live position while the goods are in transit — {lat, lng} or null. Shown as
// a third pin that moves, so the customer can watch the trip run from pick-up to
// drop-off. It is deliberately only the paid leg: the driver's drive to reach
// the customer is never on this map.
const hasCoords = (p) => p && Number.isFinite(p.lat) && Number.isFinite(p.lng)

// Which point of the road shape the driver is nearest — where to cut the line
// into "already driven" and "still to go". Compared in squared degrees with the
// longitude scaled for latitude, which is close enough over a town-sized trip
// and avoids a trig call per point on every position update.
function nearestIndex(line, p) {
  const squash = Math.cos((p.lat * Math.PI) / 180)
  let best = 0
  let bestD = Infinity
  for (let i = 0; i < line.length; i++) {
    const dLat = line[i][0] - p.lat
    const dLng = (line[i][1] - p.lng) * squash
    const d = dLat * dLat + dLng * dLng
    if (d < bestD) {
      bestD = d
      best = i
    }
  }
  return best
}

export default function TripMap({ pickup, dropoff, driver = null, height = 200, onMove = null }) {
  const holder = useRef(null)
  const map = useRef(null)
  const layers = useRef({ pickup: null, dropoff: null, route: null, driver: null, done: null })
  // The road shape, kept so the line can be re-split as the driver moves without
  // asking the routing server again, and the last position the map was told about.
  const shape = useRef(null)
  const lastDriver = useRef(null)
  const [failed, setFailed] = useState(false)

  // The route drawn in two pieces, the way a ride app does it: the road still
  // ahead in strong blue, the part already driven faded out behind. It is only
  // geometry on a shape fetched once, so a position every few seconds costs
  // nothing. With no driver it is simply the whole route in blue.
  const paintRoute = useCallback((at) => {
    const m = map.current
    const line = shape.current
    if (!m || !line) return

    for (const key of ['route', 'done']) {
      if (layers.current[key]) {
        m.removeLayer(layers.current[key])
        layers.current[key] = null
      }
    }

    const cut = hasCoords(at) ? nearestIndex(line, at) : 0
    if (cut > 0) {
      layers.current.done = L.polyline(line.slice(0, cut + 1), {
        color: '#94a3b8',
        weight: 4,
        opacity: 0.55,
      }).addTo(m)
    }

    // The live pin, not the nearest road point, starts the remaining line — so
    // it runs from the bakkie itself rather than from a spot beside it.
    const ahead = hasCoords(at)
      ? [[at.lat, at.lng], ...line.slice(cut + 1)]
      : line.slice(cut)
    layers.current.route = L.polyline(ahead, { color: '#0369a1', weight: 4, opacity: 0.9 }).addTo(m)
  }, [])

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

    // A live driver position may already be set when the map is first built
    // (the customer opens a trip already under way). Read the current prop
    // rather than a dependency: this effect only runs on a rebuild, and the
    // moving updates are handled by the effect below.
    if (hasCoords(driver)) {
      layers.current.driver = L.marker([driver.lat, driver.lng], {
        icon: pinIcon('#b45309', 'D'),
        zIndexOffset: 1000,
      }).addTo(m)
    }

    map.current = m
    return () => {
      m.remove()
      map.current = null
      layers.current = { pickup: null, dropoff: null, route: null, driver: null, done: null }
      shape.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLocatable(pickup) && isLocatable(dropoff)])

  // The driver moving. Its own effect so a new position slides the pin without
  // touching the route or the pick-up/drop-off markers. Follows the pin gently
  // — panned to keep it in view, but never zoomed, so the customer's own
  // pinch-to-zoom is left alone.
  useEffect(() => {
    const m = map.current
    if (!m) return
    if (hasCoords(driver)) {
      if (layers.current.driver) {
        layers.current.driver.setLatLng([driver.lat, driver.lng])
      } else {
        layers.current.driver = L.marker([driver.lat, driver.lng], {
          icon: pinIcon('#b45309', 'D'),
          zIndexOffset: 1000,
        }).addTo(m)
      }
      if (!m.getBounds().contains([driver.lat, driver.lng])) {
        m.panTo([driver.lat, driver.lng], { animate: true })
      }
      lastDriver.current = driver
      paintRoute(driver)
    } else if (layers.current.driver) {
      m.removeLayer(layers.current.driver)
      layers.current.driver = null
    }
  }, [driver, paintRoute])

  // Coordinates changed — a new address, or a pin dragged. Move the markers and
  // redraw the route without touching the map itself.
  useEffect(() => {
    const m = map.current
    if (!m || !isLocatable(pickup) || !isLocatable(dropoff)) return

    layers.current.pickup?.setLatLng([pickup.lat, pickup.lng])
    layers.current.dropoff?.setLatLng([dropoff.lat, dropoff.lng])

    let cancelled = false
    const ac = new AbortController()

    routeShape(pickup, dropoff, { signal: ac.signal }).then((road) => {
      if (cancelled || !map.current) return

      if (layers.current.route) {
        m.removeLayer(layers.current.route)
        layers.current.route = null
      }

      let bounds = L.latLngBounds([pickup.lat, pickup.lng], [dropoff.lat, dropoff.lng])

      if (road) {
        // OSRM returns [lng, lat]; Leaflet wants the other way round.
        const line = road.map(([lng, lat]) => [lat, lng])
        shape.current = line
        paintRoute(lastDriver.current)
        bounds = L.latLngBounds(line)
      } else {
        // Routing unavailable: forget the old shape rather than splitting this
        // trip against the last one.
        shape.current = null
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
  }, [pickup, dropoff, paintRoute])

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
