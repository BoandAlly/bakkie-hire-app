import { useState } from 'react'
import Icon from './Icon.jsx'

// Hand the driver the pick-up in a form their own maps app understands.
//
// Coordinates, not the address, when we have them: "-29.7275,31.0847" pastes
// into Google Maps, Waze or anything else and lands on the exact point - which
// matters here, because South African house numbers are mostly missing from the
// map and a typed address often resolves to the middle of the street or not at
// all. Where there are no coordinates the address text is the best we have.

/** What actually goes on the clipboard. */
export const locationText = (label, at) =>
  at && Number.isFinite(at.lat) ? `${at.lat.toFixed(6)},${at.lng.toFixed(6)}` : label

async function copy(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Older WebViews, or a page the clipboard API refuses. Falling back rather
    // than telling a driver standing in the street that copying "failed".
    try {
      const el = document.createElement('textarea')
      el.value = text
      el.setAttribute('readonly', '')
      el.style.position = 'fixed'
      el.style.opacity = '0'
      document.body.appendChild(el)
      el.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(el)
      return ok
    } catch {
      return false
    }
  }
}

export default function CopyLocation({ label, at, compact = false, title = 'Copy for maps' }) {
  const [state, setState] = useState('idle')
  const text = locationText(label, at)
  if (!text) return null

  return (
    <button
      className={compact ? 'copyloc compact' : 'copyloc'}
      title={`${title}: ${text}`}
      aria-label={`${title}: ${text}`}
      onClick={async (e) => {
        // On a list row this sits inside a button that opens the chat.
        e.stopPropagation()
        e.preventDefault()
        const ok = await copy(text)
        setState(ok ? 'done' : 'failed')
        setTimeout(() => setState('idle'), 2000)
      }}
    >
      <Icon name={state === 'done' ? 'check' : 'pin'} size={compact ? 14 : 15} />
      {!compact && (
        <span>
          {state === 'done' ? 'Copied' : state === 'failed' ? 'Press and hold to copy' : 'Copy'}
        </span>
      )}
    </button>
  )
}
