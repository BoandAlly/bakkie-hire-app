import { normaliseEmail } from './session.js'

// Customer accounts, keyed by email — the same shape as a driver account, minus
// the paperwork. A customer can browse the whole app signed out; an account is
// only needed to message a driver, see their conversations, or open a profile.
//
// Like the driver store this is a local, plain-text stand-in for real auth and
// must move behind a backend before real users.

const KEY = 'bakkie.customers.v1'

// A ready-made customer, mirror of the demo driver, so the client side can also
// be used (messaging drivers) without signing up. Signed in with one tap; the
// session persists until they sign out.
export const DEMO_CUSTOMER_EMAIL = 'me@bakkie.co'

const SEED_CUSTOMERS = {
  [DEMO_CUSTOMER_EMAIL]: {
    name: 'Thandi (demo)',
    email: DEMO_CUSTOMER_EMAIL,
    password: 'demo',
    joined: '2025-11',
  },
}

export function loadCustomers() {
  try {
    const raw = localStorage.getItem(KEY)
    const stored = raw ? JSON.parse(raw) : {}
    return { ...SEED_CUSTOMERS, ...stored }
  } catch {
    return { ...SEED_CUSTOMERS }
  }
}

export function saveCustomers(customers) {
  try {
    localStorage.setItem(KEY, JSON.stringify(customers))
  } catch {
    /* private window — account won't persist */
  }
}

export const blankCustomer = ({ name, email, password }) => ({
  name: (name ?? '').trim(),
  email: normaliseEmail(email),
  password,
  joined: new Date().toISOString().slice(0, 7),
})

export const customerFor = (customers, email) => customers[normaliseEmail(email)] ?? null
