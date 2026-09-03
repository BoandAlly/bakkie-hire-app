import { useMemo, useState } from 'react'
import { placeByName } from '../data/places.js'
import { VEHICLE_CLASSES, classById, VehicleSilhouette } from '../data/vehicleClasses.jsx'
import { rateLabel, quote } from '../lib/pricing.js'
import { roadKm } from '../lib/geo.js'
import Icon, { StarIcon } from '../components/Icon.jsx'

// Everything within reach, sorted however the customer wants to look at it.

// Per-km and per-hour rates can't be compared head-to-head, so "cheapest first"
// prices a standard short move for every listing and compares the rand total.
const REFERENCE_KM = 10

// Nearest-first is the natural default when you're just browsing what's around.
const DEFAULT_SORT = 'near'

const SORTS = [
  { id: 'near', label: 'Nearest' },
  { id: 'price', label: 'Cheapest' },
  { id: 'rating', label: 'Top rated' },
  { id: 'payload', label: 'Biggest load' },
]

// "Will my load fit?" — filter by how much weight the vehicle can carry, kg.
const PAYLOADS = [
  { kg: 0, label: 'Any load' },
  { kg: 500, label: '500 kg+' },
  { kg: 1000, label: '1 ton+' },
  { kg: 2000, label: '2 ton+' },
  { kg: 4000, label: '4 ton+' },
]

// How far the customer is willing to look. Opens unrestricted and narrows on
// request — a fixed default hides most of the market and reads as an empty app.
const RADII = [
  { km: 0, label: 'Any distance' },
  { km: 5, label: 'Within 5 km' },
  { km: 10, label: 'Within 10 km' },
  { km: 25, label: 'Within 25 km' },
  { km: 50, label: 'Within 50 km' },
]

