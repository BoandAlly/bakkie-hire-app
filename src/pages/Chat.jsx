import { useEffect, useMemo, useRef, useState } from 'react'
import { classById, VehicleSilhouette } from '../data/vehicleClasses.jsx'
import { PLACES, routeDistanceKm } from '../data/places.js'
import { quote, rateLabel, rand } from '../lib/pricing.js'
import { timeLabel, bookingSummary, bookingDateLabel, isUpcoming } from '../lib/threads.js'
import { nearestPlace } from '../lib/geo.js'
import { shrinkImage } from '../lib/photos.js'
import { loadTrip, isTripSet } from '../lib/trip.js'
import { roadDistanceBetween, fullAddress } from '../lib/geocode.js'
import { formatPhone } from '../lib/session.js'
import Icon, { Stars } from '../components/Icon.jsx'

// Where the job actually gets arranged.

// Photo shrinking lives in lib/photos.js — the listing form needs exactly the
// same thing, and having two copies is how they drift apart.

// The driver's live position when they snap a photo, named to the nearest
// suburb. Resolves to null (rather than rejecting) if location is off/declined,
// so a photo still sends — just without the tag.
function currentPlace() {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) return resolve(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        resolve({ ...coords, place: nearestPlace(coords)?.name ?? null })
      },
      () => resolve(null),
      { timeout: 8000, maximumAge: 60000 },
    )
  })
}

const OPENERS = [
  'Hi, is your bakkie available this Saturday morning?',
  'I need a fridge and a washing machine moved — would that fit?',
  'What would you charge to move a room of furniture across town?',
]

