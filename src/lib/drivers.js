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

// A ready-made driver so the app can be opened and used without signing up first.
// Its phone matches the seeded Toyota Hilux (l1), so it already owns a vehicle.
// One tap on "Use the demo account" signs in as this; the session then persists
// until the driver manually signs out.
export const DEMO_DRIVER_EMAIL = 'demo@bakkie.co'

const SEED_DRIVERS = {
  [DEMO_DRIVER_EMAIL]: {
    name: 'Sipho Ndlovu',
    email: DEMO_DRIVER_EMAIL,
    phone: '082 445 1190',
    password: 'demo',
    docs: { idDoc: true, licence: true, reg: true },
    verified: true,
    joined: '2025-11',
  },
}

export function loadDrivers() {
  try {
    const raw = localStorage.getItem(KEY)
    const stored = raw ? JSON.parse(raw) : {}
    // The demo account is always present; a real account with the same email wins.
    return { ...SEED_DRIVERS, ...stored }
  } catch {
    return { ...SEED_DRIVERS }
  }
}

export function saveDrivers(drivers) {
  try {
    localStorage.setItem(KEY, JSON.stringify(drivers))
  } catch {
    /* private window — profile won't persist */
  }
}

// Mon-Sat 07:00-17:00 is the ordinary working week for this trade, so a driver
// who never touches these settings still reads as available at sensible hours.
// `availableNow` is the separate "I'm sitting here waiting for work right now"
// switch, and starts off — it should be a deliberate act, not a default.
export const DEFAULT_HOURS = { days: [1, 2, 3, 4, 5, 6], from: '07:00', to: '17:00' }

export const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export const blankDriver = ({ name, email, phone, password }) => ({
  name: (name ?? '').trim(),
  email: normaliseEmail(email),
  phone: normalisePhone(phone),
  password,
  docs: { idDoc: false, licence: false, reg: false },
  verified: false,
  availableNow: false,
  hours: { ...DEFAULT_HOURS },
  joined: new Date().toISOString().slice(0, 7),
})

/** Hours for a driver, filled in for accounts made before the setting existed. */
export const hoursFor = (driver) => ({ ...DEFAULT_HOURS, ...(driver?.hours ?? {}) })

/** Is this driver inside their own working hours right now? */
export function withinWorkingHours(driver, at = new Date()) {
  const h = hoursFor(driver)
  if (!h.days.includes(at.getDay())) return false
  const mins = at.getHours() * 60 + at.getMinutes()
  const [fh, fm] = h.from.split(':').map(Number)
  const [th, tm] = h.to.split(':').map(Number)
  return mins >= fh * 60 + fm && mins <= th * 60 + tm
}

export const driverFor = (drivers, email) => drivers[normaliseEmail(email)] ?? null

export const docsSubmitted = (driver) => DOCS.filter((d) => driver?.docs?.[d.id]).length

export function verificationState(driver) {
  if (!driver) return 'none'
  if (driver.verified) return 'verified'
  return docsSubmitted(driver) === DOCS.length ? 'pending' : 'incomplete'
}
