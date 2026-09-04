import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// A small OpenStreetMap map that shows the driver's coverage as a circle they
// can resize with the radius slider, and a pin they can drag to their exact
// spot. Map tiles come from OpenStreetMap (free, attribution shown by Leaflet).
//
// The tiles need internet, but the circle and pin are drawn by Leaflet itself,
// so if the tiles fail to load the driver still sees and sets their radius —
// just over a blank background instead of streets.

const PIN_ICON = L.divIcon({
  className: 'radiuspin',
  html: '<span></span>',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
})

export default function RadiusMap({ center, radiusKm, onMovePin }) {
  const elRef = useRef(null)
  const mapRef = useRef(null)
  const circleRef = useRef(null)
  const markerRef = useRef(null)
  // Keep the latest callback without re-running the one-time init effect.
  const onMoveRef = useRef(onMovePin)
  onMoveRef.current = onMovePin
  const [tilesFailed, setTilesFailed] = useState(false)

  // Frame the circle in the viewport. Guarded because Leaflet throws if asked to
  // fit bounds before the map has been given a size (e.g. on the very first tick
  // after mount, or while the section is still laying out).
  const frame = () => {
    const map = mapRef.current
    const circle = circleRef.current
    if (!map || !circle) return
    try {
      if (map.getSize().x === 0) return
      map.fitBounds(circle.getBounds(), { padding: [24, 24], animate: false })
    } catch {
      /* map not ready yet — a later slider move will reframe it */
    }
  }

  // Init once.
  useEffect(() => {
    if (!elRef.current || mapRef.current) return
    const start = [center.lat, center.lng]
    const map = L.map(elRef.current, {
      center: start,
      zoom: 11,
      zoomControl: true,
      attributionControl: true,
    })
    mapRef.current = map

    // Carto rather than tile.openstreetmap.org. OSM's tile policy forbids
    // "distributing an app that uses tiles from openstreetmap.org" and access
    // can be withdrawn without notice, so this would have failed on launch
    // rather than in testing. Same OpenStreetMap data, same attribution.
    L.tileLayer('https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    })
      .on('tileerror', () => setTilesFailed(true))
      .addTo(map)

    const circle = L.circle(start, {
      radius: radiusKm * 1000,
      color: '#185FA5',
      weight: 2,
      fillColor: '#378ADD',
      fillOpacity: 0.15,
    }).addTo(map)
    circleRef.current = circle

    const marker = L.marker(start, { draggable: true, icon: PIN_ICON }).addTo(map)
    marker.on('drag', () => circleRef.current?.setLatLng(marker.getLatLng()))
    marker.on('dragend', () => {
      const p = marker.getLatLng()
      circleRef.current?.setLatLng(p)
      onMoveRef.current?.({ lat: p.lat, lng: p.lng })
    })
    markerRef.current = marker

    // The container is often sized just after mount; recalculate and frame the
    // circle once the browser has laid it out.
    requestAnimationFrame(() => {
      map.invalidateSize()
      frame()
    })

    return () => {
      map.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Slider moved: resize the circle and reframe it.
  useEffect(() => {
    const circle = circleRef.current
    if (!circle) return
    circle.setRadius(radiusKm * 1000)
    frame()
  }, [radiusKm])

  // Centre changed from outside (they picked a different suburb, or used their
  // location) — move the pin and circle there. Guarded so a drag we just
  // reported back doesn't fight this effect.
  useEffect(() => {
    const marker = markerRef.current
    const circle = circleRef.current
    const map = mapRef.current
    if (!marker || !circle || !map) return
    const p = marker.getLatLng()
    if (Math.abs(p.lat - center.lat) < 1e-6 && Math.abs(p.lng - center.lng) < 1e-6) return
    const next = [center.lat, center.lng]
    marker.setLatLng(next)
    circle.setLatLng(next)
    map.setView(next)
    frame()
  }, [center.lat, center.lng])

  return (
    <div className="radiusmap">
      <div className="radiusmap-canvas" ref={elRef} />
      {tilesFailed && (
        <p className="radiusmap-offline">
          Map picture couldn&rsquo;t load (no internet) — your radius still works.
        </p>
      )}
    </div>
  )
}
