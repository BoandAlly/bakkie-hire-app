import { VehicleSilhouette } from '../data/vehicleClasses.jsx'
import { lastMessage, timeLabel, bookingSummary } from '../lib/threads.js'
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
  const live = listings.filter((l) => !l.paused).length

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
        <StatTile icon="truck" value={live} label="Live" />
      </div>

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
                onClick={() => onOpenChat(t.listingId)}
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
