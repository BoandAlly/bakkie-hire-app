// Driver leave-time reminders, built on Capacitor's local notifications so they
// fire even when the app is closed on the phone. On the web (the dev preview)
// the same plugin falls back to the browser's Notification API and fires while
// the tab is open — enough to test the flow.
//
// Three reminders per confirmed pickup, timed off when the driver needs to
// LEAVE (pickup time minus travel time): 30 min before, 5 min before, and at
// leave-time itself.

import { LocalNotifications } from '@capacitor/local-notifications'
import { placeByName, routeDistanceKm } from '../data/places.js'
import { roadKm } from './geo.js'
import { bookingDateTime, travelMinutes, bookingDateLabel } from './threads.js'

// minutes-before-leave for each of the three nudges
const SLOTS = [30, 5, 0]

// ---------------------------------------------------------------------------
// How a notification looks, and where it lands
// ---------------------------------------------------------------------------
//
// The status-bar icon is a silhouette Android fills in itself, so it has to be
// a white-on-transparent shape - see android/.../drawable/ic_stat_bakkie.xml.
// It is named in capacitor.config.json; with nothing named there Capacitor
// falls back to a generic exclamation mark, which is what people were seeing.
//
// The large icon keeps its colours and is the app's actual logo, so an expanded
// notification is recognisably this app rather than an anonymous grey line.
const LARGE_ICON = 'ic_notify_large'

// Channels are Android's own grouping. Worth having for one specific reason
// beyond tidiness: the trip-in-progress line updates as the bakkie moves, and
// on a default channel every update makes a noise. LOW is silent - it appears
// in the shade and stays there, which is exactly what that one is for.
const CHANNELS = [
  { id: 'bakkie-trips', name: 'Trips and bookings', importance: 5,
    description: 'New trips, confirmations, cancellations and time changes.' },
  { id: 'bakkie-messages', name: 'Messages', importance: 4,
    description: 'Messages and photos from the other person.' },
  { id: 'bakkie-live', name: 'Trip in progress', importance: 2,
    description: 'The quiet line that tracks a trip while it is running.' },
]

// Created once per app run. Android ignores a channel it already has, so this
// is safe to call repeatedly - but a notification sent to a channel that does
// not exist yet is dropped silently, so it has to happen before the first one.
let channelsReady = null
function ensureChannels() {
  channelsReady ??= (async () => {
    try {
      for (const c of CHANNELS) await LocalNotifications.createChannel({ ...c, vibration: c.importance > 2 })
    } catch {
      // Web, or a platform without channels - notifications still work.
    }
  })()
  return channelsReady
}

// A stable positive 31-bit notification id from the booking id + slot, so the
// same reminder can be cancelled later without tracking ids ourselves.
function notifId(bookingId, slot) {
  const s = `${bookingId}:${slot}`
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  return (Math.abs(h) % 2147483000) + 1
}

/** Distance (km) from where the driver is to the pickup suburb. */
function kmToPickup(origin, pickupName) {
  const pickup = placeByName(pickupName)
  if (!pickup) return 0
  if (origin?.coords) return roadKm(origin.coords, pickup) // live GPS
  if (origin?.name) return routeDistanceKm(origin.name, pickupName) ?? 0 // base suburb
  return 0
}

function hhmm(date) {
  return date.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })
}

/** Ask for notification permission once; returns true if we may post. */
export async function ensurePermission() {
  try {
    const current = await LocalNotifications.checkPermissions()
    if (current.display !== 'granted') {
      const asked = await LocalNotifications.requestPermissions()
      if (asked.display !== 'granted') return false
    }
    await ensureChannels()
    return true
  } catch {
    return false
  }
}

/**
 * Tell the app which conversation a notification belongs to, so tapping it can
 * open that chat instead of dumping the person on whatever screen they left.
 * Returns a function that stops listening.
 */
export function onNotificationTap(handler) {
  let remove = null
  let dead = false
  LocalNotifications.addListener('localNotificationActionPerformed', (e) => {
    const extra = e?.notification?.extra
    if (extra?.listingId) handler(extra)
  })
    .then((h) => {
      if (dead) h.remove()
      else remove = () => h.remove()
    })
    .catch(() => {
      // No plugin on this platform - tapping simply opens the app as before.
    })
  return () => {
    dead = true
    remove?.()
  }
}

/**
 * Schedule the three leave-time reminders for one confirmed booking.
 * `origin` is { coords } (live GPS) or { name } (the driver's base suburb).
 * Past slots are skipped, so booking something imminent just fires fewer.
 */
