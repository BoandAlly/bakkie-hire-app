import { useEffect, useMemo, useRef, useState } from 'react'
import { SEED_LISTINGS } from './data/listings.js'
import { loadListings, saveListings, resetAll } from './lib/storage.js'
import {
  loadThreads,
  saveThreads,
  threadFor,
  startThread,
  newMessage,
  repliesWaiting,
  lastMessage,
  isUpcoming,
} from './lib/threads.js'
import { scheduleBookingReminders, cancelBookingReminders } from './lib/notify.js'
import {
  loadSession,
  saveSession,
  clearSession,
  normaliseEmail,
  samePhone,
  listingsForPhone,
} from './lib/session.js'
import { loadDrivers, saveDrivers, driverFor, blankDriver, DEMO_DRIVER_EMAIL } from './lib/drivers.js'
import {
  loadCustomers,
  saveCustomers,
  customerFor,
  blankCustomer,
  DEMO_CUSTOMER_EMAIL,
} from './lib/customers.js'
import { useLocation } from './lib/geo.js'
import {
  syncEnabled,
  pullAll,
  subscribe,
  mergeThreads,
  pushListings,
  pushThreads,
  pushDrivers,
  pushCustomers,
} from './lib/sync.js'
import BottomNav from './components/BottomNav.jsx'
import AuthGate from './components/AuthGate.jsx'
import RoleChooser from './pages/RoleChooser.jsx'
import DriverAuth from './pages/DriverAuth.jsx'
import CustomerAuth from './pages/CustomerAuth.jsx'
import Landing from './pages/Landing.jsx'
import Nearby from './pages/Nearby.jsx'
import TruckDetail from './pages/TruckDetail.jsx'
import Chat from './pages/Chat.jsx'
import Messages from './pages/Messages.jsx'
import CustomerAccount from './pages/CustomerAccount.jsx'
import CreateListing from './pages/CreateListing.jsx'
import DriverEnquiries from './pages/DriverEnquiries.jsx'
import DriverVehicles from './pages/DriverVehicles.jsx'
import DriverAccount from './pages/DriverAccount.jsx'

// Tabs are the app's top level; anything opened from a tab is "pushed" over it
// with its own back button and no bottom bar, the way a native app behaves.
const CUSTOMER_TABS = ['explore', 'messages', 'account']
const DRIVER_TABS = ['enquiries', 'vehicles', 'account']
const PUSHED = ['truck', 'chat', 'create', 'opchat', 'custauth']

