// Cross-device sync for testing on two phones.
//
// The app's state is unchanged — App.jsx still holds plain arrays and objects,
// still writes them to localStorage. This module mirrors that state to Supabase
// and pushes remote changes back in, so a booking made on one phone shows up on
// the other without a refresh.
//
// When Supabase isn't configured every export here is a no-op and the app is
// exactly the single-device prototype it was.
//
// WHY MESSAGES ARE ROWS. Everything else stores its whole object in a jsonb
// column, but a thread's messages get one row each. If two phones held the
// thread as an array and both wrote it, the later write would erase the other's
// message — and two people messaging at once is the main thing being tested.

import { supabase, isConfigured } from './supabase.js'

export const syncEnabled = isConfigured

const TABLES = ['listings', 'drivers', 'customers', 'threads', 'messages']

// Signature of every row as we last saw it — written on pull, checked on push.
// This is what stops the feedback loop: a remote change sets React state, the
// state effect calls push, and push finds nothing whose contents differ.
const seen = new Map()
const sig = (table, id) => `${table}:${id}`
const same = (table, id, row) => seen.get(sig(table, id)) === JSON.stringify(row)
const remember = (table, id, row) => seen.set(sig(table, id), JSON.stringify(row))

// ---------------------------------------------------------------------------
// Row <-> app-object mapping
// ---------------------------------------------------------------------------

// Messages carry no id of their own, so identity is derived. `at` is an ISO
// string straight from the app and is stored verbatim (see schema.sql), so the
// same message always derives the same id on any device.
const messageId = (threadId, m) => `${threadId}__${m.at}__${m.from}`

const rowToMessage = (r) => ({
  from: r.sender,
  text: r.body ?? '',
  at: r.sent_at,
  ...(r.kind ? { kind: r.kind } : {}),
  ...(r.booking ? { booking: r.booking } : {}),
})

const messageToRow = (threadId, m) => ({
  id: messageId(threadId, m),
  thread_id: threadId,
  sender: m.from,
  body: m.text ?? '',
  sent_at: m.at,
  kind: m.kind ?? null,
  booking: m.booking ?? null,
})

const threadToRow = (t) => ({
  id: t.id,
  listing_id: t.listingId,
  customer_name: t.customerName ?? null,
  customer_email: t.customerEmail ?? null,
  created_at: t.createdAt ?? null,
})

const rowToThread = (r, messages) => ({
  id: r.id,
  listingId: r.listing_id,
  customerName: r.customer_name ?? 'You',
  customerEmail: r.customer_email ?? null,
  createdAt: r.created_at ?? null,
  messages,
})

/**
 * Union of what this device has and what the backend has, used only on the
 * FIRST load — a phone that made threads offline (or before the backend
 * existed) keeps them, and they get pushed up on the next save. Later pulls
 * take the backend as the truth, so deletions actually propagate.
 */
