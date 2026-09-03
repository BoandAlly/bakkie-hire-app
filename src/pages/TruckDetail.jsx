import { useState } from 'react'
import { placeByName } from '../data/places.js'
import { classById, VehicleSilhouette } from '../data/vehicleClasses.jsx'
import { rateLabel, rand, quote } from '../lib/pricing.js'
import { roadKm } from '../lib/geo.js'
import Icon, { StarIcon } from '../components/Icon.jsx'

// Everything a customer needs to decide, and one button. Dates, times and the
// final price get sorted out in the chat, not here.

export default function TruckDetail({
  listing,
  coords,
  onBack,
  onMessage,
  signedIn = true,
  rated = null,
  ownerPhoto = '',
}) {
  const [photoIndex, setPhotoIndex] = useState(0)
  const cls = classById(listing.vehicleClass)
  const base = placeByName(listing.baseLocation)
  const km = base && coords ? roadKm(coords, base) : null

  // Rates in different units aren't comparable at a glance, so show what a
  // typical short move works out to. A guide, not a quote.
  const guide = quote(listing, { distanceKm: 10, helpers: 0 })
  const photos = listing.photos ?? []
  const firstName = listing.ownerName.split(' ')[0]

  return (
    <div className="detail">
      <div className="hero">
        {photos.length > 0 ? (
          <img src={photos[photoIndex]} alt={listing.title} />
        ) : (
          <span className="ph tall">
            <VehicleSilhouette classId={listing.vehicleClass} />
          </span>
        )}
        <button className="hero-back" onClick={onBack} aria-label="Back">
          <Icon name="back" size={21} />
        </button>
      </div>

      {photos.length > 1 && (
        <div className="thumbstrip">
          {photos.map((src, i) => (
            <button
              key={i}
              className={i === photoIndex ? 'thumbpick on' : 'thumbpick'}
              onClick={() => setPhotoIndex(i)}
              aria-label={`Photo ${i + 1}`}
            >
              <img src={src} alt="" />
            </button>
          ))}
        </div>
      )}

      <div className="detail-body">
        <span className="tag">{cls?.name}</span>
        <h1>{listing.title}</h1>

        <div className="ownerline">
          <span className="avatar sm">
            {ownerPhoto ? (
              <img src={ownerPhoto} alt="" />
            ) : (
              initials(listing.ownerName)
            )}
          </span>
          <span>
            <strong>{listing.ownerName}</strong>
            <em>
              {listing.baseLocation}
              {km != null && ` · ${km} km away`}
            </em>
          </span>
          {/* The count used to show jobs completed, which reads as a number of
              ratings and isn't one. It's the real rating count, or nothing. */}
          <span className={rated ? 'rating' : 'rating unrated'}>
            <StarIcon size={15} />
            {(rated?.average ?? listing.rating).toFixed(1)}
            <em>
              {rated
                ? `from ${rated.count} ${rated.count === 1 ? 'trip' : 'trips'}`
                : 'No ratings yet'}
            </em>
          </span>
        </div>

        {listing.verified && (
          <div className="banner good">
            <Icon name="shield" size={19} />
            <span>
              <strong>ID &amp; licence checked</strong>
              <em>We verified who this operator is, not how well they work.</em>
            </span>
          </div>
        )}

        <div className="pricecard">
          <span>
            <strong>{rateLabel(listing)}</strong>
            {guide && <em>about {rand(guide.total)} for a short 10 km move</em>}
          </span>
        </div>
        <p className="est-note">
          <Icon name="wallet" size={14} />
          Prices shown are estimates — {firstName}&rsquo;s actual price may be higher or lower.
        </p>

        <h2>Specs</h2>
        <div className="specgrid">
          <Spec icon="ruler" label="Load bed" value={`${listing.bedLengthM} × ${listing.bedWidthM} m`} />
          <Spec icon="box" label="Can carry" value={`${listing.payloadKg.toLocaleString('en-ZA')} kg`} />
          <Spec
            icon="users"
            label="Helpers"
            value={
              listing.helpersAvailable > 0
                ? `${listing.helpersAvailable} at ${rand(listing.helperRate)}`
                : 'Driver only'
            }
          />
          <Spec icon="route" label="Travels" value={`Up to ${listing.serviceRadiusKm} km`} />
          <Spec
            icon="shield"
            label="Insurance"
            value={listing.gitInsured ? `To ${rand(listing.gitCoverAmount)}` : 'None'}
            warn={!listing.gitInsured}
          />
          <Spec
            icon="wallet"
            label="Minimum"
            value={listing.minCharge ? rand(listing.minCharge) : 'None'}
          />
        </div>

        <h2>What it has</h2>
        <ul className="features">
          <Feature on={listing.features.canopy}>Enclosed body / canopy</Feature>
          <Feature on={listing.features.tailLift}>Tail-lift</Feature>
          <Feature on={listing.features.trailer}>Trailer</Feature>
          <Feature on={listing.features.straps}>Straps &amp; blankets</Feature>
          <Feature on={listing.roundTrip}>Round trip — will bring you back home</Feature>
        </ul>

        {!listing.gitInsured && (
          <div className="banner warn">
            <Icon name="shield" size={19} />
            <span>
              <strong>No goods-in-transit cover</strong>
              <em>Your load travels at your own risk with this operator.</em>
            </span>
          </div>
        )}

        <p className="smallprint">
          Arrange the date, time and price directly with {firstName}. Payment is between the
          two of you — cash or EFT, whatever you agree. Bakkie Hire never handles it.
        </p>
      </div>

      <div className="actionbar">
        {signedIn ? (
          <button className="btn primary full" onClick={() => onMessage(listing.id)}>
            <Icon name="message" size={20} />
            Message {firstName}
          </button>
        ) : (
          <button className="btn primary full locked" onClick={() => onMessage(listing.id)}>
            <Icon name="lock" size={19} />
            Sign in to message {firstName}
          </button>
        )}
      </div>
    </div>
  )
}

const Spec = ({ icon, label, value, warn }) => (
  <div className={warn ? 'spec warn' : 'spec'}>
    <Icon name={icon} size={18} />
    <span>{label}</span>
    <strong>{value}</strong>
  </div>
)

const Feature = ({ on, children }) => (
  <li className={on ? 'on' : 'off'}>
    <Icon name={on ? 'check' : 'minus'} size={18} />
    {children}
  </li>
)

const initials = (name) =>
  name
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase()
