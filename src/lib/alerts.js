// Working out what just happened that the person would want to know about.
//
// Kept apart from both the notification plumbing and the screens, because the
// interesting question is not "how do I show a notification" but "is this
// actually news, and news for whom".
//
// Three rules run through all of it:
//
//   Only the other person's doing. Your own message is not news to you.
//   Only what changed. A trip that was confirmed an hour ago is not news now.
//   Never on first load. Opening the app would otherwise fire a notification
//   for every message you have ever received.

import { lastMessage } from './threads.js'

/** Every message across the threads this person can see, tagged with context. */
function walk(threads, listingIds) {
  const out = []
  for (const t of threads) {
    if (listingIds && !listingIds.has(t.listingId)) continue
    for (const m of t.messages) out.push({ m, thread: t })
  }
  return out
}

/**
 * A stable key for one notifiable event. Derived from content, so the same
 * event seen again - a sync re-reading the same row - is recognised rather
 * than notified twice.
 */
const keyOf = (m, extra = '') => `${m.at}|${m.from}|${extra}`

/**
 * What is worth telling this person about, given what they were shown last
 * time. Returns [{ key, title, body }].
 *
 * `seen` is a Set of keys already notified; pass null on the very first read to
 * record everything without notifying.
 */
export function newAlerts({ threads, listingIds, role, seen }) {
  const isDriver = role === 'driver'
  const mine = isDriver ? 'owner' : 'customer'
  const alerts = []

  for (const { m, thread } of walk(threads, listingIds)) {
    // Your own doing is never news to you.
    if (m.from === mine) continue

    const who = isDriver ? thread.customerName ?? 'A customer' : m.booking?.driverName ?? 'Your driver'
    const first = who.split(' ')[0]

    if (m.kind === 'booking' && m.booking) {
      const b = m.booking

      // A trip arriving is the driver's most important notification: it is
      // work, and someone is waiting on an answer.
      if (isDriver) {
        alerts.push({
          key: keyOf(m, 'request'),
          title: `New trip from ${first}`,
          body: `${b.goods ? `${b.goods} — ` : ''}${b.pickup} → ${b.dropoff}`,
        })
      }

      // Status is on the booking rather than in a message, so it is keyed on
      // the status itself: confirming, then cancelling, are two events.
      if (b.status === 'confirmed') {
        alerts.push({
          key: keyOf(m, `confirmed:${b.price ?? 0}`),
          title: isDriver ? `${first} accepted` : `${first} confirmed your pickup`,
          body: b.price
            ? `${b.pickup} → ${b.dropoff} at R${b.price}`
            : `${b.pickup} → ${b.dropoff}`,
        })
      }

      if (b.status === 'cancelled') {
        alerts.push({
          key: keyOf(m, 'cancelled'),
          title: `${first} cancelled the pickup`,
          body: `${b.pickup} → ${b.dropoff}`,
        })
      }

      // Asking to move a time un-confirms the booking, so it needs saying
      // plainly - the customer has to agree again for it to be back on.
      if (b.rescheduleAsked && b.status === 'pending') {
        alerts.push({
          key: keyOf(m, 'reschedule'),
          title: `${first} asked to reschedule`,
          body: 'Your pickup is no longer confirmed — check the new time and confirm again.',
        })
      }
      continue
    }

    if (m.kind === 'photo') {
      alerts.push({
        key: keyOf(m, 'photo'),
        title: `${first} sent a photo`,
        body: m.text ?? 'Delivery photo',
      })
      continue
    }

    alerts.push({
      key: keyOf(m, 'msg'),
      title: first,
      body: (m.text ?? '').slice(0, 140),
    })
  }

  // First read: learn what exists, tell them nothing. Otherwise opening the app
  // would fire one notification per message ever received.
  if (seen === null) return { alerts: [], keys: new Set(alerts.map((a) => a.key)) }

  const fresh = alerts.filter((a) => !seen.has(a.key))
  return { alerts: fresh, keys: new Set(alerts.map((a) => a.key)) }
}

/** Threads where the other person spoke last — the unread count. */
export const waitingOnMe = (threads, mine) =>
  threads.filter((t) => {
    const last = lastMessage(t)
    return last && last.from !== mine
  }).length
