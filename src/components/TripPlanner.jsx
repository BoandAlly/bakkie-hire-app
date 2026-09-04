import { useEffect, useRef, useState } from 'react'
import {
  searchPlaces,
  currentLocation,
  typedAddress,
  leadingHouseNumber,
  isLocatable,
} from '../lib/geocode.js'
import Icon from './Icon.jsx'
import TripMap from './TripMap.jsx'

// The full-screen trip planner — the way a ride app does it. Tapping "Where to?"
// opens this over everything: pick-up and drop-off pinned at the top, and one
// shared list of address suggestions filling the rest of the screen as you type.
// Once both ends are set it turns into a little map to confirm, with a button
// back to the vehicle list.
//
// It reuses the same geocoding as the old inline picker (src/lib/geocode.js);
// what's new is the layout — one results list driven by whichever field you're
// editing, instead of a cramped dropdown under each box.

const DEBOUNCE_MS = 450 // Photon asks for ~1 request/second; wait for a pause.
const MIN_CHARS = 3

export default function TripPlanner({ trip, onSetLeg, onClose, count, tripKm, unlocatable }) {
  // Open on whatever still needs filling: a fresh trip lands on pick-up, a trip
  // that already has a pick-up lands ready to type the destination.
  const firstEmpty = !trip.pickup ? 'pickup' : !trip.dropoff ? 'dropoff' : 'dropoff'
  const bothSet = Boolean(trip.pickup && trip.dropoff)

  const [active, setActive] = useState(firstEmpty)
  const [mode, setMode] = useState(bothSet ? 'review' : 'search')
  const [text, setText] = useState({
    pickup: trip.pickup?.label ?? '',
    dropoff: trip.dropoff?.label ?? '',
  })
  const [results, setResults] = useState([])
  const [busy, setBusy] = useState(false)
  const [locating, setLocating] = useState(false)
  const [locateError, setLocateError] = useState('')

  const inputRef = useRef(null)
  const abortRef = useRef(null)

  const activeText = text[active]
  const activeValue = trip[active]
  const settled = Boolean(activeValue) && activeText.trim() === (activeValue.label ?? '').trim()

  // Focus the field being edited whenever we switch to it.
  useEffect(() => {
    if (mode === 'search') inputRef.current?.focus()
  }, [active, mode])

  // One type-ahead, for whichever field is active.
  useEffect(() => {
    if (mode !== 'search') return
    if (settled || activeText.trim().length < MIN_CHARS) {
      setResults([])
      setBusy(false)
      return
    }
    setBusy(true)
    const timer = setTimeout(async () => {
      abortRef.current?.abort()
      const ac = new AbortController()
      abortRef.current = ac
      const found = await searchPlaces(activeText, { signal: ac.signal })
      if (!ac.signal.aborted) {
        setResults(found)
        setBusy(false)
      }
    }, DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [activeText, settled, active, mode])

  const setLegText = (leg, v) => setText((t) => ({ ...t, [leg]: v }))

  const editLeg = (leg) => {
    setActive(leg)
    setMode('search')
    setResults([])
  }

  // Save a chosen place, then move on: to the leg still empty, or to the confirm
  // map once both ends are known.
  const commit = (leg, p) => {
    onSetLeg({ [leg]: p })
    setLegText(leg, p?.label ?? '')
    setResults([])
    const other = leg === 'pickup' ? 'dropoff' : 'pickup'
    if (!trip[other]) {
      setActive(other)
      setMode('search')
    } else {
      setMode('review')
    }
  }

  const choose = (p) => {
    // Keep a house number they typed but the map didn't have ("12 Florida Rd").
    const typedNumber = p.kind === 'address' ? leadingHouseNumber(activeText) : ''
    const detail = /^\d/.test(p.label) ? '' : typedNumber
    commit(active, { ...p, detail })
  }

  const useHere = async () => {
    setLocating(true)
    setLocateError('')
    try {
      commit('pickup', await currentLocation())
    } catch (err) {
      setLocateError(err.message)
    }
    setLocating(false)
  }

  const useTyped = () => commit(active, typedAddress(activeText))

  const sameSpot = bothSet && trip.pickup.label === trip.dropoff.label
  const q = activeText.trim()
  const showNotFound = mode === 'search' && !busy && !settled && q.length >= MIN_CHARS && results.length === 0
  const showHint = mode === 'search' && !busy && results.length === 0 && !showNotFound

  const legRow = (leg, placeholder) => (
    <div className={active === leg ? `tripform-row ${leg} active` : `tripform-row ${leg}`}>
      <span className={`tripform-dot ${leg}`} />
      <input
        ref={active === leg ? inputRef : null}
        className="tripform-input"
        value={text[leg]}
        placeholder={placeholder}
        onFocus={() => editLeg(leg)}
        onChange={(e) => {
          setLegText(leg, e.target.value)
          // Typing after choosing means they're changing it; drop the old pin so
          // a half-edited address can't be quoted.
          if (trip[leg]) onSetLeg({ [leg]: null })
        }}
        aria-label={leg === 'pickup' ? 'Pick-up' : 'Drop-off'}
        autoComplete="off"
      />
      {text[leg] && (
        <button
          className="tripform-clear"
          aria-label={`Clear ${leg === 'pickup' ? 'pick-up' : 'drop-off'}`}
          onClick={() => {
            setLegText(leg, '')
            onSetLeg({ [leg]: null })
            editLeg(leg)
          }}
        >
          <Icon name="close" size={16} />
        </button>
      )}
    </div>
  )

  return (
    <div className="tripplanner" role="dialog" aria-label="Plan your trip">
      <header className="tripplanner-head">
        <button className="tripplanner-back" onClick={onClose} aria-label="Back to vehicles">
          <Icon name="back" size={22} />
        </button>
        <h2>Plan your trip</h2>
      </header>

      <div className="tripplanner-fields">
        <div className="tripform">
          {legRow('pickup', 'Where does the load start?')}
          {legRow('dropoff', 'Where is it going?')}
        </div>
      </div>

      <div className="tripplanner-body">
        {mode === 'search' ? (
          <>
            {active === 'pickup' && !trip.pickup && (
              <button className="tripplanner-here" disabled={locating} onClick={useHere}>
                <Icon name="pin" size={18} />
                {locating ? 'Finding you…' : 'Use my current location'}
              </button>
            )}
            {locateError && <p className="tripplanner-warn">{locateError}</p>}

            {busy && results.length === 0 && <p className="tripplanner-hint">Searching…</p>}

            {results.length > 0 && (
              <ul className="tripplanner-results">
                {results.map((p, i) => (
                  <li key={`${p.label}-${i}`}>
                    <button onClick={() => choose(p)}>
                      <Icon name={p.kind === 'suburb' ? 'pin' : 'search'} size={18} className="dim" />
                      <span>
                        <strong>{p.label}</strong>
                        {p.kind === 'suburb' && <em>Suburb</em>}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {showNotFound && (
              <div className="tripplanner-notfound">
                <p>We can&rsquo;t find that on the map. Check the spelling, or use it as you typed it.</p>
                <button className="btn secondary full" onClick={useTyped}>
                  Use &ldquo;{q}&rdquo; anyway
                </button>
                <em>No price estimate without a map location &mdash; your driver will quote you.</em>
              </div>
            )}

            {showHint && (
              <p className="tripplanner-hint">
                {activeValue ? 'Type to change this address.' : 'Start typing a street, place or suburb.'}
              </p>
            )}
          </>
        ) : (
          <div className="tripplanner-review">
            {sameSpot ? (
              <p className="tripplanner-warn">Pick two different places.</p>
            ) : unlocatable ? (
              <p className="tripplanner-warn">
                We couldn&rsquo;t find one of these on the map, so there&rsquo;s no estimate for this
                trip &mdash; your driver will quote you.
              </p>
            ) : tripKm == null ? (
              <p className="tripplanner-hint">Measuring the route&hellip;</p>
            ) : (
              <p className="tripplanner-km">
                {tripKm} km &middot; prices below are for this trip
              </p>
            )}

            {isLocatable(trip.pickup) && isLocatable(trip.dropoff) && (
              <TripMap
                pickup={trip.pickup}
                dropoff={trip.dropoff}
                height={200}
                onMove={(leg, coords) => {
                  const cur = trip[leg]
                  if (cur) onSetLeg({ [leg]: { ...cur, ...coords, kind: 'pinned' } })
                }}
              />
            )}

            {/* House number, complex or gate — the bit the map rarely has, and the
                bit the driver actually needs to find the door. */}
            <label className="tripplanner-detail">
              <span>Pick-up &mdash; house number, complex, gate (optional)</span>
              <input
                value={trip.pickup?.detail ?? ''}
                placeholder="e.g. 12, Gate 3"
                onChange={(e) => onSetLeg({ pickup: { ...trip.pickup, detail: e.target.value } })}
              />
            </label>
            <label className="tripplanner-detail">
              <span>Drop-off &mdash; house number, complex, gate (optional)</span>
              <input
                value={trip.dropoff?.detail ?? ''}
                placeholder="e.g. 47B, back entrance"
                onChange={(e) => onSetLeg({ dropoff: { ...trip.dropoff, detail: e.target.value } })}
              />
            </label>
          </div>
        )}
      </div>

      <footer className="tripplanner-foot">
        <button className="btn primary full" onClick={onClose} disabled={sameSpot}>
          {bothSet ? `Show ${count} vehicle${count === 1 ? '' : 's'}` : 'Done'}
        </button>
      </footer>
    </div>
  )
}
