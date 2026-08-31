// Conversations between a customer and a vehicle owner. This is where the whole
// job gets arranged — date, time, what's being moved, final price. The app
// deliberately doesn't model any of that; it just carries the messages.

const KEY = 'bakkie.threads.v1'

export function loadThreads() {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveThreads(threads) {
  try {
    localStorage.setItem(KEY, JSON.stringify(threads))
  } catch {
    // Private window or quota — messages just won't survive a reload.
  }
}

// Match a listing's thread. Pass a customerEmail to get that customer's own
// conversation; omit it (owner side) to get the listing's thread regardless of
// which customer it belongs to.
export const threadFor = (threads, listingId, customerEmail) =>
  threads.find(
    (t) =>
      t.listingId === listingId &&
      (customerEmail == null || t.customerEmail === customerEmail),
  )

export function startThread(listingId, customerName = 'You', customerEmail = null) {
  return {
    id: `t${Date.now()}`,
    listingId,
    customerName,
    customerEmail,
    messages: [],
    createdAt: new Date().toISOString(),
  }
}

export const newMessage = (from, text) => ({
  from, // 'customer' | 'owner'
  text,
  at: new Date().toISOString(),
})

export const lastMessage = (thread) => thread.messages[thread.messages.length - 1]

export function unreadCountFor(threads, listingIds) {
  return threads.filter(
    (t) => listingIds.has(t.listingId) && lastMessage(t)?.from === 'customer',
  ).length
}

/** "14:32" — messages only ever need the time of day. */
export function timeLabel(iso) {
  try {
    return new Date(iso).toLocaleTimeString('en-ZA', {
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

/** Threads where the owner spoke last — i.e. the customer has a reply waiting. */
export const repliesWaiting = (threads) =>
  threads.filter((t) => lastMessage(t)?.from === 'owner').length
