// Who is using the app right now.
//
// Asymmetric by design: a driver signs in and is remembered, a customer never
// does. Anything that raises friction on the customer side costs you demand,
// and there is nothing about browsing vehicles that needs an account.
//
// A driver's account is their email + password; their mobile number is a
// separate contact detail, because that's the thing a customer actually rings.
//
// NOTE: this is a local stand-in for real auth. The password lives in
// localStorage in plain text — fine for a prototype, but the whole store must
// move behind a real backend (hashed passwords, sessions) before anyone else
// touches it.

const KEY = 'bakkie.session.v1'

export function loadSession() {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : { role: null, driverEmail: null, customerEmail: null }
  } catch {
    return { role: null, driverEmail: null, customerEmail: null }
  }
}

export function saveSession(session) {
  try {
    localStorage.setItem(KEY, JSON.stringify(session))
  } catch {
    /* private window — the role just won't be remembered */
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* nothing to do */
  }
}

/** One canonical form for an email so "A@x.com " and "a@x.com" are one account. */
export const normaliseEmail = (raw) => (raw ?? '').trim().toLowerCase()

/** Roughly-an-email check — enough to catch typos, not a spec-perfect regex. */
export const looksLikeEmail = (raw) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normaliseEmail(raw))

/** Phone numbers get typed with spaces, dashes and +27 more or less at random. */
export const normalisePhone = (raw) => {
  const digits = (raw ?? '').replace(/\D/g, '')
  if (digits.startsWith('27') && digits.length === 11) return '0' + digits.slice(2)
  return digits
}

export const samePhone = (a, b) => normalisePhone(a) === normalisePhone(b)

/** Every listing belonging to whoever is signed in. */
export const listingsForPhone = (listings, phone) =>
  listings.filter((l) => samePhone(l.ownerPhone, phone))

/** Back to how a South African would actually write it: 082 445 1190. */
export function formatPhone(raw) {
  const d = normalisePhone(raw)
  if (d.length !== 10) return raw
  return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`
}
