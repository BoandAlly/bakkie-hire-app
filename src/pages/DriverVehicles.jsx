import { classById, VehicleSilhouette } from '../data/vehicleClasses.jsx'
import { rateLabel, rand } from '../lib/pricing.js'
import Icon, { StarIcon } from '../components/Icon.jsx'

// Manage what's listed. A paused vehicle keeps its history but disappears from
// customer search — for when the truck is in for repairs or you're away.

export default function DriverVehicles({ listings, onEdit, onAdd, onTogglePause, onDelete }) {
  return (
    <div className="screen">
      <header className="screen-head">
        <h1>Your vehicles</h1>
        <p className="sub">
          {listings.length} listed · {listings.filter((l) => !l.paused).length} live
        </p>
      </header>

      {listings.length === 0 ? (
        <div className="blank">
          <Icon name="truck" size={30} />
          <strong>No vehicles yet</strong>
          <p>Nobody can find you until you list one. It takes a few minutes.</p>
          <button className="btn primary" onClick={onAdd}>
            <Icon name="plus" size={19} />
            List a vehicle
          </button>
        </div>
      ) : (
        <>
          <div className="list">
            {listings.map((l) => (
              <article className={l.paused ? 'vcard paused' : 'vcard'} key={l.id}>
                <div className="vcard-top">
                  <span className="vcard-photo">
                    {l.photos?.[0] ? (
                      <img src={l.photos[0]} alt="" />
                    ) : (
                      <VehicleSilhouette classId={l.vehicleClass} />
                    )}
                  </span>

                  <div className="vcard-info">
                    <span className={l.paused ? 'status off' : 'status on'}>
                      {l.paused ? 'Paused' : 'Live'}
                    </span>
                    <strong>{l.title}</strong>
                    <p className="sub">{classById(l.vehicleClass)?.name}</p>
                    <p className="rate">
                      {rateLabel(l)}
                      {l.minCharge > 0 && <em> · min {rand(l.minCharge)}</em>}
                    </p>
                  </div>
                </div>

                <div className="vcard-stats">
                  <span>
                    <Icon name="eye" size={15} />
                    {l.views ?? 0} view{(l.views ?? 0) === 1 ? '' : 's'}
                  </span>
                  <span>
                    <Icon name="check" size={15} />
                    {l.jobsCompleted} job{l.jobsCompleted === 1 ? '' : 's'}
                  </span>
                  {l.rating > 0 && (
                    <span>
                      <StarIcon size={14} />
                      {l.rating.toFixed(1)}
                    </span>
                  )}
                </div>

                <div className="vcard-actions">
                  <button onClick={() => onEdit(l.id)}>
                    <Icon name="edit" size={17} />
                    Edit
                  </button>
                  <button onClick={() => onTogglePause(l.id)}>
                    <Icon name={l.paused ? 'play' : 'pause'} size={17} />
                    {l.paused ? 'Go live' : 'Pause'}
                  </button>
                  <button className="danger" onClick={() => onDelete(l.id)}>
                    <Icon name="trash" size={17} />
                    Remove
                  </button>
                </div>
              </article>
            ))}
          </div>

          <button className="btn secondary full" onClick={onAdd}>
            <Icon name="plus" size={19} />
            Add another vehicle
          </button>
        </>
      )}
    </div>
  )
}
