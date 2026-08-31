import { PLACES } from '../data/places.js'
import Icon from '../components/Icon.jsx'

// Location gate for the customer side.

export default function Landing({ status, onRequest, onManual, onBack }) {
  const blocked = status === 'denied' || status === 'unsupported'

  return (
    <div className="onboard">
      <div className="onboard-inner">
        <button className="onboard-back" onClick={onBack}>
          <Icon name="back" size={18} />
          Back
        </button>

        <div className="logo">
          <Icon name="pin" size={26} />
        </div>
        <h1>Where are you?</h1>
        <p className="onboard-tag">
          We'll show you the bakkies and trucks that actually come to your area.
        </p>

        {!blocked && (
          <button className="btn primary full" onClick={onRequest} disabled={status === 'asking'}>
            {status === 'asking' ? 'Finding you…' : 'Use my location'}
          </button>
        )}

        {blocked && (
          <div className="banner">
            <Icon name="pin" size={19} />
            <span>
              <strong>
                {status === 'unsupported'
                  ? "This browser won't share a location"
                  : 'Location is switched off'}
              </strong>
              <em>No problem — pick your area below instead.</em>
            </span>
          </div>
        )}

        <label className="field spaced">
          <span>{blocked ? 'Your area' : 'Or choose your area'}</span>
          <select defaultValue="" onChange={(e) => onManual(e.target.value)}>
            <option value="" disabled>
              Choose area
            </option>
            {PLACES.map((p) => (
              <option key={p.name}>{p.name}</option>
            ))}
          </select>
        </label>

        {!blocked && (
          <p className="smallprint center">
            We use it once, to sort vehicles by distance. Nothing is stored.
          </p>
        )}
      </div>
    </div>
  )
}
