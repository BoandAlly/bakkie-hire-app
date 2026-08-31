// Lucide-style outline icons: 24×24, 2px stroke, round caps.
//
// Inlined rather than installed — the app needs about twenty glyphs, not two
// thousand, and inline SVG recolours via currentColor for free. Emoji are never
// used as icons: they render differently on every platform and screen readers
// read them aloud as prose.

const paths = {
  compass: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M15.5 8.5l-2 5-5 2 2-5 5-2Z" />
    </>
  ),
  message: <path d="M20.5 12a7.9 7.9 0 0 1-8.5 8 9.2 9.2 0 0 1-2.9-.5L4 21l1.6-4.2A7.7 7.7 0 0 1 4 12a7.9 7.9 0 0 1 8.5-8 8 8 0 0 1 8 8Z" />,
  user: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </>
  ),
  truck: (
    <>
      <path d="M2 17V6h11v11M13 9h4.5l3.5 4v4" />
      <circle cx="7" cy="17.5" r="2" />
      <circle cx="17.5" cy="17.5" r="2" />
    </>
  ),
  inbox: (
    <>
      <path d="M4 13h4l1.5 2.5h5L16 13h4" />
      <path d="M5.5 5h13l1.5 8v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-5l1.5-8Z" />
    </>
  ),
  back: <path d="M15 5l-7 7 7 7" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  pin: (
    <>
      <path d="M12 21s7-5.4 7-11a7 7 0 1 0-14 0c0 5.6 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3l7 3v6c0 4.4-3 7.7-7 9-4-1.3-7-4.6-7-9V6l7-3Z" />
      <path d="M9 12l2.2 2.2L15.5 10" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0M16 5.2a3.2 3.2 0 0 1 0 5.9M17.5 19a5.4 5.4 0 0 0-2-4.2" />
    </>
  ),
  send: <path d="M4 12l16-8-5 16-3.5-6.5L4 12Z" />,
  plus: <path d="M12 5v14M5 12h14" />,
  edit: (
    <>
      <path d="M4 20h4l10-10-4-4L4 16v4Z" />
      <path d="M13.5 6.5l4 4" />
    </>
  ),
  pause: <path d="M9 5v14M15 5v14" />,
  play: <path d="M7 4.5l12 7.5-12 7.5v-15Z" />,
  trash: <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13M10 11v6M14 11v6" />,
  check: <path d="M5 12.5l4.5 4.5L19 7" />,
  minus: <path d="M6 12h12" />,
  ruler: (
    <>
      <rect x="3" y="9" width="18" height="6" rx="1" />
      <path d="M7 9v2.5M11 9v2.5M15 9v2.5M19 9v2.5" />
    </>
  ),
  box: (
    <>
      <path d="M20 8.5v7l-8 4.5-8-4.5v-7L12 4l8 4.5Z" />
      <path d="M4 8.5l8 4.5 8-4.5M12 13v7" />
    </>
  ),
  route: (
    <>
      <circle cx="6" cy="18" r="2.5" />
      <circle cx="18" cy="6" r="2.5" />
      <path d="M8.5 18h5a4 4 0 0 0 0-8h-3a4 4 0 0 1 0-8h1" />
    </>
  ),
  wallet: (
    <>
      <path d="M3 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8Z" />
      <path d="M16 12h5v3h-5a1.5 1.5 0 0 1 0-3Z" />
    </>
  ),
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  logout: <path d="M15 5H6a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h9M18.5 12H10M15.5 8.5L19 12l-3.5 3.5" />,
  camera: (
    <>
      <path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h2.2l1.3-2h7.9l1.3 2h2.3A1.5 1.5 0 0 1 21 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5v-9Z" />
      <circle cx="12" cy="13" r="3.4" />
    </>
  ),
  chevron: <path d="M9 5l7 7-7 7" />,
  lock: (
    <>
      <rect x="4.5" y="10.5" width="15" height="9" rx="1.5" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </>
  ),
  refresh: <path d="M20 11a8 8 0 1 0-.6 4M20 5v6h-6" />,
}

export default function Icon({ name, size = 22, className = '', strokeWidth = 2 }) {
  const d = paths[name]
  if (!d) return null
  return (
    <svg
      className={`icon ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {d}
    </svg>
  )
}

/** Ratings read better filled — an outline star at 14px turns to mush. */
export function StarIcon({ size = 15, className = '' }) {
  return (
    <svg
      className={`icon star ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 2.6l2.9 5.9 6.5.95-4.7 4.58 1.11 6.47L12 17.44l-5.81 3.06 1.11-6.47-4.7-4.58 6.5-.95L12 2.6Z" />
    </svg>
  )
}
