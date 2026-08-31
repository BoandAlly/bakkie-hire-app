import { useEffect, useRef, useState } from 'react'
import { classById, VehicleSilhouette } from '../data/vehicleClasses.jsx'
import { timeLabel } from '../lib/threads.js'
import Icon from '../components/Icon.jsx'

// Where the job actually gets arranged.

const OPENERS = [
  'Hi, is your bakkie available this Saturday morning?',
  'I need a fridge and a washing machine moved — would that fit?',
  'What would you charge to move a room of furniture across town?',
]

export default function Chat({ listing, thread, onSend, onBack, viewAs = 'customer' }) {
  const [draft, setDraft] = useState('')
  const logRef = useRef(null)
  const cls = classById(listing.vehicleClass)

  useEffect(() => {
    const el = logRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [thread?.messages.length])

  const send = (text) => {
    const body = (text ?? draft).trim()
    if (!body) return
    onSend(listing.id, viewAs, body)
    setDraft('')
  }

  const messages = thread?.messages ?? []
  const other = viewAs === 'customer' ? listing.ownerName : thread?.customerName ?? 'Customer'

  return (
    <div className="chat">
      <header className="appbar">
        <button className="appbar-back" onClick={onBack} aria-label="Back">
          <Icon name="back" size={21} />
        </button>
        <span className="avatar sm">
          {listing.photos?.[0] ? (
            <img src={listing.photos[0]} alt="" />
          ) : (
            <VehicleSilhouette classId={listing.vehicleClass} />
          )}
        </span>
        <span className="appbar-title">
          <strong>{other}</strong>
          <em>{cls?.name}</em>
        </span>
      </header>

      <div className="chat-log" ref={logRef}>
        {messages.length === 0 && (
          <div className="chat-intro">
            <p>
              Say what you need moved, where from and where to, and when. Sort the price out
              between you.
            </p>
            {viewAs === 'customer' && (
              <div className="suggestions">
                {OPENERS.map((o) => (
                  <button key={o} onClick={() => send(o)}>
                    {o}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`msg ${m.from === viewAs ? 'mine' : 'theirs'}`}>
            <p>{m.text}</p>
            <span>{timeLabel(m.at)}</span>
          </div>
        ))}
      </div>

      <div className="composer">
        <input
          value={draft}
          placeholder="Message…"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
        />
        <button onClick={() => send()} disabled={!draft.trim()} aria-label="Send">
          <Icon name="send" size={19} />
        </button>
      </div>
    </div>
  )
}
