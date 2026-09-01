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
    if (current.display === 'granted') return true
    const asked = await LocalNotifications.requestPermissions()
    return asked.display === 'granted'
  } catch {
    return false
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
