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

// The single definition of a row's shape. Both the pull side (recording what
// the backend already holds) and the push side build rows through these, so a
// signature can never differ just because the two sides spelled it differently.
const listingRow = (l) => ({ id: String(l.id), data: l })
const keyedRow = (field, key, data) => ({ [field]: key, data })

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
    // What gets remembered is the row as PUSH would build it, not the row the
    // database handed back. The database adds `updated_at`, which push never
    // sends; remembering the raw row would make every signature compare false,
    // so each pull would rewrite everything, and each rewrite would fire more
    // change events — a loop. Round-tripping through the app shape keeps both
    // sides byte-identical by construction.
    const byThread = new Map()
    for (const r of messages.data) {
      remember('messages', r.id, messageToRow(r.thread_id, rowToMessage(r)))
      if (!byThread.has(r.thread_id)) byThread.set(r.thread_id, [])
      byThread.get(r.thread_id).push(r)
    }
    for (const list of byThread.values()) list.sort((a, b) => (a.sent_at < b.sent_at ? -1 : 1))

    for (const r of listings.data) remember('listings', r.id, listingRow(r.data))
    for (const r of drivers.data) remember('drivers', r.email, keyedRow('email', r.email, r.data))
    for (const r of customers.data) remember('customers', r.email, keyedRow('email', r.email, r.data))
    for (const r of threads.data) remember('threads', r.id, threadToRow(rowToThread(r, [])))

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
  // Short enough to feel immediate, long enough that one action touching two
  // tables (a new thread plus its first message) still costs a single read.
  let timer = null
  const schedule = () => {
    clearTimeout(timer)
    timer = setTimeout(onChange, 60)
  }

  const channel = supabase.channel('bakkie-sync')
  for (const table of TABLES) {
    channel.on('postgres_changes', { event: '*', schema: 'public', table }, schedule)
  }
  channel.subscribe()

  // Backstop poll. Push delivery through `postgres_changes` has been unreliable
  // on this project — changes were arriving on a ~30s cycle instead of
  // immediately — and a chat that takes half a minute to show a reply is
  // useless for testing. Polling puts a hard ceiling on how stale a screen can
  // be, and costs one small read per interval per phone.
  //
  // When push delivery IS working the poll is nearly free: `pullAll` records
  // what it read, so a poll that finds nothing new writes nothing and re-renders
  // nothing. Worth revisiting once realtime is confirmed working.
  const POLL_MS = 2500
  const poll = setInterval(onChange, POLL_MS)

  return () => {
    clearTimeout(timer)
    clearInterval(poll)
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
  await upsertChanged('listings', listings.map(listingRow), 'id')
  await deleteMissing('listings', new Set(listings.map((l) => String(l.id))), 'id')
}

export async function pushDrivers(drivers) {
  if (!syncEnabled) return
  const rows = Object.entries(drivers).map(([email, data]) => keyedRow('email', email, data))
  await upsertChanged('drivers', rows, 'email')
}

export async function pushCustomers(customers) {
  if (!syncEnabled) return
  const rows = Object.entries(customers).map(([email, data]) => keyedRow('email', email, data))
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
