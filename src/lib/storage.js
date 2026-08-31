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

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Private window, quota, whatever — the app still works, it just won't persist.
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