export function mergeThreads(local, remote) {
  const byId = new Map(remote.map((t) => [t.id, t]))
  for (const lt of local) {
    const rt = byId.get(lt.id)
    if (!rt) {
      byId.set(lt.id, lt)
      continue
    }
    const seenIds = new Set(rt.messages.map((m) => messageId(rt.id, m)))
    const extra = lt.messages.filter((m) => !seenIds.has(messageId(lt.id, m)))
    if (extra.length) {
      byId.set(rt.id, {
        ...rt,
        messages: [...rt.messages, ...extra].sort((a, b) => (a.at < b.at ? -1 : 1)),
      })
    }
  }
  return [...byId.values()]
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

/**
 * Everything the backend holds, in the app's own shapes. Returns null when
 * sync is off or the round trip fails — callers keep their local state.
 */
export async function pullAll() {
  if (!syncEnabled) return null
  try {
    const [listings, drivers, customers, threads, messages] = await Promise.all(
      TABLES.map((t) => supabase.from(t).select('*')),
    )
    const failed = [listings, drivers, customers, threads, messages].find((r) => r.error)
    if (failed) throw failed.error

    // Messages grouped under their thread, oldest first. The ISO strings sort
    // correctly as text because they are all UTC from toISOString().
    const byThread = new Map()
    for (const r of messages.data) {
      remember('messages', r.id, r)
      if (!byThread.has(r.thread_id)) byThread.set(r.thread_id, [])
      byThread.get(r.thread_id).push(r)
    }
    for (const list of byThread.values()) list.sort((a, b) => (a.sent_at < b.sent_at ? -1 : 1))

    for (const r of listings.data) remember('listings', r.id, r)
    for (const r of drivers.data) remember('drivers', r.email, r)
    for (const r of customers.data) remember('customers', r.email, r)
    for (const r of threads.data) remember('threads', r.id, r)

    const keyed = (rows, k) => Object.fromEntries(rows.map((r) => [r[k], r.data]))

    return {
      listings: listings.data.map((r) => r.data),
      drivers: keyed(drivers.data, 'email'),
      customers: keyed(customers.data, 'email'),
      threads: threads.data.map((r) =>
        rowToThread(r, (byThread.get(r.id) ?? []).map(rowToMessage)),
      ),
    }
  } catch (err) {
    console.warn('[sync] pull failed — staying on local data', err)
    return null
  }
}

/**
 * Call `onChange` whenever any device writes. Debounced, because one user
 * action (sending a message) can touch two tables. Returns an unsubscribe fn.
 */
export function subscribe(onChange) {
  if (!syncEnabled) return () => {}
  let timer = null
  const schedule = () => {
    clearTimeout(timer)
    timer = setTimeout(onChange, 250)
  }

  const channel = supabase.channel('bakkie-sync')
  for (const table of TABLES) {
    channel.on('postgres_changes', { event: '*', schema: 'public', table }, schedule)
  }
  channel.subscribe()

  return () => {
    clearTimeout(timer)
    supabase.removeChannel(channel)
  }
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

async function upsertChanged(table, rows, idField) {
  const changed = rows.filter((r) => !same(table, r[idField], r))
  if (!changed.length) return
  const { error } = await supabase.from(table).upsert(changed)
  if (error) {
    console.warn(`[sync] could not save ${table}`, error)
    return
  }
  for (const r of changed) remember(table, r[idField], r)
}

/**
 * Delete rows we previously synced that have since disappeared locally — a
 * driver removing a vehicle, say. Only ids already in `seen` are considered, so
 * a first load with empty local state can never wipe the backend.
 */
async function deleteMissing(table, liveIds, idField) {
  const prefix = `${table}:`
  const gone = []
  for (const key of seen.keys()) {
    if (!key.startsWith(prefix)) continue
    const id = key.slice(prefix.length)
    if (!liveIds.has(id)) gone.push(id)
  }
  if (!gone.length) return
  const { error } = await supabase.from(table).delete().in(idField, gone)
  if (error) {
    console.warn(`[sync] could not remove from ${table}`, error)
    return
  }
  for (const id of gone) seen.delete(sig(table, id))
}

export async function pushListings(listings) {
  if (!syncEnabled) return
  const rows = listings.map((l) => ({ id: String(l.id), data: l }))
  await upsertChanged('listings', rows, 'id')
  await deleteMissing('listings', new Set(listings.map((l) => String(l.id))), 'id')
}

export async function pushDrivers(drivers) {
  if (!syncEnabled) return
  const rows = Object.entries(drivers).map(([email, data]) => ({ email, data }))
  await upsertChanged('drivers', rows, 'email')
}

export async function pushCustomers(customers) {
  if (!syncEnabled) return
  const rows = Object.entries(customers).map(([email, data]) => ({ email, data }))
  await upsertChanged('customers', rows, 'email')
}

export async function pushThreads(threads) {
  if (!syncEnabled) return
  await upsertChanged('threads', threads.map(threadToRow), 'id')

  const rows = []
  for (const t of threads) for (const m of t.messages) rows.push(messageToRow(t.id, m))
  await upsertChanged('messages', rows, 'id')

  // Messages are cascade-deleted with their thread, so only threads need the
  // removal sweep.
  await deleteMissing('threads', new Set(threads.map((t) => String(t.id))), 'id')
}
