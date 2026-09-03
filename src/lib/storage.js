// Listings live in localStorage for now. Swapping this for a real backend means
// replacing these functions and nothing else.

const LISTINGS_KEY = 'bakkie.listings.v1'

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

/**
 * Returns false when the write didn't stick. Callers should say so rather than
 * pretend it saved — a listing that looks saved and is gone on next open is the
 * worst outcome, and used to be exactly what happened when photos filled the
 * storage budget.
 */
function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    // Out of room, or a private window where storage is refused.
    return false
  }
}

export const loadListings = (seed) => read(LISTINGS_KEY, seed)
export const saveListings = (listings) => write(LISTINGS_KEY, listings)


export function resetAll() {
  try {
    localStorage.removeItem(LISTINGS_KEY)
  } catch {
    /* nothing to do */
  }
}
