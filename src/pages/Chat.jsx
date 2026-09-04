import { useEffect, useMemo, useRef, useState } from 'react'
import { classById, VehicleSilhouette } from '../data/vehicleClasses.jsx'
import { PLACES, routeDistanceKm } from '../data/places.js'
import { quote, rateLabel, rand } from '../lib/pricing.js'
import { timeLabel, bookingSummary, bookingDateLabel, isUpcoming } from '../lib/threads.js'
import { nearestPlace } from '../lib/geo.js'
import { shrinkImage } from '../lib/photos.js'
import { loadTrip, isTripSet } from '../lib/trip.js'
import { roadDistanceBetween, fullAddress, isLocatable } from '../lib/geocode.js'
import { formatPhone } from '../lib/session.js'
import Icon, { Stars } from '../components/Icon.jsx'
import CopyLocation from '../components/CopyLocation.jsx'

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
  onClash = null,
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
        {/* A driver decides whether to take a job from when, what and where.
            Asking those three across several back-and-forth messages wastes
            both people's evening, so the first message carries them or there is
            no first message. */}
        {messages.length === 0 && isCustomer && (
          <TripRequest
            listing={listing}
            firstName={firstName}
            customerName={thread?.customerName ?? 'Customer'}
            onSend={(booking) =>
              onSend(listing.id, 'customer', bookingSummary(booking), {
                kind: 'booking',
                booking,
              })
            }
          />
        )}

        {messages.length === 0 && !isCustomer && (
          <div className="chat-intro">
            <p>Nothing here yet. When a customer sends you a trip it appears here.</p>
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
              onClash={onClash}
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

      {/* The driver no longer creates the booking - the customer states their
          own trip. A driver who can't make that time asks for a different one,
          which the customer can accept or turn down; it is their move, not
          something that gets changed for them. */}
      {!isCustomer && bookOpen && (
        <RescheduleRequest
          firstName={thread?.customerName?.split(' ')[0] ?? 'the customer'}
          onClose={() => setBookOpen(false)}
          onAsk={(text) => {
            send(text)
            setBookOpen(false)
          }}
        />
      )}

      {!isCustomer && messages.length > 0 && (
        <button
          className={bookOpen ? 'farebtn on' : 'farebtn'}
          onClick={() => setBookOpen((v) => !v)}
          aria-expanded={bookOpen}
        >
          <Icon name="route" size={18} />
          <span>Ask to reschedule</span>
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
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [goods, setGoods] = useState('')
  const [goodsOther, setGoodsOther] = useState('')
  const [when, setWhen] = useState('now')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [accompany, setAccompany] = useState(false)
  const [liftBack, setLiftBack] = useState(false)
  const [declared, setDeclared] = useState(false)

  // Where the job is — from the two area pickers below. Distance comes from the
  // built-in area table, so the estimate is instant and never waits on a network
  // lookup (a stalled online route used to leave the Ask button dead).
  const fromLabel = from
  const toLabel = to

  const result = useMemo(() => {
    const distanceKm = from && to && from !== to ? routeDistanceKm(from, to) : null
    if (distanceKm == null) return null
    return { distanceKm, q: quote(listing, { distanceKm, helpers: 0 }) }
  }, [from, to, listing])

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
        <>
          <label className="tripcheck indent">
            <input
              type="checkbox"
              checked={liftBack}
              onChange={(e) => setLiftBack(e.target.checked)}
            />
            <span>I’ll need a lift back</span>
          </label>
          {liftBack && (
            <p className="tripnote indent">
              <Icon name="wallet" size={14} />
              {firstName} may charge extra for the trip back — sort it out together in the chat.
            </p>
          )}
        </>
      )}

      <label className="tripcheck required">
        <input
          type="checkbox"
          checked={declared}
          onChange={(e) => setDeclared(e.target.checked)}
        />
        <span>
          <span className="req" aria-hidden="true">*</span>
          What I’ve described is accurate. {firstName} has the right to know what they’re
          carrying before accepting. <em className="reqnote">(required)</em>
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
            This is only an estimate off {firstName}'s rate — the actual price may be higher
            or lower. Helpers and anything extra aren't included; you agree the final price in
            the chat.
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
function BookingCard({ booking, at, viewAs, onPatch, onPhoto, onClash = null }) {
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
    // A driver cannot be in two places at once, and a double booking surfaces
    // at the worst possible moment - on the morning, to the customer left
    // waiting outside. Checked here rather than warned about later.
    if (isDriver && onClash) {
      const clash = onClash(b)
      if (clash) {
        window.alert(
          `You're already confirmed with ${clash.customerName} at ${clash.time} that day ` +
            `(${clash.pickup} to ${clash.dropoff}).\n\n` +
            `Ask one of them to move, rather than taking both.`,
        )
        return
      }
    }
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
      {/* The decision is at the top, before the detail, because that is what
          the person opening this is here to make. */}
      {pending && (isDriver ? !mineConfirmed : customerCanConfirm) && (
        <div className="bookingcard-quick">
          <button
            className="btn go"
            disabled={isDriver && !b.price}
            onClick={() => {
              if (isDriver && !b.price) return
              if (
                !window.confirm(
                  isDriver
                    ? `Confirm at ${rand(b.price)}? The price is fixed once you do.`
                    : `Accept this pickup at ${rand(b.price)}?`,
                )
              )
                return
              confirmPickup()
            }}
          >
            <Icon name="check" size={17} />
            {isDriver
              ? b.price
                ? `Quick confirm - ${rand(b.price)}`
                : 'Set a price to confirm'
              : `Quick confirm - ${rand(b.price)}`}
          </button>
          <button className="btn ghost" onClick={cancelPickup}>
            Cancel
          </button>
        </div>
      )}

      <div className="bookingcard-rows">
        <Row label="Date" value={b.asap ? 'As soon as possible' : bookingDateLabel(b.date)} />
        {!b.asap && <Row label="Time" value={b.time} />}
        {b.goods && <Row label="Carrying" value={b.goods} />}
        {/* The driver navigates to the pick-up, so that is the one worth
            copying straight into their own maps app. */}
        <Row
          label="From"
          value={b.pickup}
          action={isDriver ? <CopyLocation label={b.pickup} at={b.pickupAt} /> : null}
        />
        <Row
          label="To"
          value={b.dropoff}
          action={isDriver ? <CopyLocation label={b.dropoff} at={b.dropoffAt} /> : null}
        />
        {b.distanceKm ? <Row label="Distance" value={`${b.distanceKm} km`} /> : null}
        {b.accompany && (
          <Row label="Customer" value={b.liftBack ? 'Travelling, needs a lift back' : 'Travelling with the goods'} />
        )}
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

const Row = ({ label, value, action = null }) => (
  <div className="bookingcard-row">
    <span>{label}</span>
    <strong>{value}</strong>
    {action}
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

// The customer's opening message: when, what and where, in one go.
//
// This replaces the old driver-side "Book a pickup" form. The trip belongs to
// the customer, so they are the one who states it; a driver who cannot make it
// asks to reschedule rather than editing someone else's plans.
function TripRequest({ listing, firstName, customerName, onSend }) {
  // The trip is set on Explore, where it prices the whole driver list. Read
  // here, not edited: one place owns it, so the estimate a customer compared
  // against is the same job they end up sending.
  // Read once, not on every render. A fresh object each time would make the
  // distance lookup below re-fire forever once its dependencies are honest.
  // Safe to freeze: this form only shows on an empty chat, and the trip is set
  // over on Explore before anyone gets here.
  const trip = useMemo(() => loadTrip(), [])
  const haveTrip = isTripSet(trip)

  const [goods, setGoods] = useState('')
  const [goodsOther, setGoodsOther] = useState('')
  const [when, setWhen] = useState('now')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [accompany, setAccompany] = useState(false)
  const [liftBack, setLiftBack] = useState(false)
  const [declared, setDeclared] = useState(false)
  const [km, setKm] = useState(null)

  // An address the map could not place: the trip is real, the estimate is not.
  // This was referenced here while only being defined in FareCalculator - a
  // different component - so opening a chat threw a ReferenceError.
  const unlocatable = isTripSet(trip) && (!isLocatable(trip.pickup) || !isLocatable(trip.dropoff))

  useEffect(() => {
    if (!haveTrip) return
    let alive = true
    roadDistanceBetween(trip.pickup, trip.dropoff).then((d) => alive && setKm(d))
    return () => {
      alive = false
    }
  }, [haveTrip, trip.pickup, trip.dropoff])

  const goodsText = goods === 'Something else' ? goodsOther.trim() : goods

  // A lift back is the same journey again, so it is charged again. People
  // assume it is a small extra and it is not - say so where the choice is made.
  const billedKm = km == null ? null : liftBack ? km * 2 : km
  const est = billedKm ? quote(listing, { distanceKm: billedKm, helpers: 0 }) : null
  const oneWayEst = km ? quote(listing, { distanceKm: km, helpers: 0 }) : null

  const ready = haveTrip && goodsText && declared && (when === 'now' || date) && km != null

  const submit = () => {
    if (!ready) return
    onSend({
      id: `bk${Date.now()}`,
      status: 'pending',
      // The customer states the trip; the driver names the price.
      price: 0,
      driverConfirmed: false,
      customerConfirmed: false,
      date: when === 'now' ? new Date().toISOString().slice(0, 10) : date,
      time: when === 'now' ? 'As soon as possible' : time,
      asap: when === 'now',
      pickup: fullAddress(trip.pickup),
      dropoff: fullAddress(trip.dropoff),
      // Coordinates ride along so the driver can paste the pick-up straight
      // into whatever maps app they already use. Copied onto the booking rather
      // than looked up later, so the point stays the one that was agreed - even
      // if the customer edits their trip afterwards.
      pickupAt: trip.pickup.lat != null ? { lat: trip.pickup.lat, lng: trip.pickup.lng } : null,
      dropoffAt: trip.dropoff.lat != null ? { lat: trip.dropoff.lat, lng: trip.dropoff.lng } : null,
      goods: goodsText,
      accompany,
      liftBack,
      distanceKm: billedKm,
      estimate: est?.total ?? 0,
      driverName: listing.ownerName,
      driverPhone: listing.ownerPhone,
      vehicleReg: listing.registration ?? '',
      vehicleName: listing.title,
      customerName,
    })
  }

  if (!haveTrip) {
    return (
      <div className="chat-intro">
        <p>
          Add your pick-up and drop-off on the Explore tab first &mdash; {firstName} needs
          to know where the job is before they can price it.
        </p>
      </div>
    )
  }

  return (
    <div className="triprequest">
      <h2>Tell {firstName} about the trip</h2>
      <p className="blockhint">
        This goes across as your first message. {firstName} needs the when, the what and the
        where before they can say yes or quote you.
      </p>

      {/* The trip is set on Explore, where it prices the whole driver list.
          Here it is just shown back, so nobody retypes it per driver. */}
      <div className="triprequest-route">
        <Icon name="pin" size={16} className="dim" />
        <span>
          <strong>
            {fullAddress(trip.pickup)} &rarr; {fullAddress(trip.dropoff)}
          </strong>
          <em>
            {unlocatable
              ? 'Not found on the map - no estimate, your driver will quote'
              : km == null
                ? 'Measuring the route...'
                : `${km} km`}
          </em>
        </span>
      </div>

      <div className="tripfield">
        <span className="tripfield-label">What are you moving?</span>
        <div className="goodsrow">
          {GOODS.map((g) => (
            <button key={g} className={goods === g ? 'chip on' : 'chip'} onClick={() => setGoods(g)}>
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
            As soon as possible
          </button>
          <button className={when === 'later' ? 'chip on' : 'chip'} onClick={() => setWhen('later')}>
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

      {accompany && (
        <>
          <label className="tripcheck indent">
            <input
              type="checkbox"
              checked={liftBack}
              onChange={(e) => setLiftBack(e.target.checked)}
            />
            <span>I&rsquo;ll need a lift back</span>
          </label>
          {liftBack && (
            <p className="tripwarn indent">
              A lift back is the same journey again, so it costs roughly double
              {oneWayEst && est ? ` - about ${rand(est.total)} instead of ${rand(oneWayEst.total)}` : ''}.
              Only worth it if you are bringing a load back too; otherwise a taxi home is
              usually cheaper.
            </p>
          )}
        </>
      )}

      <label className="tripcheck">
        <input type="checkbox" checked={declared} onChange={(e) => setDeclared(e.target.checked)} />
        <span>
          What I&rsquo;ve described is accurate. {firstName} has the right to know what
          they&rsquo;re carrying before accepting.
        </span>
      </label>

      {est && (
        <div className="triprequest-est">
          <em>Rough guide off {firstName}&rsquo;s rate</em>
          <strong>{rand(est.total)}</strong>
          <span>{firstName} sets the final price</span>
        </div>
      )}

      <button className="btn primary full" disabled={!ready} onClick={submit}>
        <Icon name="send" size={17} />
        Send trip to {firstName}
      </button>

      {!ready && (
        <p className="blockhint">
          {!goodsText
            ? 'Say what you are moving.'
            : when === 'later' && !date
              ? 'Pick a date.'
              : km == null
                ? 'Working out the distance...'
                : 'Tick the box to confirm what you are moving.'}
        </p>
      )}
    </div>
  )
}

// A driver asking for a different time. Deliberately a message rather than an
// edit: the trip is the customer's, so a clash is a request, not a change.
function RescheduleRequest({ firstName, onClose, onAsk }) {
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [why, setWhy] = useState('')

  const ready = date && time

  const send = () => {
    if (!ready) return
    const when = `${bookingDateLabel(date)} at ${time}`
    onAsk(
      `I can't make the time you asked for${why.trim() ? ` - ${why.trim()}` : ''}. ` +
        `Could we do ${when} instead? Let me know and I'll confirm.`,
    )
  }

  return (
    <div className="farecalc">
      <div className="farecalc-head">
        <strong>Ask {firstName} for a different time</strong>
        <button onClick={onClose} aria-label="Close">
          <Icon name="close" size={17} />
        </button>
      </div>

      <p className="blockhint">
        This goes across as a message. {firstName} decides - their pickup stays as it is
        until they agree.
      </p>

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

      <input
        className="tripinput"
        value={why}
        onChange={(e) => setWhy(e.target.value)}
        placeholder="Reason, optional - e.g. already booked that morning"
      />

      <button className="btn primary full" disabled={!ready} onClick={send}>
        <Icon name="send" size={17} />
        Send request
      </button>
    </div>
  )
}
