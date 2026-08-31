import { useMemo, useState } from 'react'
import { placeByName } from '../data/places.js'
import { VEHICLE_CLASSES, classById, VehicleSilhouette } from '../data/vehicleClasses.jsx'
import { rateLabel } from '../lib/pricing.js'
import { roadKm } from '../lib/geo.js'
import Icon, { StarIcon } from '../components/Icon.jsx'

// Everything within reach, nearest first.

export default function Nearby({ listings, coords, areaName, onOpen, onChangeArea }) {
  const [classFilter, setClassFilter] = useState('')

  const rows = useMemo(() => {
    if (!coords) return []
    return listings
      .map((l) => {
        const base = placeByName(l.baseLocation)
        return { listing: l, km: base ? roadKm(coords, base) : null }
      })
      // An operator who won't travel this far isn't available to this customer.
      .filter(({ listing, km }) => km != null && km <= listing.serviceRadiusKm)
      .filter(({ listing }) => (classFilter ? listing.vehicleClass === classFilter : true))
      .sort((a, b) => a.km - b.km)
  }, [listings, coords, classFilter])

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

      <p className="resultcount">
        {rows.length} available{classFilter ? ` · ${classById(classFilter)?.name}` : ''}
      </p>

      {rows.length === 0 ? (
        <div className="blank">
          <Icon name="truck" size={30} />
          <strong>Nothing in range here</strong>
          <p>Try another vehicle type, or search from a different area.</p>
        </div>
      ) : (
        <div className="grid">
          {rows.map(({ listing, km }) => (
            <VehicleCard
              key={listing.id}
              listing={listing}
              km={km}
              onOpen={() => onOpen(listing.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function VehicleCard({ listing, km, onOpen }) {
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
          <span className="rating">
            <StarIcon size={14} />
            {listing.rating.toFixed(1)}
          </span>
        </span>

        <span className="card-title">{listing.title}</span>

        <span className="card-meta">
          {km} km away · {listing.payloadKg.toLocaleString('en-ZA')} kg
          {listing.helpersAvailable > 0 &&
            ` · ${listing.helpersAvailable} helper${listing.helpersAvailable > 1 ? 's' : ''}`}
        </span>

        <span className="card-rate">{rateLabel(listing)}</span>
      </span>
    </button>
  )
}