export default function Nearby({ listings, coords, areaName, onOpen, onChangeArea, ratings = {} }) {
  const [query, setQuery] = useState('')
  const [classFilter, setClassFilter] = useState('')
  const [roundTripOnly, setRoundTripOnly] = useState(false)
  const [insuredOnly, setInsuredOnly] = useState(false)
  const [helpersOnly, setHelpersOnly] = useState(false)
  const [minPayload, setMinPayload] = useState(0)
  const [radiusKm, setRadiusKm] = useState(0)
  const [sort, setSort] = useState(DEFAULT_SORT)
  // All the filters live behind one button now, so the list is what you see first.
  const [filtersOpen, setFiltersOpen] = useState(false)

  const rows = useMemo(() => {
    if (!coords) return []
    const q = query.trim().toLowerCase()

    const scored = listings
      .map((l) => {
        // The driver's exact pin if they dropped one on the coverage map,
        // otherwise the centroid of their suburb.
        const base = l.baseCoords ?? placeByName(l.baseLocation)
        return {
          listing: l,
          km: base ? roadKm(coords, base) : null,
          // "Cheapest" prices a standard short move so per-km and per-hour
          // drivers can be compared on one rand total.
          refPrice: quote(l, { distanceKm: REFERENCE_KM })?.total ?? Infinity,
        }
      })
      // An operator who won't travel this far isn't available to this customer.
      .filter(({ listing, km }) => km != null && km <= listing.serviceRadiusKm)
      // ...and inside the distance the customer asked for.
      .filter(({ km }) => (radiusKm ? km <= radiusKm : true))
      .filter(({ listing }) => (classFilter ? listing.vehicleClass === classFilter : true))
      .filter(({ listing }) => (roundTripOnly ? listing.roundTrip : true))
      .filter(({ listing }) => (insuredOnly ? listing.gitInsured : true))
      .filter(({ listing }) => (helpersOnly ? listing.helpersAvailable > 0 : true))
      .filter(({ listing }) => (minPayload ? listing.payloadKg >= minPayload : true))
      .filter(({ listing }) => (q ? matches(listing, q) : true))

    const byNear = (a, b) => a.km - b.km
    scored.sort((a, b) => {
      switch (sort) {
        case 'price':
          return a.refPrice - b.refPrice || byNear(a, b)
        case 'rating':
          return scoreOf(b.listing, ratings) - scoreOf(a.listing, ratings) || byNear(a, b)
        case 'payload':
          return b.listing.payloadKg - a.listing.payloadKg || byNear(a, b)
        default:
          return byNear(a, b)
      }
    })
    return scored
  }, [
    listings,
    coords,
    query,
    classFilter,
    roundTripOnly,
    insuredOnly,
    helpersOnly,
    minPayload,
    radiusKm,
    ratings,
    sort,
  ])

  // How many chip filters are on, shown as a badge on the Filters button.
  const activeCount =
    (classFilter ? 1 : 0) +
    (roundTripOnly ? 1 : 0) +
    (insuredOnly ? 1 : 0) +
    (helpersOnly ? 1 : 0) +
    (minPayload ? 1 : 0) +
    (radiusKm ? 1 : 0)

  const filtersActive = !!query || activeCount > 0 || sort !== DEFAULT_SORT

  const clearAll = () => {
    setQuery('')
    setClassFilter('')
    setRoundTripOnly(false)
    setInsuredOnly(false)
    setHelpersOnly(false)
    setMinPayload(0)
    setRadiusKm(0)
    setSort(DEFAULT_SORT)
  }

  return (
    <div className="screen wide">
      <header className="screen-head">
        <h1>Find a vehicle</h1>
        <button className="locationbtn" onClick={onChangeArea}>
          <Icon name="pin" size={17} />
          <span>{areaName}</span>
          <Icon name="chevron" size={15} className="dim" />
        </button>
      </header>

      <div className="searchbar">
        <Icon name="search" size={18} className="dim" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search vehicle, driver or type"
          aria-label="Search listings"
        />
        {query && (
          <button className="searchclear" onClick={() => setQuery('')} aria-label="Clear search">
            <Icon name="close" size={16} />
          </button>
        )}
      </div>

      {/* One button holds every filter, so the vehicle list is the first thing
          you see rather than four rows of chips. */}
      <div className="filterbar">
        <button
          className={filtersOpen ? 'filterbtn on' : 'filterbtn'}
          onClick={() => setFiltersOpen((v) => !v)}
          aria-expanded={filtersOpen}
        >
          <Icon name="sort" size={17} />
          <span>Filters</span>
          {activeCount > 0 && <span className="count">{activeCount}</span>}
          <Icon name="chevron" size={15} className="dim" />
        </button>
      </div>

      {filtersOpen && (
        <div className="filterpanel">
          <div className="filtergroup">
            <span className="filterlabel">Vehicle type</span>
            <div className="chiprow" role="group" aria-label="Filter by vehicle type">
              <button
                className={classFilter === '' ? 'chip on' : 'chip'}
                onClick={() => setClassFilter('')}
                aria-pressed={classFilter === ''}
              >
                All
              </button>
              {VEHICLE_CLASSES.map((c) => (
                <button
                  key={c.id}
                  className={classFilter === c.id ? 'chip on' : 'chip'}
                  onClick={() => setClassFilter(c.id)}
                  aria-pressed={classFilter === c.id}
                >
                  <VehicleSilhouette classId={c.id} />
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          <div className="filtergroup">
            <span className="filterlabel">Features</span>
            <div className="chiprow" role="group" aria-label="More filters">
              <button
                className={roundTripOnly ? 'chip on' : 'chip'}
                onClick={() => setRoundTripOnly((v) => !v)}
                aria-pressed={roundTripOnly}
              >
                <Icon name="refresh" size={15} />
                Round trip
              </button>
              <button
                className={insuredOnly ? 'chip on' : 'chip'}
                onClick={() => setInsuredOnly((v) => !v)}
                aria-pressed={insuredOnly}
              >
                <Icon name="shield" size={15} />
                Insured
              </button>
              <button
                className={helpersOnly ? 'chip on' : 'chip'}
                onClick={() => setHelpersOnly((v) => !v)}
                aria-pressed={helpersOnly}
              >
                <Icon name="users" size={15} />
                Has helpers
              </button>
            </div>
          </div>

          <div className="filtergroup">
            <span className="filterlabel">Load</span>
            <div className="chiprow" role="group" aria-label="Minimum load capacity">
              {PAYLOADS.map((p) => (
                <button
                  key={p.kg}
                  className={minPayload === p.kg ? 'chip on' : 'chip'}
                  onClick={() => setMinPayload(p.kg)}
                  aria-pressed={minPayload === p.kg}
                >
                  {p.kg > 0 && <Icon name="box" size={15} />}
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="filtergroup">
            <span className="filterlabel">Distance</span>
            <div className="chiprow" role="group" aria-label="Distance">
              {RADII.map((r) => (
                <button
                  key={r.km}
                  className={radiusKm === r.km ? 'chip on' : 'chip'}
                  onClick={() => setRadiusKm(r.km)}
                  aria-pressed={radiusKm === r.km}
                >
                  {r.km > 0 && <Icon name="pin" size={15} />}
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {filtersActive && (
            <button className="clearlink" onClick={clearAll}>
              Clear all filters
            </button>
          )}
        </div>
      )}

      <div className="resultbar">
        <p className="resultcount">
          {rows.length} available{classFilter ? ` · ${classById(classFilter)?.name}` : ''}
          {minPayload > 0 ? ` · ${PAYLOADS.find((p) => p.kg === minPayload)?.label}` : ''}
          {filtersActive && (
            <button className="clearlink" onClick={clearAll}>
              Clear all
            </button>
          )}
        </p>
        <label className="sortsel">
          <Icon name="sort" size={16} className="dim" />
          <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort listings">
            {SORTS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="est-note">
        <Icon name="wallet" size={14} />
        Prices shown are estimates — a driver&rsquo;s actual price may be higher or lower.
      </p>

      {rows.length === 0 ? (
        <div className="blank">
          <Icon name="truck" size={30} />
          <strong>{query ? 'No matches' : 'Nothing in range here'}</strong>
          <p>
            {query
              ? 'Try a different search, or clear your filters.'
              : 'Try another vehicle type, or search from a different area.'}
          </p>
          {filtersActive && (
            <button className="btn secondary" onClick={clearAll}>
              Clear all filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid">
          {rows.map(({ listing, km }) => (
            <VehicleCard
              key={listing.id}
              listing={listing}
              km={km}
              rated={ratings[listing.id]}
              onOpen={() => onOpen(listing.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// Match against the things a customer would actually type: what it is, who runs
// it, and the vehicle category name.
function matches(listing, q) {
  const hay = [
    listing.title,
    listing.ownerName,
    listing.baseLocation,
    classById(listing.vehicleClass)?.name,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return hay.includes(q)
}

// A listing shows its real customer average once it has one. Until then it
// keeps its seeded star, labelled 'No ratings yet' so the number is not read
// as something the driver earned.
function scoreOf(listing, ratings) {
  return ratings[listing.id]?.average ?? listing.rating
}

function VehicleCard({ listing, km, onOpen, rated }) {
  const cls = classById(listing.vehicleClass)
  return (
    <button
      className="card"
      onClick={onOpen}
      aria-label={`${listing.title}, ${cls?.name}, ${km} km away, ${rateLabel(listing)}`}
    >
      <span className="card-photo">
        {listing.photos?.[0] ? (
          <img src={listing.photos[0]} alt="" />
        ) : (
          <span className="ph">
            <VehicleSilhouette classId={listing.vehicleClass} />
          </span>
        )}
        {listing.gitInsured && (
          <span className="card-badge">
            <Icon name="shield" size={13} />
            Insured
          </span>
        )}
      </span>

      <span className="card-body">
        <span className="card-top">
          <strong>{cls?.name}</strong>
          <span className={rated ? 'rating' : 'rating unrated'}>
            <StarIcon size={14} />
            {(rated?.average ?? listing.rating).toFixed(1)}
            <em>{rated ? `(${rated.count})` : 'No ratings yet'}</em>
          </span>
        </span>

        <span className="card-title">{listing.title}</span>

        <span className="card-meta">
          {km} km away · {listing.payloadKg.toLocaleString('en-ZA')} kg
          {listing.helpersAvailable > 0 &&
            ` · ${listing.helpersAvailable} helper${listing.helpersAvailable > 1 ? 's' : ''}`}
        </span>

        <span className="card-bottom">
          <span className="card-rate">{rateLabel(listing)}</span>
          {listing.roundTrip && (
            <span className="pill">
              <Icon name="refresh" size={12} />
              Round trip
            </span>
          )}
        </span>
      </span>
    </button>
  )
}
