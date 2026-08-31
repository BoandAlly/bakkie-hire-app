import { useEffect, useMemo, useState } from 'react'
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
} from './lib/threads.js'
import {
  loadSession,
  saveSession,
  clearSession,
  normaliseEmail,
  samePhone,
  listingsForPhone,
} from './lib/session.js'
import { loadDrivers, saveDrivers, driverFor, blankDriver } from './lib/drivers.js'
import {
  loadCustomers,
  saveCustomers,
  customerFor,
  blankCustomer,
} from './lib/customers.js'
import { useLocation } from './lib/geo.js'
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

  useEffect(() => saveListings(listings), [listings])
  useEffect(() => saveThreads(threads), [threads])
  useEffect(() => saveDrivers(drivers), [drivers])
  useEffect(() => saveCustomers(customers), [customers])
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

  const sendMessage = (listingId, from, text) => {
    setThreads((prev) => {
      // Owner replies (customer null) match the listing's thread; a customer
      // matches their own. A thread is only ever created by a customer's first
      // message, so we can stamp their identity onto it here.
      const existing = threadFor(prev, listingId, customer?.email)
      const msg = newMessage(from, text)
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
        <DriverAuth onSignIn={signIn} onSignUp={signUp} onBack={switchRole} />
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
            viewAs="customer"
          />
        )}

        {viewName === 'opchat' && current && (
          <Chat
            listing={current}
            thread={threadFor(threads, current.id)}
            onSend={sendMessage}
            onBack={() => go({ name: 'enquiries' })}
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
