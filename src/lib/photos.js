// Turning a camera photo into something we can actually store.
//
// A photo straight off a phone is 3-4 MB, and becomes about a third bigger
// again once encoded as a data URL. The browser gives the whole app roughly
// 5 MB of storage, so two untouched photos overflow it — and the failure is
// silent, so a driver's listing simply vanishes on next open.
//
// Shrinking first fixes that at the source: 1280px on the long edge is more
// than a phone screen can show, and lands around 150-250 KB per photo.

const MAX_PX = 1280
const QUALITY = 0.72

/** Decode a file to something drawable, preferring the fast path. */
async function decode(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      return { img: await createImageBitmap(file), release: (b) => b.close?.() }
    } catch {
      // Some WebViews reject certain formats here — fall through.
    }
  }
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('Could not read that image'))
      el.src = url
    })
    return { img, release: () => URL.revokeObjectURL(url) }
  } catch (err) {
    URL.revokeObjectURL(url)
    throw err
  }
}

/**
 * Shrink an image file to a JPEG data URL that fits comfortably in storage.
 * Throws if the file isn't a readable image, so callers can tell the person
 * rather than silently dropping it.
 */
export async function shrinkImage(file, { maxPx = MAX_PX, quality = QUALITY } = {}) {
  const { img, release } = await decode(file)
  try {
    const w0 = img.width
    const h0 = img.height
    if (!w0 || !h0) throw new Error('Could not read that image')

    const scale = Math.min(1, maxPx / Math.max(w0, h0))
    const w = Math.max(1, Math.round(w0 * scale))
    const h = Math.max(1, Math.round(h0 * scale))

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Could not process that image')
    ctx.drawImage(img, 0, 0, w, h)

    return canvas.toDataURL('image/jpeg', quality)
  } finally {
    release(img)
  }
}

/** Rough byte size of a data URL, for checking we're within budget. */
export const dataUrlBytes = (dataUrl) => {
  const comma = dataUrl.indexOf(',')
  if (comma < 0) return 0
  const chars = dataUrl.length - comma - 1
  const padding = dataUrl.endsWith('==') ? 2 : dataUrl.endsWith('=') ? 1 : 0
  return Math.round((chars * 3) / 4) - padding
}