export default function Chat({
  listing,
  thread,
  onSend,
  onBack,
  onPatchBooking,
  viewAs = 'customer',
}) {
  const [draft, setDraft] = useState('')
  const [calcOpen, setCalcOpen] = useState(false)
  const [bookOpen, setBookOpen] = useState(false)
  const [photoError, setPhotoError] = useState('')
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

  // Driver snaps a before/after photo of the load; it's tagged with their live
  // location + time and dropped into the chat so the customer sees it too.
  const postPhoto = async (booking, phase, file) => {
    setPhotoError('')
    let src
    try {
      src = await shrinkImage(file)
    } catch {
      // Used to fail silently — the driver tapped, nothing appeared, and there
      // was no way to tell whether it had sent.
      setPhotoError('That picture couldn’t be read. Try taking it again.')
      return
    }
    const loc = await currentPlace()
    const at = new Date().toISOString()
    const label = phase === 'before' ? 'Loading photo' : 'Delivery photo'
    const text = `${label}${loc?.place ? ` — ${loc.place}` : ''}, ${timeLabel(at)}`
    onSend(listing.id, 'owner', text, {
      kind: 'photo',
      photo: { phase, src, lat: loc?.lat, lng: loc?.lng, place: loc?.place ?? null, at, bookingId: booking.id },
    })
    onPatchBooking(
      booking.id,
      phase === 'before'
        ? { photoBefore: true }
        : { photoAfter: true, deliveredAt: at, deliveredPlace: loc?.place ?? null },
    )
  }

  const messages = thread?.messages ?? []
  const other = viewAs === 'customer' ? listing.ownerName : thread?.customerName ?? 'Customer'
  const firstName = listing.ownerName.split(' ')[0]

  // The fare tool is the customer's alone — it exists to help them decide whether
  // to even start the conversation. The driver sets their rate; they don't need a
  // calculator pointed back at themselves.
  const isCustomer = viewAs === 'customer'

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

        {messages.map((m, i) =>
          m.kind === 'booking' && m.booking ? (
            <BookingCard
              key={i}
              booking={m.booking}
              at={m.at}
              viewAs={viewAs}
              onPatch={onPatchBooking}
              onPhoto={postPhoto}
            />
          ) : m.kind === 'photo' && m.photo ? (
            <PhotoMessage key={i} m={m} mine={m.from === viewAs} />
          ) : (
            <div key={i} className={`msg ${m.from === viewAs ? 'mine' : 'theirs'}`}>
              <p>{m.text}</p>
              <span>{timeLabel(m.at)}</span>
            </div>
          ),
        )}

        {photoError && <p className="blockhint error">{photoError}</p>}
      </div>

      {isCustomer && calcOpen && (
        <FareCalculator
          listing={listing}
          firstName={firstName}
          onClose={() => setCalcOpen(false)}
          onAsk={(text) => {
            send(text)
            setCalcOpen(false)
          }}
        />
      )}

      {isCustomer && (
        <button
          className={calcOpen ? 'farebtn on' : 'farebtn'}
          onClick={() => setCalcOpen((v) => !v)}
          aria-expanded={calcOpen}
        >
          <Icon name="wallet" size={18} />
          <span>Estimate a fare</span>
          <Icon name="chevron" size={15} className="dim" />
        </button>
      )}

      {!isCustomer && bookOpen && (
        <BookingForm
          listing={listing}
          customerName={thread?.customerName ?? 'Customer'}
          onClose={() => setBookOpen(false)}
          onBook={(booking) => {
            onSend(listing.id, 'owner', bookingSummary(booking), { kind: 'booking', booking })
            setBookOpen(false)
          }}
        />
      )}

      {!isCustomer && (
        <button
          className={bookOpen ? 'farebtn on' : 'farebtn'}
          onClick={() => setBookOpen((v) => !v)}
          aria-expanded={bookOpen}
        >
          <Icon name="route" size={18} />
          <span>Book a pickup</span>
          <Icon name="chevron" size={15} className="dim" />
        </button>
      )}

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

// Client-side price guide. Pick a pickup and a drop-off, get an estimate off the
// driver's own rate — the same maths the listing is quoted on everywhere else, so
// it can't quietly disagree with the number they saw on the ad.
// The five things people actually move, from the seeded listings. "Something
// else" opens a free-text box rather than forcing a bad fit.
const GOODS = [
  'Furniture',
  'Appliances',
  'Building material',
  'Boxes / household',
  'Something else',
]

function FareCalculator({ listing, firstName, onClose, onAsk }) {
  // The customer already told us the job on the browse screen. Asking again
  // here would be the app forgetting. They can still change it — that reopens
  // the trip screen, which is where the address search lives.
  const savedTrip = loadTrip()
  const haveSavedTrip = isTripSet(savedTrip)

  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [tripKm, setTripKm] = useState(null)

  useEffect(() => {
    if (!haveSavedTrip) return
    let alive = true
    roadDistanceBetween(savedTrip.pickup, savedTrip.dropoff).then((km) => {
      if (alive) setTripKm(km)
    })
    return () => {
      alive = false
    }
  }, [haveSavedTrip, savedTrip.pickup?.lat, savedTrip.dropoff?.lat])
  const [goods, setGoods] = useState('')
  const [goodsOther, setGoodsOther] = useState('')
  const [when, setWhen] = useState('now')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [accompany, setAccompany] = useState(false)
  const [liftBack, setLiftBack] = useState(false)
  const [declared, setDeclared] = useState(false)

  // Where the job is, and how far — from the saved trip when there is one,
  // otherwise from the two pickers below.
  const fromLabel = haveSavedTrip ? fullAddress(savedTrip.pickup) : from
  const toLabel = haveSavedTrip ? fullAddress(savedTrip.dropoff) : to

  const result = useMemo(() => {
    const distanceKm = haveSavedTrip ? tripKm : from && to && from !== to ? routeDistanceKm(from, to) : null
    if (distanceKm == null) return null
    return { distanceKm, q: quote(listing, { distanceKm, helpers: 0 }) }
  }, [haveSavedTrip, tripKm, from, to, listing])

  const goodsText = goods === 'Something else' ? goodsOther.trim() : goods
  // The driver decides whether to take a job from what is being moved, so the
  // request isn't sendable until they've been told and the customer has
  // confirmed it's accurate.
  const ready = Boolean(result && goodsText && declared && (when === 'now' || date))

  const whenText =
    when === 'now'
      ? 'as soon as possible'
      : `on ${bookingDateLabel(date)}${time ? ` at ${time}` : ''}`

  const askText = result
    ? [
        `Hi ${firstName}, what would you charge to move ${goodsText.toLowerCase()} `,
        `from ${fromLabel} to ${toLabel}, ${whenText}?`,
        ` (About ${result.distanceKm} km — I estimated around ${rand(result.q.total)}.)`,
        accompany ? ' I’d travel with the goods.' : '',
        accompany && liftBack ? ' I’d need a lift back too.' : '',
      ].join('')
    : ''

  return (
    <div className="farecalc">
      <div className="farecalc-head">
        <strong>Estimate a fare</strong>
        <button onClick={onClose} aria-label="Close">
          <Icon name="close" size={17} />
        </button>
      </div>

      {/* The trip the customer already set on the browse screen, including any
          house number they gave. Only falls back to picking suburbs here if
          they somehow reached a chat without setting one. */}
      {haveSavedTrip ? (
        <div className="farecalc-trip">
          <Icon name="pin" size={16} className="dim" />
          <span>
            <strong>
              {fromLabel} &rarr; {toLabel}
            </strong>
            <em>{tripKm == null ? 'Measuring the route…' : `${tripKm} km`}</em>
          </span>
        </div>
      ) : (
        <>
          <div className="farecalc-fields">
            <label className="field">
              <span>Pick-up</span>
              <select value={from} onChange={(e) => setFrom(e.target.value)}>
                <option value="">Choose area</option>
                {PLACES.map((p) => (
                  <option key={p.name}>{p.name}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Drop-off</span>
              <select value={to} onChange={(e) => setTo(e.target.value)}>
                <option value="">Choose area</option>
                {PLACES.map((p) => (
                  <option key={p.name}>{p.name}</option>
                ))}
              </select>
            </label>
          </div>

          {from && to && from === to && (
            <p className="farecalc-hint">Pick two different areas to get an estimate.</p>
          )}
        </>
      )}

      <div className="tripfield">
        <span className="tripfield-label">What are you moving?</span>
        <div className="goodsrow">
          {GOODS.map((g) => (
            <button
              key={g}
              className={goods === g ? 'chip on' : 'chip'}
              onClick={() => setGoods(g)}
            >
              {g}
            </button>
          ))}
        </div>
        {goods === 'Something else' && (
          <input
            className="tripinput"
            value={goodsOther}
            onChange={(e) => setGoodsOther(e.target.value)}
            placeholder="e.g. a piano, garden refuse, a motorbike"
          />
        )}
      </div>

      <div className="tripfield">
        <span className="tripfield-label">When?</span>
        <div className="goodsrow">
          <button className={when === 'now' ? 'chip on' : 'chip'} onClick={() => setWhen('now')}>
            Need it now
          </button>
          <button
            className={when === 'later' ? 'chip on' : 'chip'}
            onClick={() => setWhen('later')}
          >
            Pick a date
          </button>
        </div>
        {when === 'later' && (
          <div className="farecalc-fields">
            <label className="field">
              <span>Date</span>
              <input
                type="date"
                value={date}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
            <label className="field">
              <span>Time</span>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </label>
          </div>
        )}
      </div>

      <label className="tripcheck">
        <input
          type="checkbox"
          checked={accompany}
          onChange={(e) => {
            setAccompany(e.target.checked)
            if (!e.target.checked) setLiftBack(false)
          }}
        />
        <span>I want to travel with the goods</span>
      </label>

      {/* Only meaningful if they're going along in the first place. */}
      {accompany && (
        <label className="tripcheck indent">
          <input
            type="checkbox"
            checked={liftBack}
            onChange={(e) => setLiftBack(e.target.checked)}
          />
          <span>I’ll need a lift back</span>
        </label>
      )}

      <label className="tripcheck">
        <input
          type="checkbox"
          checked={declared}
          onChange={(e) => setDeclared(e.target.checked)}
        />
        <span>
          What I’ve described is accurate. {firstName} has the right to know what they’re
          carrying before accepting.
        </span>
      </label>

      {result && (
        <>
          <div className="farecalc-result">
            <span className="farecalc-total">≈ {rand(result.q.total)}</span>
            <span className="farecalc-basis">
              {result.distanceKm} km · {rateLabel(listing)}
              {listing.rateUnit === 'hour' && ` · ~${result.q.hours} hr`}
              {result.q.minApplied && ' · minimum applies'}
            </span>
          </div>
          <p className="farecalc-note">
            A guide off {firstName}'s rate — helpers and anything extra aren't included, and
            the final price is whatever the two of you agree in the chat.
          </p>
          <button className="btn primary full" disabled={!ready} onClick={() => onAsk(askText)}>
            <Icon name="send" size={17} />
            Ask {firstName} about this trip
          </button>
          {!ready && (
            <p className="farecalc-hint">
              {!goodsText
                ? 'Say what you’re moving to send this.'
                : when === 'later' && !date
                  ? 'Pick a date to send this.'
                  : 'Tick the box above to confirm what you’re moving.'}
            </p>
          )}
        </>
      )}
    </div>
  )
}

// Driver-only. Fills in the four things a pickup needs and drops a ticket into the
// chat — the customer's copy of what was agreed, with the driver's number on it.
function BookingForm({ listing, customerName, onClose, onBook }) {
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [pickup, setPickup] = useState('')
  const [dropoff, setDropoff] = useState('')

  const ready = date && time && pickup && dropoff && pickup !== dropoff

  const submit = () => {
    if (!ready) return
    onBook({
      id: `bk${Date.now()}`,
      status: 'pending',
      driverConfirmed: false,
      customerConfirmed: false,
      date,
      time,
      pickup,
      dropoff,
      driverName: listing.ownerName,
      driverPhone: listing.ownerPhone,
      // Copied onto the booking rather than read live, so the customer's ticket
      // still shows the vehicle they agreed to even if the driver later edits
      // the listing or takes it down.
      vehicleReg: listing.registration ?? '',
      vehicleName: listing.title,
      customerName,
    })
  }

  return (
    <div className="farecalc">
      <div className="farecalc-head">
        <strong>Book a pickup</strong>
        <button onClick={onClose} aria-label="Close">
          <Icon name="close" size={17} />
        </button>
      </div>

      <div className="farecalc-fields">
        <label className="field">
          <span>Date</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="field">
          <span>Time</span>
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </label>
        <label className="field">
          <span>Pick-up</span>
          <select value={pickup} onChange={(e) => setPickup(e.target.value)}>
            <option value="">Choose area</option>
            {PLACES.map((p) => (
              <option key={p.name}>{p.name}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Drop-off</span>
          <select value={dropoff} onChange={(e) => setDropoff(e.target.value)}>
            <option value="">Choose area</option>
            {PLACES.map((p) => (
              <option key={p.name}>{p.name}</option>
            ))}
          </select>
        </label>
      </div>

      {pickup && dropoff && pickup === dropoff && (
        <p className="farecalc-hint">Pick-up and drop-off can't be the same place.</p>
      )}

      <button className="btn primary full" disabled={!ready} onClick={submit}>
        <Icon name="check" size={17} />
        Send booking to customer
      </button>
    </div>
  )
}

// The ticket itself — the same card whichever side is looking at it, but the
// action at the bottom depends on who's looking and where the trip's got to:
// the driver marks it done and rates the customer; the customer rates the driver.
function BookingCard({ booking, at, viewAs, onPatch, onPhoto }) {
  const b = booking
  const isDriver = viewAs === 'owner'
  const status = b.status ?? 'pending'
  const done = status === 'done'
  const cancelled = status === 'cancelled'
  const confirmed = status === 'confirmed'
  const pending = status === 'pending'
  const patch = (p) => onPatch?.(b.id, p)

  const driverFirst = (b.driverName ?? 'the driver').split(' ')[0]
  const custName = b.customerName ?? 'the customer'

  // Which rating this viewer owns, and who it's about.
  const myKey = isDriver ? 'custRating' : 'driverRating'
  const myRating = b[myKey]
  const target = isDriver ? custName : driverFirst

  // Confirmation runs in order, not in parallel: the driver names the price and
  // agrees to it first, then the customer accepts that price. Letting the
  // customer confirm first would mean agreeing to a figure the driver could
  // still change underneath them.
  const mineConfirmed = isDriver ? b.driverConfirmed : b.customerConfirmed
  const otherConfirmed = isDriver ? b.customerConfirmed : b.driverConfirmed
  const otherName = isDriver ? custName : driverFirst
  const canCancel = (pending || confirmed) && isUpcoming(b)

  // The driver owns the price. They can change it right up until they confirm;
  // after that it is fixed, because the customer is being asked to accept that
  // exact number.
  const priceLocked = Boolean(b.driverConfirmed) || confirmed || done || cancelled
  const canSetPrice = isDriver && !priceLocked
  const awaitingDriver = !b.driverConfirmed && !cancelled && !done
  const customerCanConfirm = !isDriver && Boolean(b.driverConfirmed) && !mineConfirmed

  const head = cancelled
    ? { icon: 'close', label: 'Pickup cancelled' }
    : done
      ? { icon: 'check', label: 'Trip complete' }
      : confirmed
        ? { icon: 'check', label: 'Pickup confirmed' }
        : { icon: 'route', label: 'Pickup requested' }

  const confirmPickup = () => {
    const key = isDriver ? 'driverConfirmed' : 'customerConfirmed'
    patch({ [key]: true, ...(otherConfirmed ? { status: 'confirmed' } : {}) })
  }

  const cancelPickup = () => {
    if (!window.confirm('Cancel this pickup? The other person will see it was called off.'))
      return
    patch({ status: 'cancelled', cancelledBy: viewAs, cancelledAt: new Date().toISOString() })
  }

  const cancelledBy =
    b.cancelledBy === viewAs ? 'you' : isDriver ? 'the customer' : 'the driver'

  const headClass = cancelled
    ? 'bookingcard-head off'
    : done || confirmed
      ? 'bookingcard-head done'
      : 'bookingcard-head'

  return (
    <div className={`bookingcard${cancelled ? ' cancelled' : ''}`}>
      <div className={headClass}>
        <Icon name={head.icon} size={16} />
        <strong>{head.label}</strong>
        <span>{timeLabel(at)}</span>
      </div>
      <div className="bookingcard-rows">
        <Row label="Date" value={bookingDateLabel(b.date)} />
        <Row label="Time" value={b.time} />
        <Row label="From" value={b.pickup} />
        <Row label="To" value={b.dropoff} />
      </div>

      {/* The price. It belongs to the driver — they set it, they can change it,
          and the customer is agreeing to their number, not to an app's guess. */}
      <div className="bookingcard-price">
        <span>
          <em>Price for this trip</em>
          <strong>{b.price ? rand(b.price) : 'Not set yet'}</strong>
        </span>
        {canSetPrice && (
          <button
            className="btn secondary"
            onClick={() => {
              const typed = window.prompt(
                'What are you charging for this trip? Rands only.',
                b.price ? String(b.price) : '',
              )
              if (typed == null) return
              const amount = Math.round(Number(String(typed).replace(/[^\d.]/g, '')))
              if (!Number.isFinite(amount) || amount <= 0) return
              patch({ price: amount })
            }}
          >
            {b.price ? 'Change' : 'Set price'}
          </button>
        )}
      </div>

      {isDriver && !priceLocked && (
        <p className="bookingcard-note">
          You decide the price. Change it as often as you like — it locks when you
          confirm, and only then is {custName} asked to accept it.
        </p>
      )}
      {!isDriver && awaitingDriver && (
        <p className="bookingcard-note">
          {driverFirst} sets the final price. You&rsquo;ll be asked to accept once they
          confirm.
        </p>
      )}
      {/* Who and what is turning up. Shown once a pickup exists, so the
          customer can recognise the vehicle in the street. */}
      {(b.vehicleReg || b.vehicleName) && (
        <div className="bookingcard-vehicle">
          <Icon name="truck" size={17} />
          <span>
            {b.vehicleReg && <strong>{b.vehicleReg}</strong>}
            {b.vehicleName && <em>{b.vehicleName}</em>}
          </span>
        </div>
      )}

      <div className="bookingcard-foot">
        <span>
          <strong>{b.driverName}</strong>
          <em>Your driver</em>
        </span>
        {b.driverPhone && (
          <a className="bookingcard-call" href={`tel:${b.driverPhone.replace(/\s/g, '')}`}>
            <Icon name="message" size={15} />
            {formatPhone(b.driverPhone)}
          </a>
        )}
      </div>

      {cancelled && (
        <div className="bookingcard-action muted">Pickup cancelled by {cancelledBy}.</div>
      )}

      {pending && (
        <div className="bookingcard-action">
          {mineConfirmed ? (
            <p className="bookingcard-wait">
              You confirmed {b.price ? `at ${rand(b.price)}` : ''} — waiting for {otherName}{' '}
              to accept.
            </p>
          ) : isDriver ? (
            <button
              className="btn primary full"
              disabled={!b.price}
              onClick={() => {
                if (
                  !window.confirm(
                    `Confirm this pickup at ${rand(b.price)}? The price is fixed once you do, and ${custName} will be asked to accept it.`,
                  )
                )
                  return
                confirmPickup()
              }}
            >
              <Icon name="check" size={17} />
              {b.price ? `Confirm at ${rand(b.price)}` : 'Set a price first'}
            </button>
          ) : customerCanConfirm ? (
            <button className="btn primary full" onClick={confirmPickup}>
              <Icon name="check" size={17} />
              {b.price ? `Accept ${rand(b.price)}` : 'Accept pickup'}
            </button>
          ) : (
            // Waiting on the driver. Nothing to accept yet, so no button —
            // the customer cannot agree to a price nobody has named.
            <p className="bookingcard-wait">
              Waiting for {driverFirst} to set a price and confirm.
            </p>
          )}
          {canCancel && (
            <button className="btn ghost full" onClick={cancelPickup}>
              Cancel pickup
            </button>
          )}
        </div>
      )}

      {confirmed && (
        <div className="bookingcard-action">
          {isDriver && <PhotoRow booking={b} onPhoto={onPhoto} />}

          {b.photoAfter && (
            <p className="bookingcard-delivered">
              <Icon name="check" size={15} />
              Delivery confirmed
              {b.deliveredPlace ? ` — ${b.deliveredPlace}` : ''}
              {b.deliveredAt ? `, ${timeLabel(b.deliveredAt)}` : ''}
            </p>
          )}

          {isDriver ? (
            <button
              className="btn primary full"
              onClick={() => patch({ status: 'done', doneAt: new Date().toISOString() })}
            >
              <Icon name="check" size={17} />
              Job done
            </button>
          ) : (
            <p className="bookingcard-wait">
              Pickup confirmed. You'll be able to rate {driverFirst} once the trip's done.
            </p>
          )}

          {canCancel && (
            <button className="btn ghost full" onClick={cancelPickup}>
              Cancel pickup
            </button>
          )}
        </div>
      )}

      {done && (
        <div className="bookingcard-action">
          {myRating ? (
            <div className="rated">
              <Icon name="check" size={16} />
              <span>You rated {target}</span>
              <Stars value={myRating} size={16} />
            </div>
          ) : (
            <RatingInput target={target} onSubmit={(v) => patch({ [myKey]: v })} />
          )}

          {isDriver && b.driverRating && (
            <div className="rated got">
              <span>{custName} rated you</span>
              <Stars value={b.driverRating} size={16} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Before/after camera buttons — driver only. Each opens the phone camera (or a
// file picker in the browser); the handler tags the shot with live location.
function PhotoRow({ booking, onPhoto }) {
  return (
    <div className="photorow">
      <PhotoButton
        label="Loading photo"
        done={booking.photoBefore}
        onPick={(f) => onPhoto(booking, 'before', f)}
      />
      <PhotoButton
        label="Delivery photo"
        done={booking.photoAfter}
        onPick={(f) => onPhoto(booking, 'after', f)}
      />
    </div>
  )
}

function PhotoButton({ label, done, onPick }) {
  const ref = useRef(null)
  return (
    <>
      <button
        type="button"
        className={done ? 'photobtn done' : 'photobtn'}
        onClick={() => ref.current?.click()}
      >
        <Icon name={done ? 'check' : 'camera'} size={16} />
        {done ? `Retake ${label.toLowerCase()}` : label}
      </button>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onPick(f)
          e.target.value = ''
        }}
      />
    </>
  )
}

// A load photo in the chat log — image plus where and when it was taken.
function PhotoMessage({ m, mine }) {
  const p = m.photo || {}
  const after = p.phase === 'after'
  return (
    <div className={`msg photo ${mine ? 'mine' : 'theirs'}`}>
      <div className="photomsg">
        <span className={`photomsg-tag ${after ? 'after' : 'before'}`}>
          {after ? 'After — delivered' : 'Before — loaded'}
        </span>
        <img src={p.src} alt={after ? 'Delivery photo' : 'Loading photo'} />
        <span className="photomsg-loc">
          <Icon name="pin" size={13} />
          {p.place || 'Location unavailable'} · {timeLabel(p.at)}
        </span>
      </div>
      <span>{timeLabel(m.at)}</span>
    </div>
  )
}

const Row = ({ label, value }) => (
  <div className="bookingcard-row">
    <span>{label}</span>
    <strong>{value}</strong>
  </div>
)

// Pick a score, then submit — kept as two steps so a stray tap can't fire off a
// rating you can't take back.
function RatingInput({ target, onSubmit }) {
  const [pick, setPick] = useState(0)
  return (
    <div className="ratinginput">
      <span className="ratinginput-label">How was {target}?</span>
      <StarPicker value={pick} onChange={setPick} />
      <button className="btn primary full" disabled={!pick} onClick={() => onSubmit(pick)}>
        Submit rating
      </button>
    </div>
  )
}

// Tap anywhere across the row; the left half of a star is a half-point. Hovering
// previews the score before it's committed.
function StarPicker({ value, onChange }) {
  const [hover, setHover] = useState(0)
  const shown = hover || value
  const steps = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5]
  return (
    <div className="starpick" onMouseLeave={() => setHover(0)}>
      <Stars value={shown} size={34} />
      <div className="starpick-hits">
        {steps.map((v) => (
          <button
            key={v}
            type="button"
            aria-label={`${v} star${v === 1 ? '' : 's'}`}
            onMouseEnter={() => setHover(v)}
            onClick={() => onChange(v)}
          />
        ))}
      </div>
      <span className="starpick-value">{shown ? shown.toFixed(1) : '—'}</span>
    </div>
  )
}
