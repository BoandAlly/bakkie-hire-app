import { normalisePhone, normaliseEmail } from './session.js'

// Driver profiles, keyed by email address (their login).
//
// The email + password is how they sign in; the phone number is a contact
// detail that rides along on the profile, because it's what a customer rings.
//
// Identity and verification belong to the person, not to each vehicle — a guy
// with three bakkies proves who he is once, not three times. Vehicle
// registration is the exception; it's per-vehicle, but we keep it here too
// because in practice one operator submits one bundle of paperwork.

const KEY = 'bakkie.drivers.v1'

export const DOCS = [
  { id: 'idDoc', label: 'ID document', hint: 'Green book, smart card or passport.' },
  { id: 'licence', label: "Driver's licence", hint: 'Valid, and the right code for the vehicle.' },
  { id: 'reg', label: 'Vehicle registration', hint: 'The papers for the vehicle you listed.' },
]

export function loadDrivers() {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export function saveDrivers(drivers) {
  try {
    localStorage.setItem(KEY, JSON.stringify(drivers))
  } catch {
    /* private window — profile won't persist */
  }
}

export const blankDriver = ({ name, email, phone, password }) => ({
  name: (name ?? '').trim(),
  email: normaliseEmail(email),
  phone: normalisePhone(phone),
  password,
  docs: { idDoc: false, licence: false, reg: false },
  verified: false,
  joined: new Date().toISOString().slice(0, 7),
})

export const driverFor = (drivers, email) => drivers[normaliseEmail(email)] ?? null

export const docsSubmitted = (driver) => DOCS.filter((d) => driver?.docs?.[d.id]).length

export function verificationState(driver) {
  if (!driver) return 'none'
  if (driver.verified) return 'verified'
  return docsSubmitted(driver) === DOCS.length ? 'pending' : 'incomplete'
}
