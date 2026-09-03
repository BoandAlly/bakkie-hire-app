// Conversations between a customer and a vehicle owner. This is where the whole
// job gets arranged — date, time, what's being moved, final price. The app
// deliberately doesn't model any of that; it just carries the messages.

const KEY = 'bakkie.threads.v1'

export function loadThreads() {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveThreads(threads) {
  try {
    localStorage.setItem(KEY, JSON.stringify(threads))
  } catch {
    // Private window or quota — messages just won't survive a reload.
  }
}

// Match a listing's thread. Pass a customerEmail to get that customer's own
// conversation; omit it (owner side) to get the listing's thread regardless of
// which customer it belongs to.
export const threadFor = (threads, listingId, customerEmail) =>
  threads.find(
    (t) =>
      t.listingId === listingId &&
      (customerEmail == null || t.customerEmail === customerEmail),
  )

export function startThread(listingId, customerName = 'You', customerEmail = null) {
  return {
    id: `t${Date.now()}`,
    listingId,
    customerName,
    customerEmail,
    messages: [],
    createdAt: new Date().toISOString(),
  }
}

// `extra` carries anything beyond a plain line — e.g. a booking payload
// ({ kind: 'booking', booking: {...} }). The `text` is still set to a readable
// summary so inbox previews and screen readers get something sensible.
export const newMessage = (from, text, extra = null) => ({
  from, // 'customer' | 'owner'
  text,
  at: new Date().toISOString(),
  ...(extra || {}),
})

/** yyyy-mm-dd -> "Fri, 5 Sep", parsed as a local date so it can't slip a day. */
export function bookingDateLabel(dateStr) {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-').map(Number)
  if (!y || !m || !d) return dateStr
  return new Date(y, m - 1, d).toLocaleDateString('en-ZA', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

/** One-liner for inbox previews and the message's text fallback. */
export const bookingSummary = (b) => {
  const when = `${bookingDateLabel(b.date)}${b.time ? ` at ${b.time}` : ''}, ${b.pickup} → ${b.dropoff}`
  const lead =
    b.status === 'cancelled'
      ? 'Pickup cancelled'
      : b.status === 'confirmed'
        ? 'Pickup confirmed'
        : b.status === 'done'
          ? 'Trip complete'
          : 'Pickup requested'
  return `${lead} — ${when}`
}

/** Booking date + time as a real local Date (or null if either is missing). */
export function bookingDateTime(b) {
  if (!b?.date || !b?.time) return null
  const [y, m, d] = b.date.split('-').map(Number)
  const [hh, mm] = b.time.split(':').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d, hh || 0, mm || 0, 0, 0)
}

/** Is the pickup still in the future? Cancelling is only allowed until then. */
export function isUpcoming(b) {
  const dt = bookingDateTime(b)
  return dt ? dt.getTime() > Date.now() : false
}

/**
 * Rough driving time for a distance, in minutes. Assumes a ~35 km/h town
 * average and pads a couple of minutes for getting going. A stand-in until a
 * real routing/traffic API replaces the suburb distance table.
 */
export function travelMinutes(km) {
  if (!km || km <= 0) return 5
  return Math.max(5, Math.round((km / 35) * 60) + 3)
}

export const lastMessage = (thread) => thread.messages[thread.messages.length - 1]

export function unreadCountFor(threads, listingIds) {
  return threads.filter(
    (t) => listingIds.has(t.listingId) && lastMessage(t)?.from === 'customer',
  ).length
}

/** "14:32" — messages only ever need the time of day. */
export function timeLabel(iso) {
  try {
    return new Date(iso).toLocaleTimeString('en-ZA', {
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

/** Threads where the owner spoke last — i.e. the customer has a reply waiting. */
export const repliesWaiting = (threads) =>
  threads.filter((t) => lastMessage(t)?.from === 'owner').length

// ---- Ratings ----------------------------------------------------------------
// Ratings live on the booking they belong to. A driver rates the customer
// (`custRating`); the customer rates the driver (`driverRating`). Nothing rates
// until the driver marks the job done.

/** Walk every booking in these threads, applying `pick` to each one. */
function collectBookings(threads, listingIds, pick) {
  const out = []
  for (const t of threads) {
    if (listingIds && !listingIds.has(t.listingId)) continue
    for (const m of t.messages) {
      if (m.kind === 'booking' && m.booking) {
        const got = pick(m.booking, t, m)
        if (got) out.push(got)
      }
    }
  }
  return out
}

/** Ratings a driver has received from customers, newest first. */
export function driverRatingsReceived(threads, listingIds) {
  return collectBookings(threads, listingIds, (b, t, m) =>
    b.driverRating
      ? { name: b.customerName || t.customerName, rating: b.driverRating, at: m.at }
      : null,
  ).sort((a, b) => (a.at < b.at ? 1 : -1))
}

/** Bookings a customer still has to rate (job done, no rating from them yet). */
export const bookingsAwaitingCustomerRating = (thread) =>
  (thread?.messages ?? []).some(
    (m) => m.kind === 'booking' && m.booking?.status === 'done' && !m.booking.driverRating,
  )

/**
 * Real customer ratings, grouped by the listing they were given to:
 * `{ [listingId]: { average, count } }`.
 *
 * Only listings with at least one real rating appear. A listing that's missing
 * from the result has never been rated, and the card falls back to its seeded
 * star — labelled as unrated, so nobody reads it as earned.
 */
export function ratingsByListing(threads) {
  const collected = {}
  for (const t of threads) {
    for (const m of t.messages) {
      if (m.kind !== 'booking' || !m.booking?.driverRating) continue
      ;(collected[t.listingId] ??= []).push(m.booking.driverRating)
    }
  }
  return Object.fromEntries(
    Object.entries(collected).map(([id, list]) => [
      id,
      { average: averageRating(list), count: list.length },
    ]),
  )
}

/** One-decimal mean, or 0 for an empty list. */
export const averageRating = (nums) =>
  nums.length ? Math.round((nums.reduce((s, n) => s + n, 0) / nums.length) * 10) / 10 : 0
