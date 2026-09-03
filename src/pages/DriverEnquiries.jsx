import { VehicleSilhouette } from '../data/vehicleClasses.jsx'
import {
  lastMessage,
  timeLabel,
  bookingSummary,
  bookingDateLabel,
  upcomingTrips,
} from '../lib/threads.js'
import { rand } from '../lib/pricing.js'
import Icon from '../components/Icon.jsx'

// The driver's first screen. Enquiries are the only thing here that earns them
// money today, so nothing else competes for the top of the page.

export default function DriverEnquiries({ driver, listings, threads, onOpenChat }) {
  const myIds = new Set(listings.map((l) => l.id))
  const myThreads = threads
    .filter((t) => myIds.has(t.listingId))
    .sort((a, b) => {
      const at = lastMessage(a)?.at ?? a.createdAt
      const bt = lastMessage(b)?.at ?? b.createdAt
      return bt.localeCompare(at)
    })

  const awaiting = myThreads.filter((t) => lastMessage(t)?.from === 'customer').length
  const views = listings.reduce((n, l) => n + (l.views ?? 0), 0)

  // "Live" counts work, not adverts. A driver looking at this wants to know
  // what they have on, and the next one first.
  const trips = upcomingTrips(threads, myIds)

  return (
    <div className="screen">
      <header className="screen-head">
        <h1>Hello, {driver.name.split(' ')[0]}</h1>
        <p className="sub">
          {awaiting > 0
            ? `${awaiting} ${awaiting === 1 ? 'person is' : 'people are'} waiting on you`
            : 'Nobody waiting right now'}
        </p>
      </header>

      <div className="statrow">
        <StatTile icon="message" value={awaiting} label="To reply" accent={awaiting > 0} />
        <StatTile icon="eye" value={views} label="Views" />
        <StatTile icon="truck" value={trips.length} label="Live" accent={trips.length > 0} />
      </div>

      {/* The next job, and what follows it. Pulled off the customers' own trip
          messages, so it is always what was actually agreed rather than a
          separate copy that can drift. */}
      {trips.length > 0 && (
        <section className="panel">
          <h2>Coming up</h2>
          <div className="list tight">
            {trips.map(({ booking: b, thread: t }, i) => (
              <button
                key={b.id}
                className="triprow"
                onClick={() => onOpenChat(t.listingId, t.customerEmail)}
              >
                <span className={i === 0 ? 'triprow-when next' : 'triprow-when'}>
                  {b.asap ? 'ASAP' : bookingDateLabel(b.date)}
                  <em>{b.asap ? 'waiting' : b.time}</em>
                </span>
                <span className="triprow-body">
                  <strong>
                    {b.pickup} &rarr; {b.dropoff}
                  </strong>
                  <em>
                    {b.customerName}
                    {b.goods ? ` · ${b.goods}` : ''}
                    {b.price ? ` · ${rand(b.price)}` : ''}
                  </em>
                </span>
                <span className={b.status === 'confirmed' ? 'triprow-tag on' : 'triprow-tag'}>
                  {b.status === 'confirmed' ? 'Confirmed' : 'Not confirmed'}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {myThreads.length === 0 ? (
        <div className="blank">
          <Icon name="inbox" size={30} />
          <strong>No enquiries yet</strong>
          <p>
            When someone finds your vehicle they message you here. Replying quickly is the
            single biggest thing that wins you the job.
          </p>
        </div>
      ) : (
        <div className="list">
          {myThreads.map((t) => {
            const listing = listings.find((l) => l.id === t.listingId)
            const last = lastMessage(t)
            const waiting = last?.from === 'customer'
            return (
              <button
                key={t.id}
                className={waiting ? 'row unread' : 'row'}
                onClick={() => onOpenChat(t.listingId, t.customerEmail)}
              >
                <span className="avatar">
                  {listing?.photos?.[0] ? (
                    <img src={listing.photos[0]} alt="" />
                  ) : (
                    <VehicleSilhouette classId={listing?.vehicleClass} />
                  )}
                </span>
                <span className="row-body">
                  <span className="row-top">
                    <strong>{t.customerName}</strong>
                    {last && <em className="when">{timeLabel(last.at)}</em>}
                  </span>
                  <span className="preview">
                    {last
                      ? last.kind === 'booking' && last.booking
                        ? bookingSummary(last.booking)
                        : last.text
                      : 'No messages yet'}
                  </span>
                  <span className="row-sub">{listing?.title}</span>
                </span>
                {waiting && <span className="unread-dot" aria-label="Needs a reply" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

const StatTile = ({ icon, value, label, accent }) => (
  <div className={accent ? 'stattile accent' : 'stattile'}>
    <Icon name={icon} size={19} />
    <strong>{value}</strong>
    <span>{label}</span>
  </div>
)
