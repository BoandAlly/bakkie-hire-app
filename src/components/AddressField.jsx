import { useEffect, useRef, useState } from 'react'
import { searchPlaces, leadingHouseNumber, currentLocation, typedAddress } from '../lib/geocode.js'
import Icon from './Icon.jsx'

// A text box that suggests places as you type: your own suburbs first, then
// streets and landmarks from OpenStreetMap.
//
// The debounce is not a nicety. Photon's free service asks for about one
// request a second, and a box that fired on every keystroke would get the app
// blocked, so nothing is sent until typing pauses.
const DEBOUNCE_MS = 450
const MIN_CHARS = 3

export default function AddressField({ label, value, onChange, placeholder, allowCurrent = false }) {
  const [text, setText] = useState(value?.label ?? '')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [locating, setLocating] = useState(false)
  const [locateError, setLocateError] = useState('')
  const boxRef = useRef(null)
  const abortRef = useRef(null)

  // Keep the box in step when the trip is changed from somewhere else.
  useEffect(() => {
    setText(value?.label ?? '')
  }, [value?.label])

  useEffect(() => {
    // Already showing exactly what was chosen — nothing to look up.
    if (!open || text.trim() === (value?.label ?? '').trim()) return

    if (text.trim().length < MIN_CHARS) {
      setResults([])
      return
    }

    setBusy(true)
    const timer = setTimeout(async () => {
      abortRef.current?.abort()
      const ac = new AbortController()
      abortRef.current = ac
      const found = await searchPlaces(text, { signal: ac.signal })
      if (!ac.signal.aborted) {
        setResults(found)
        setBusy(false)
      }
    }, DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [text, open, value?.label])

  // Clicking away closes the list rather than leaving it floating.
  useEffect(() => {
    const away = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', away)
    return () => document.removeEventListener('pointerdown', away)
  }, [])

  const choose = (p) => {
    // If they typed "12 Florida Road" and the map had no number for it, keep
    // their 12 rather than silently dropping it.
    const typedNumber = p.kind === 'address' ? leadingHouseNumber(text) : ''
    const detail = /^\d/.test(p.label) ? '' : typedNumber
    onChange({ ...p, detail })
    setText(p.label)
    setResults([])
    setOpen(false)
  }

  return (
    <div className="addressfield" ref={boxRef}>
      <span className="tripfield-label">{label}</span>
      <div className="addressfield-box">
        <Icon name="search" size={17} className="dim" />
        <input
          value={text}
          placeholder={placeholder}
          onChange={(e) => {
            setText(e.target.value)
            setOpen(true)
            // Typing after choosing means they're changing their mind; drop the
            // old pin so a half-edited address can't be quoted.
            if (value) onChange(null)
          }}
          onFocus={() => setOpen(true)}
          aria-label={label}
          autoComplete="off"
        />
        {text && (
          <button
            className="searchclear"
            onClick={() => {
              setText('')
              onChange(null)
              setResults([])
              setOpen(true)
            }}
            aria-label={`Clear ${label.toLowerCase()}`}
          >
            <Icon name="close" size={14} />
          </button>
        )}
      </div>

      {/* Pick-up only: someone knows where they are standing, and typing your
          own address is the most tedious part of asking for a bakkie. Nobody
          can usefully do this for a drop-off they are not at. */}
      {allowCurrent && !value && (
        <button
          className="addressfield-here"
          disabled={locating}
          onClick={async () => {
            setLocating(true)
            setLocateError('')
            try {
              const here = await currentLocation()
              onChange(here)
              setText(here.label)
              setResults([])
              setOpen(false)
            } catch (err) {
              setLocateError(err.message)
            }
            setLocating(false)
          }}
        >
          <Icon name="pin" size={16} />
          {locating ? 'Finding you…' : 'Use my current location'}
        </button>
      )}

      {locateError && <p className="addressfield-warn">{locateError}</p>}

      {open && (busy || results.length > 0) && (
        <ul className="addressfield-list">
          {busy && results.length === 0 && <li className="addressfield-busy">Searching…</li>}
          {results.map((p, i) => (
            <li key={`${p.label}-${i}`}>
              <button onClick={() => choose(p)}>
                <Icon name={p.kind === 'suburb' ? 'pin' : 'search'} size={15} className="dim" />
                <span>
                  <strong>{p.label}</strong>
                  {p.kind === 'suburb' && <em>Suburb</em>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Plenty of South African streets simply are not in OpenStreetMap.
          Refusing what someone typed would strand them, so it is kept as
          written - the trip just goes through without an estimate and the
          price gets sorted out in the chat. */}
      {open && !busy && text.trim().length >= MIN_CHARS && results.length === 0 && (
        <div className="addressfield-notfound">
          <p>We can&rsquo;t find that on the map. Check the spelling, or use it as you typed it.</p>
          <button
            className="btn secondary full"
            onClick={() => {
              onChange(typedAddress(text))
              setOpen(false)
            }}
          >
            Use &ldquo;{text.trim()}&rdquo; anyway
          </button>
          <em>No price estimate without a map location - your driver will quote you.</em>
        </div>
      )}

      {value?.kind === 'typed' && (
        <p className="addressfield-warn">
          Not found on the map, so double-check this is right. No estimate for this trip.
        </p>
      )}

      {/* Once a place is pinned, the number and the "which gate" detail come
          from the person, not the map — South African house numbers mostly
          aren't in OpenStreetMap, and this is what the driver actually needs to
          find the door. It doesn't move the pin, so it can't skew the price. */}
      {value && (
        <input
          className="addressfield-detail"
          value={value.detail ?? ''}
          onChange={(e) => onChange({ ...value, detail: e.target.value })}
          placeholder="House number, complex, gate — optional"
          aria-label={`${label} house number or directions`}
        />
      )}
    </div>
  )
}