export default function App() {
  const [listings, setListings] = useState(() => loadListings(SEED_LISTINGS))
  const [threads, setThreads] = useState(loadThreads)
  const [drivers, setDrivers] = useState(loadDrivers)
  const [customers, setCustomers] = useState(loadCustomers)
  const [session, setSession] = useState(loadSession)
  const [view, setView] = useState(() => ({
    name: loadSession().role === 'driver' ? 'enquiries' : 'explore',
  }))

  const location = useLocation()

  // Sync is off unless a Supabase project is configured (see .env.example), in
  // which case the app behaves exactly as it always did — one device, one copy.
  // With it on, the backend is the shared truth and this phone is one view onto
  // it. Nothing is pushed until the first read has landed, so a stale local copy
  // can never overwrite what the other phone already put there.
  const primed = useRef(false)

  // The save effects below only fire when state CHANGES, and they all run once
  // on mount — before the first read has come back. On a fresh database that
  // means nothing would ever be uploaded, because after priming there is no
  // further change to react to. This ref lets the priming step push what the
  // device already holds, which is what seeds an empty backend.
  const latest = useRef(null)
  latest.current = { listings, threads, drivers, customers }

  useEffect(() => {
    if (!syncEnabled) return
    let alive = true

    const refresh = async () => {
      const remote = await pullAll()
      if (!alive || !remote) return

      if (primed.current) {
        // Guarded against empty: a pull racing the very first push would
        // otherwise wipe the seeded vehicles off both phones.
        if (remote.listings.length) setListings(remote.listings)
        setThreads(remote.threads)
      } else {
        // First read keeps anything this device has that the backend lacks —
        // the seeded vehicles on a fresh database, threads made before setup.
        setListings((local) => (remote.listings.length ? remote.listings : local))
        setThreads((local) => mergeThreads(local, remote.threads))
        primed.current = true

        // Upload what this device already has. Rows the backend just gave us
        // are skipped — pullAll recorded their signatures — so on a database
        // that already has data this writes nothing.
        const mine = latest.current
        pushListings(mine.listings)
        pushThreads(mine.threads)
        pushDrivers(mine.drivers)
        pushCustomers(mine.customers)
      }
      // Accounts are only ever added, so these always merge both ways.
      setDrivers((local) => ({ ...local, ...remote.drivers }))
      setCustomers((local) => ({ ...local, ...remote.customers }))
    }

    refresh()
    const stop = subscribe(refresh)
    return () => {
      alive = false
      stop()
    }
  }, [])

  useEffect(() => {
    saveListings(listings)
    if (primed.current) pushListings(listings)
  }, [listings])

  useEffect(() => {
    saveThreads(threads)
    if (primed.current) pushThreads(threads)
  }, [threads])

  useEffect(() => {
    saveDrivers(drivers)
    if (primed.current) pushDrivers(drivers)
  }, [drivers])

  useEffect(() => {
    saveCustomers(customers)
    if (primed.current) pushCustomers(customers)
  }, [customers])

  // Deliberately NOT synced: who is signed in is per-device. You on one phone
  // and your friend on the other must stay two different people.
  useEffect(() => saveSession(session), [session])

  const go = (next) => {
    setView(next)
    window.scrollTo({ top: 0 })
  }

  const driver = session.driverEmail ? driverFor(drivers, session.driverEmail) : null
  const myListings = useMemo(
    () => (driver ? listingsForPhone(listings, driver.phone) : []),
    [listings, driver],
  )

  // Keep the driver's leave-time reminders in sync with their bookings. Fires
  // native notifications (30 min / 5 min / at leave-time) for each confirmed,
  // still-upcoming pickup; cancels them once a trip is cancelled, done or past.
  // Travel time is measured from the vehicle's base suburb to the pickup.
  useEffect(() => {
    if (session.role !== 'driver' || !driver) return
    const myIds = new Set(myListings.map((l) => l.id))
    const baseByListing = new Map(myListings.map((l) => [l.id, l.baseLocation]))

    let tracked = {}
    try {
      tracked = JSON.parse(localStorage.getItem('bakkie.reminders.v1')) || {}
    } catch {
      tracked = {}
    }
    const next = { ...tracked }

    for (const t of threads) {
      if (!myIds.has(t.listingId)) continue
      for (const m of t.messages) {
        if (m.kind !== 'booking' || !m.booking) continue
        const b = m.booking
        const active = b.status === 'confirmed' && isUpcoming(b)
        const sig = `${b.date}|${b.time}|${b.pickup}`
        if (active && tracked[b.id] !== sig) {
          scheduleBookingReminders(b, { name: baseByListing.get(t.listingId) })
          next[b.id] = sig
        } else if (!active && tracked[b.id]) {
          cancelBookingReminders(b.id)
          delete next[b.id]
        }
      }
    }

    try {
      localStorage.setItem('bakkie.reminders.v1', JSON.stringify(next))
    } catch {
      /* private window — reminders still scheduled, just not deduped across reloads */
    }
  }, [threads, session.role, driver, myListings])

  const customer = session.customerEmail
    ? customerFor(customers, session.customerEmail)
    : null
  // A customer only ever sees their own conversations.
  const myThreads = useMemo(
    () => (customer ? threads.filter((t) => t.customerEmail === customer.email) : []),
    [threads, customer],
  )

  /* ---------- role & auth ---------- */

  const pickRole = (role) => {
    setSession((s) => ({ ...s, role }))
    if (role !== 'driver') return go({ name: 'explore' })
    const known = session.driverEmail ? driverFor(drivers, session.driverEmail) : null
    go({ name: known ? 'enquiries' : 'auth' })
  }

  // Returns an error code the auth screen can show, or null on success.
  const signIn = ({ email, password }) => {
    const existing = driverFor(drivers, email)
    if (!existing) return 'no-account'
    if (existing.password !== password) return 'bad-password'
    setSession({ role: 'driver', driverEmail: existing.email })
    go({ name: 'enquiries' })
    return null
  }

  const signUp = ({ name, email, phone, password }) => {
    const key = normaliseEmail(email)
    if (drivers[key]) return 'exists'
    setDrivers((prev) => ({ ...prev, [key]: blankDriver({ name, email, phone, password }) }))
    setSession({ role: 'driver', driverEmail: key })
    go({ name: 'create' })
    return null
  }

  // One-tap sign in to the always-present demo driver. The session persists, so
  // this is a one-time thing until they use the Sign out button.
  const signInDemo = () => {
    setSession({ role: 'driver', driverEmail: DEMO_DRIVER_EMAIL })
    go({ name: 'enquiries' })
  }

  const signOut = () => {
    clearSession()
    setSession({ role: null, driverEmail: null })
    go({ name: 'role' })
  }

  const switchRole = () => {
    setSession((s) => ({ ...s, role: null }))
    go({ name: 'role' })
  }

  /* ---------- customer auth ---------- */
  // Same email + password system as the driver, but a customer can browse the
  // whole app signed out — these only fire when they try to message, or open
  // Messages or their profile. Each returns an error code or null (success).

  const customerSignIn = ({ email, password }) => {
    const existing = customerFor(customers, email)
    if (!existing) return 'no-account'
    if (existing.password !== password) return 'bad-password'
    setSession((s) => ({ ...s, customerEmail: existing.email }))
    return null
  }

  const customerSignUp = ({ name, email, password }) => {
    const key = normaliseEmail(email)
    if (customers[key]) return 'exists'
    setCustomers((prev) => ({ ...prev, [key]: blankCustomer({ name, email, password }) }))
    setSession((s) => ({ ...s, customerEmail: key }))
    return null
  }

  // One-tap sign in to the demo customer (mirror of signInDemo for the driver).
  const customerDemo = () => setSession((s) => ({ ...s, customerEmail: DEMO_CUSTOMER_EMAIL }))

  const customerSignOut = () => {
    setSession((s) => ({ ...s, customerEmail: null }))
    go({ name: 'explore' })
  }

  // Send a signed-out customer to sign in, remembering where they were headed.
  const requireCustomer = ({ next, back, reason }) =>
    go({ name: 'custauth', mode: 'signin', next, back, reason })

  /* ---------- listings ---------- */

  const saveListing = (listing) => {
    const isNew = !listing.id
    setListings((prev) =>
      listing.id
        ? prev.map((l) => (l.id === listing.id ? { ...l, ...listing } : l))
        : [{ ...listing, id: `l${Date.now()}`, views: 0, paused: false }, ...prev],
    )
    if (session.role !== 'driver') return go({ name: 'explore' })
    // Publishing a brand-new vehicle hands the driver straight to their profile,
    // where the natural next step — getting verified — lives. Edits just drop
    // back to the vehicle list they came from.
    go({ name: isNew ? 'account' : 'vehicles' })
  }

  const togglePause = (id) =>
    setListings((prev) => prev.map((l) => (l.id === id ? { ...l, paused: !l.paused } : l)))

  const deleteListing = (id) => {
    const l = listings.find((x) => x.id === id)
    if (!window.confirm(`Remove "${l?.title}"? This can't be undone.`)) return
    setListings((prev) => prev.filter((x) => x.id !== id))
    setThreads((prev) => prev.filter((t) => t.listingId !== id))
  }

  // Counted here rather than in the detail screen so React's development
  // double-render can't inflate it.
  const openTruck = (id) => {
    setListings((prev) =>
      prev.map((l) => (l.id === id ? { ...l, views: (l.views ?? 0) + 1 } : l)),
    )
    go({ name: 'truck', id })
  }

  /* ---------- verification ---------- */

  const toggleDoc = (docId) =>
    setDrivers((prev) => {
      const d = prev[session.driverEmail]
      if (!d) return prev
      return {
        ...prev,
        [session.driverEmail]: { ...d, docs: { ...d.docs, [docId]: !d.docs?.[docId] } },
      }
    })

  const approveVerification = () => {
    setDrivers((prev) => {
      const d = prev[session.driverEmail]
      if (!d) return prev
      return { ...prev, [session.driverEmail]: { ...d, verified: true } }
    })
    setListings((prev) =>
      prev.map((l) =>
        driver && samePhone(l.ownerPhone, driver.phone) ? { ...l, verified: true } : l,
      ),
    )
  }

  /* ---------- messaging ---------- */

  const sendMessage = (listingId, from, text, extra) => {
    setThreads((prev) => {
      // Owner replies (customer null) match the listing's thread; a customer
      // matches their own. A thread is only ever created by a customer's first
      // message, so we can stamp their identity onto it here.
      const existing = threadFor(prev, listingId, customer?.email)
      const msg = newMessage(from, text, extra)
      if (!existing)
        return [
          ...prev,
          {
            ...startThread(listingId, customer?.name ?? 'You', customer?.email ?? null),
            messages: [msg],
          },
        ]
      return prev.map((t) =>
        t.id === existing.id ? { ...t, messages: [...t.messages, msg] } : t,
      )
    })
  }

  // Bookings carry their own state (marked-done, each side's rating). Patching
  // one means finding the booking message by id wherever it lives and merging in.
  const patchBooking = (bookingId, patch) => {
    setThreads((prev) =>
      prev.map((t) => ({
        ...t,
        messages: t.messages.map((m) =>
          m.kind === 'booking' && m.booking?.id === bookingId
            ? { ...m, booking: { ...m.booking, ...patch } }
            : m,
        ),
      })),
    )
  }

  const current = useMemo(() => listings.find((l) => l.id === view.id), [listings, view.id])
  const editing = useMemo(
    () => listings.find((l) => l.id === view.editId),
    [listings, view.editId],
  )

  const hardReset = () => {
    resetAll()
    for (const k of [
      'bakkie.threads.v1',
      'bakkie.drivers.v1',
      'bakkie.customers.v1',
      'bakkie.session.v1',
    ]) {
      try {
        localStorage.removeItem(k)
      } catch {
        /* nothing to do */
      }
    }
    setListings(SEED_LISTINGS)
    setThreads([])
    setDrivers({})
    setCustomers({})
    setSession({ role: null, driverEmail: null, customerEmail: null })
    location.reset()
    go({ name: 'role' })
  }

  /* ---------- gates ---------- */

  if (!session.role || view.name === 'role') {
    return (
      <div className="app">
        <RoleChooser onPick={pickRole} />
      </div>
    )
  }

  if (session.role === 'driver' && !driver) {
    return (
      <div className="app">
        <DriverAuth onSignIn={signIn} onSignUp={signUp} onDemo={signInDemo} onBack={switchRole} />
      </div>
    )
  }

  const isDriver = session.role === 'driver'
  const tabs = isDriver ? DRIVER_TABS : CUSTOMER_TABS
  const viewName = [...tabs, ...PUSHED].includes(view.name)
    ? view.name
    : isDriver
      ? 'enquiries'
      : 'explore'

  // The customer's browsing tabs need coordinates; the account tab doesn't.
  const needsCoords = ['explore', 'truck', 'chat'].includes(viewName)
  if (!isDriver && location.status !== 'ready' && needsCoords) {
    return (
      <div className="app">
        <Landing
          status={location.status}
          onRequest={location.request}
          onManual={location.setManual}
          onBack={switchRole}
        />
      </div>
    )
  }

  const pushed = PUSHED.includes(viewName)
  const customerWaiting = repliesWaiting(myThreads)
  const myIds = new Set(myListings.map((l) => l.id))
  const driverWaiting = threads.filter(
    (t) => myIds.has(t.listingId) && lastMessage(t)?.from === 'customer',
  ).length

  return (
    <div className={pushed ? 'app pushed' : 'app'}>
      <main>
        {viewName === 'explore' && (
          <Nearby
            listings={listings.filter((l) => !l.paused)}
            coords={location.coords}
            areaName={location.areaName}
            onOpen={openTruck}
            onChangeArea={location.reset}
          />
        )}

        {viewName === 'messages' &&
          (customer ? (
            <Messages
              listings={listings}
              threads={myThreads}
              onOpen={(id) => go({ name: 'chat', id, from: 'messages' })}
              onFind={() => go({ name: 'explore' })}
            />
          ) : (
            <AuthGate
              icon="message"
              title="Sign in to see your messages"
              message="Your conversations with drivers live here once you have an account."
              onSignIn={() =>
                requireCustomer({
                  next: { name: 'messages' },
                  back: { name: 'messages' },
                  reason: 'Sign in to see your messages.',
                })
              }
              onCreate={() =>
                go({
                  name: 'custauth',
                  mode: 'register',
                  next: { name: 'messages' },
                  back: { name: 'messages' },
                  reason: 'Create an account to keep your conversations.',
                })
              }
            />
          ))}

        {viewName === 'account' &&
          !isDriver &&
          (customer ? (
            <CustomerAccount
              customer={customer}
              areaName={location.areaName}
              onChangeArea={location.reset}
              onBecomeDriver={() => pickRole('driver')}
              onSignOut={customerSignOut}
              onReset={hardReset}
            />
          ) : (
            <AuthGate
              icon="user"
              title="Sign in to view your profile"
              message="Create an account or sign in to see your profile and saved conversations. Browsing stays free."
              action={{ label: "I'm a driver", icon: 'truck', onClick: () => pickRole('driver') }}
              onSignIn={() =>
                requireCustomer({
                  next: { name: 'account' },
                  back: { name: 'account' },
                  reason: 'Sign in to view your profile.',
                })
              }
              onCreate={() =>
                go({
                  name: 'custauth',
                  mode: 'register',
                  next: { name: 'account' },
                  back: { name: 'account' },
                  reason: 'Create an account to view your profile.',
                })
              }
            />
          ))}

        {viewName === 'account' && isDriver && driver && (
          <DriverAccount
            driver={driver}
            listings={myListings}
            threads={threads}
            onToggleDoc={toggleDoc}
            onApprove={approveVerification}
            onSwitchRole={switchRole}
            onSignOut={signOut}
            onReset={hardReset}
          />
        )}

        {viewName === 'enquiries' && driver && (
          <DriverEnquiries
            driver={driver}
            listings={myListings}
            threads={threads}
            onOpenChat={(id) => go({ name: 'opchat', id })}
          />
        )}

        {viewName === 'vehicles' && (
          <DriverVehicles
            listings={myListings}
            onEdit={(id) => go({ name: 'create', editId: id })}
            onAdd={() => go({ name: 'create' })}
            onTogglePause={togglePause}
            onDelete={deleteListing}
          />
        )}

        {viewName === 'truck' && current && (
          <TruckDetail
            listing={current}
            coords={location.coords}
            signedIn={Boolean(customer)}
            onBack={() => go({ name: 'explore' })}
            onMessage={(id) =>
              customer
                ? go({ name: 'chat', id, from: 'truck' })
                : requireCustomer({
                    next: { name: 'chat', id, from: 'truck' },
                    back: { name: 'truck', id },
                    reason: 'Sign in to message this driver.',
                  })
            }
          />
        )}

        {viewName === 'chat' && current && customer && (
          <Chat
            listing={current}
            thread={threadFor(threads, current.id, customer.email)}
            onSend={sendMessage}
            onBack={() =>
              view.from === 'messages'
                ? go({ name: 'messages' })
                : go({ name: 'truck', id: current.id })
            }
            onPatchBooking={patchBooking}
            viewAs="customer"
          />
        )}

        {viewName === 'opchat' && current && (
          <Chat
            listing={current}
            thread={threadFor(threads, current.id)}
            onSend={sendMessage}
            onBack={() => go({ name: 'enquiries' })}
            onPatchBooking={patchBooking}
            viewAs="owner"
          />
        )}

        {viewName === 'create' && (
          <CreateListing
            initial={editing ?? null}
            owner={driver ? { name: driver.name, phone: driver.phone } : null}
            onSave={saveListing}
            onCancel={() => go({ name: isDriver ? 'vehicles' : 'explore' })}
          />
        )}

        {viewName === 'custauth' && (
          <CustomerAuth
            startMode={view.mode ?? 'signin'}
            reason={view.reason}
            onSignIn={customerSignIn}
            onSignUp={customerSignUp}
            onDemo={customerDemo}
            onAuthed={() => go(view.next ?? { name: 'account' })}
            onBack={() => go(view.back ?? { name: 'explore' })}
          />
        )}
      </main>

      {!pushed && (
        <BottomNav
          role={session.role}
          active={viewName}
          badges={{ messages: customerWaiting, enquiries: driverWaiting }}
          onSelect={(id) => go({ name: id })}
        />
      )}
    </div>
  )
}