export async function scheduleBookingReminders(booking, origin) {
  const pickupAt = bookingDateTime(booking)
  if (!pickupAt) return
  if (!(await ensurePermission())) return

  const km = kmToPickup(origin, booking.pickup)
  const leaveAt = pickupAt.getTime() - travelMinutes(km) * 60000
  const now = Date.now()
  const leaveLabel = hhmm(new Date(leaveAt))
  const dayLabel = bookingDateLabel(booking.date)

  const notifications = []
  for (const slot of SLOTS) {
    const at = leaveAt - slot * 60000
    if (at <= now + 1000) continue // already passed — nothing to schedule
    notifications.push({
      id: notifId(booking.id, slot),
      title:
        slot === 30
          ? 'Leave in 30 minutes'
          : slot === 5
            ? 'Leave in 5 minutes'
            : 'Time to leave',
      body:
        slot === 0
          ? `Leave now for ${booking.pickup} to reach your ${booking.time} pickup.`
          : `${dayLabel} pickup in ${booking.pickup} — leave around ${leaveLabel} (in ${slot} min).`,
      largeIcon: LARGE_ICON,
      channelId: 'bakkie-trips',
      extra: { listingId: booking.listingId ?? null, customerEmail: booking.customerEmail ?? null },
      schedule: { at: new Date(at) },
    })
  }

  if (!notifications.length) return
  try {
    await LocalNotifications.schedule({ notifications })
  } catch {
    // Plugin missing/blocked (e.g. some browsers) — reminders just won't fire.
  }
}

/** Cancel any reminders previously scheduled for this booking. */
export async function cancelBookingReminders(bookingId) {
  try {
    await LocalNotifications.cancel({
      notifications: SLOTS.map((slot) => ({ id: notifId(bookingId, slot) })),
    })
  } catch {
    /* nothing scheduled, or plugin unavailable */
  }
}

// ---------------------------------------------------------------------------
// Things that just happened
// ---------------------------------------------------------------------------
//
// The reminders above are scheduled for a time in the future. These fire now,
// when the other person does something you would want to know about while the
// app is in your pocket: a trip comes in, a price is agreed, a pickup is called
// off, a message arrives.
//
// Ids are derived from what happened rather than counted up, so the same event
// arriving twice - a sync pulling the same row again - replaces its own
// notification instead of stacking a second one.

/** A stable positive 31-bit id from any string. */
function idFrom(key) {
  let h = 0
  for (let i = 0; i < key.length; i++) h = (Math.imul(31, h) + key.charCodeAt(i)) | 0
  return (Math.abs(h) % 2147483000) + 1
}

/**
 * Show a notification now. Silently does nothing when permission was refused
 * or the plugin is unavailable - a missed notification must never break the
 * thing that triggered it.
 */
export async function notifyNow(key, title, body, { extra = null, kind = 'trips' } = {}) {
  try {
    if (!(await ensurePermission())) return
    await LocalNotifications.schedule({
      notifications: [
        {
          id: idFrom(key),
          title,
          body,
          largeIcon: LARGE_ICON,
          channelId: kind === 'messages' ? 'bakkie-messages' : 'bakkie-trips',
          // Which conversation this is about, so a tap lands in that chat.
          extra,
          // A second or two out, because scheduling in the past is rejected by
          // some Android versions.
          schedule: { at: new Date(Date.now() + 1200) },
        },
      ],
    })
  } catch {
    /* no notifications on this device - the app carries on regardless */
  }
}

// ---------------------------------------------------------------------------
// Asking for permission, at a moment that makes sense
// ---------------------------------------------------------------------------
//
// Android 13 and up needs explicit permission before anything can be shown, and
// asking on first launch - before the app has done anything for you - is how
// people learn to tap "deny" on reflex.
//
// So it is asked at the point the answer obviously matters:
//   drivers  when they sign in, because work arrives whether the app is open
//            or not and a missed trip is money
//   customers when they send their first trip, because that is when a reply is
//            coming back
//
// Asked once. A refusal is respected rather than re-prompted every session:
// everything else degrades quietly without notifications.

const ASKED_KEY = 'bakkie.notifyAsked.v1'

export async function askForNotificationsOnce(who) {
  try {
    if (localStorage.getItem(ASKED_KEY)) return
    localStorage.setItem(ASKED_KEY, who)
  } catch {
    // Private window - it will ask again next time, which is harmless.
  }
  await ensurePermission()
}

// ---------------------------------------------------------------------------
// The one that stays put
// ---------------------------------------------------------------------------
//
// A trip under way gets a single notification that sits in the shade and
// rewrites itself as the driver moves, the way a ride-hailing app does. Same id
// every time, so an update replaces the line rather than stacking another one.
//
// `ongoing` asks Android not to let it be swiped away, and autoCancel is off so
// tapping it does not dismiss it - it should live exactly as long as the trip.

const LIVE_TRIP_ID = 424242

export async function showLiveTrip(title, body, extra = null) {
  try {
    if (!(await ensurePermission())) return
    await LocalNotifications.schedule({
      notifications: [
        {
          id: LIVE_TRIP_ID,
          title,
          body,
          largeIcon: LARGE_ICON,
          // The quiet channel: this line rewrites itself every time the bakkie
          // moves far enough to change the wording, and on a normal channel
          // each of those rewrites would buzz the phone.
          channelId: 'bakkie-live',
          extra,
          ongoing: true,
          autoCancel: false,
          schedule: { at: new Date(Date.now() + 400) },
        },
      ],
    })
  } catch {
    /* no notifications here - the on-screen map still shows everything */
  }
}

export async function clearLiveTrip() {
  try {
    await LocalNotifications.cancel({ notifications: [{ id: LIVE_TRIP_ID }] })
  } catch {
    /* nothing showing */
  }
}
