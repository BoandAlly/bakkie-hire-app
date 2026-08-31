// The vehicle class ladder. This is what lets a guy moving one fridge and a guy
// moving six cars use the same app without drowning each other in search results.
//
// Each class carries the "typical" spec so the create-listing form can prefill,
// and a silhouette used as the photo placeholder + the filter icon.

export const VEHICLE_CLASSES = [
  {
    id: 'bakkie-half',
    name: 'Half-ton bakkie',
    examples: 'Nissan NP200, Chevrolet Utility',
    typical: { bedLengthM: 1.8, bedWidthM: 1.4, payloadKg: 700 },
    blurb: 'Single items, small loads, garden refuse.',
  },
  {
    id: 'bakkie-one',
    name: '1-ton bakkie',
    examples: 'Toyota Hilux, Ford Ranger, Isuzu D-Max',
    typical: { bedLengthM: 2.3, bedWidthM: 1.6, payloadKg: 1000 },
    blurb: 'Fridges, washing machines, a bedroom worth of furniture.',
  },
  {
    id: 'panel-van',
    name: 'Panel van / LDV',
    examples: 'Hyundai H100, H1, Iveco Daily',
    typical: { bedLengthM: 2.6, bedWidthM: 1.6, payloadKg: 1300 },
    blurb: 'Enclosed load. Good for rain, boxes and anything you want out of sight.',
  },
  {
    id: 'truck-small',
    name: '1.5 – 4 ton truck',
    examples: 'Drop-side or closed body',
    typical: { bedLengthM: 4.2, bedWidthM: 2.0, payloadKg: 3000 },
    blurb: 'A full flat or small house move in one trip.',
  },
  {
    id: 'truck-large',
    name: '8 ton+ truck',
    examples: 'Closed body, often with tail-lift',
    typical: { bedLengthM: 7.0, bedWidthM: 2.4, payloadKg: 8000 },
    blurb: 'Full house moves, pallets, commercial loads.',
  },
  {
    id: 'flatbed',
    name: 'Flatbed / rollback',
    examples: 'Tow truck, rollback recovery',
    typical: { bedLengthM: 6.0, bedWidthM: 2.4, payloadKg: 4000 },
    blurb: 'One vehicle, machinery, containers, anything that must be winched on.',
  },
  {
    id: 'car-transporter',
    name: 'Car transporter',
    examples: 'Truck + multi-car trailer',
    typical: { bedLengthM: 16.0, bedWidthM: 2.5, payloadKg: 12000 },
    blurb: 'Multiple vehicles at once. Collections, dealer stock, race day.',
  },
]

export const classById = (id) => VEHICLE_CLASSES.find((c) => c.id === id)

/**
 * Silhouette used wherever a real photo is missing. Doubles as the filter icon.
 * Deliberately flat and monochrome so it reads as "no photo yet", never as a
 * broken image.
 */
export function VehicleSilhouette({ classId, className = '' }) {
  const paths = {
    'bakkie-half': (
      <g>
        <path d="M8 30 L8 22 L20 22 L24 15 L38 15 L40 22 L52 22 L52 30 Z" />
        <rect x="40" y="17" width="14" height="8" rx="1" opacity="0.45" />
      </g>
    ),
    'bakkie-one': (
      <g>
        <path d="M6 30 L6 21 L18 21 L23 13 L40 13 L43 21 L58 21 L58 30 Z" />
        <rect x="43" y="15" width="17" height="9" rx="1" opacity="0.45" />
      </g>
    ),
    'panel-van': (
      <g>
        <path d="M6 30 L6 14 L40 14 L40 30 Z" />
        <path d="M40 30 L40 18 L50 18 L58 24 L58 30 Z" opacity="0.75" />
      </g>
    ),
    'truck-small': (
      <g>
        <rect x="6" y="12" width="34" height="18" rx="1" />
        <path d="M42 30 L42 18 L52 18 L60 24 L60 30 Z" opacity="0.75" />
      </g>
    ),
    'truck-large': (
      <g>
        <rect x="4" y="8" width="44" height="22" rx="1" />
        <path d="M50 30 L50 16 L60 16 L68 23 L68 30 Z" opacity="0.75" />
        <rect x="2" y="26" width="4" height="8" rx="1" opacity="0.5" />
      </g>
    ),
    flatbed: (
      <g>
        <rect x="4" y="24" width="44" height="5" rx="1" />
        <path d="M50 29 L50 16 L60 16 L68 23 L68 29 Z" opacity="0.75" />
        <path d="M6 24 L20 16 L34 16" fill="none" strokeWidth="2" stroke="currentColor" opacity="0.5" />
      </g>
    ),
    'car-transporter': (
      <g>
        <path d="M52 29 L52 16 L62 16 L70 23 L70 29 Z" opacity="0.75" />
        <rect x="4" y="24" width="44" height="4" rx="1" />
        <rect x="4" y="12" width="44" height="3" rx="1" opacity="0.6" />
        <path d="M10 24 L10 15 M46 24 L46 15" stroke="currentColor" strokeWidth="2" opacity="0.4" />
        <rect x="12" y="18" width="14" height="6" rx="2" opacity="0.35" />
        <rect x="29" y="18" width="14" height="6" rx="2" opacity="0.35" />
      </g>
    ),
  }

  return (
    <svg viewBox="0 0 76 40" className={`silhouette ${className}`} aria-hidden="true">
      {paths[classId] || paths['bakkie-one']}
      <circle cx="18" cy="31" r="4.5" />
      <circle cx="48" cy="31" r="4.5" />
    </svg>
  )
}
