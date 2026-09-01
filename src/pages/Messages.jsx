import { classById, VehicleSilhouette } from '../data/vehicleClasses.jsx'
import {
  lastMessage,
  timeLabel,
  bookingsAwaitingCustomerRating,
  bookingSummary,
} from '../lib/threads.js'
import Icon from '../components/Icon.jsx'

// The customer's inbox. Without it the only way back into a conversation is
// finding the same vehicle again, which nobody manages twice.

export default function Messages({ listings, threads, onOpen, onFind }) {
  const rows = threads
    .map((t) => ({ thread: t, listing: listings.find((l) => l.id === t.listingId) }))
    .filter((r) => r.listing)
    .sort((a, b) => {
      const at = lastMessage(a.thread)?.at ?? a.thread.createdAt
      const bt = lastMessage(b.thread)?.at ?? b.thread.createdAt
      return bt.localeCompare(at)
    })

  return (
    <div className="screen">
      <header className="screen-head">
        <h1>Messages</h1>
        <p className="sub">Conversations with vehicle owners.</p>
      </header>

      {rows.length === 0 ? (
        <div className="blank">
          <Icon name="message" size={30} />
          <strong>No conversations yet</strong>
          <p>Find a vehicle you like and message the owner to get started.</p>
          <button className="btn primary" onClick={onFind}>
            <Icon name="compass" size={19} />
            Find a vehicle
          </button>
        </div>
      ) : (
        <div className="list">
          {rows.map(({ thread, listing }) => {
            const last = lastMessage(thread)
            const replied = last?.from === 'owner'
            const needsRating = bookingsAwaitingCustomerRating(thread)
            return (
              <button
                key={thread.id}
                className={replied || needsRating ? 'row unread' : 'row'}
                onClick={() => onOpen(listing.id)}
              >
                <span className="avatar">
                  {listing.photos?.[0] ? (
                    <img src={listing.photos[0]} alt="" />
                  ) : (
                    <VehicleSilhouette classId={listing.vehicleClass} />
                  )}
                </span>
                <span className="row-body">
                  <span className="row-top">
                    <strong>{listing.ownerName}</strong>
                    {last && <em className="when">{timeLabel(last.at)}</em>}
                  </span>
                  {needsRating && (
                    <span className="row-flag">
                      <Icon name="check" size={13} />
                      Trip done — rate your driver
                    </span>
                  )}
                  <span className="preview">
                    {last
                      ? `${last.from === 'owner' ? '' : 'You: '}${
                          last.kind === 'booking' && last.booking
                            ? bookingSummary(last.booking)
                            : last.text
                        }`
                      : 'No messages yet'}
                  </span>
                  <span className="row-sub">
                    {classById(listing.vehicleClass)?.name} · {listing.title}
                  </span>
                </span>
                {(replied || needsRating) && (
                  <span className="unread-dot" aria-label={needsRating ? 'Rate your trip' : 'New reply'} />
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
