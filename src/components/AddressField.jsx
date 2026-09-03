import { useEffect, useRef, useState } from 'react'
import { searchPlaces } from '../lib/geocode.js'
import Icon from './Icon.jsx'

// A text box that suggests places as you type: your own suburbs first, then
// streets and landmarks from OpenStreetMap.
//
// The debounce is not a nicety. Photon's free service asks for about one
// request a second, and a box that fired on every keystroke would get the app
// blocked, so nothing is sent until typing pauses.
const DEBOUNCE_MS = 450
const MIN_CHARS = 3

export default function AddressField({ label, value, onChange, placeholder }) {
  const [text, setText] = useState(value?.label ?? '')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
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
    onChange(p)
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

      {open && !busy && text.trim().length >= MIN_CHARS && results.length === 0 && (
        <p className="addressfield-empty">
          Nothing found. Try the suburb name on its own.
        </p>
      )}
    </div>
  )
}
