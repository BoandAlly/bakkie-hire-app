import {
  DOCS,
  DAY_LABELS,
  docsSubmitted,
  verificationState,
  hoursFor,
  withinWorkingHours,
} from '../lib/drivers.js'
import { formatPhone } from '../lib/session.js'
import { shrinkImage } from '../lib/photos.js'
import { driverRatingsReceived, averageRating, timeLabel } from '../lib/threads.js'
import Icon, { Stars } from '../components/Icon.jsx'
import { useState } from 'react'

// Profile, paperwork and what you pay us. Kept off the working screens so the
// driver only comes here when something needs sorting out.

export default function DriverAccount({
  driver,
  listings,
  threads,
  onToggleDoc,
  onUpdateDriver,
  onApprove,
  onSwitchRole,
  onSignOut,
  onReset,
}) {
  const [photoBusy, setPhotoBusy] = useState(false)
  const [photoError, setPhotoError] = useState('')
  const vState = verificationState(driver)
  const hours = hoursFor(driver)
  const working = withinWorkingHours(driver)
  const live = listings.filter((l) => !l.paused).length

  const myIds = new Set(listings.map((l) => l.id))
  const ratings = driverRatingsReceived(threads ?? [], myIds)
  const avg = averageRating(ratings.map((r) => r.rating))

  return (
    <div className="screen">
      <header className="screen-head">
        <h1>Account</h1>
      </header>

      <div className="profile">
        {/* Tapping the avatar is the whole interaction — no separate edit screen
            for one picture. */}
        <label className="profile-avatar editable">
          {driver.photo ? (
            <img src={driver.photo} alt="" />
          ) : (
            <span>{initials(driver.name)}</span>
          )}
          <input
            type="file"
            accept="image/*"
            onChange={async (e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (!file) return
              setPhotoBusy(true)
              try {
                onUpdateDriver({ photo: await shrinkImage(file, { maxPx: 320, quality: 0.8 }) })
                setPhotoError('')
              } catch {
                setPhotoError('That picture couldn’t be read. Try another one.')
              }
              setPhotoBusy(false)
            }}
          />
          <span className="profile-avatar-edit">{photoBusy ? '…' : 'Edit'}</span>
        </label>
        <span>
          <strong>{driver.name}</strong>
          <em>{formatPhone(driver.phone)}</em>
          {!driver.photo && !photoBusy && (
            <em className="profile-nudge">Add a photo so customers know who to expect</em>
          )}
          {photoError && <em className="profile-nudge error">{photoError}</em>}
        </span>
        {vState === 'verified' && (
          <span className="status on">
            <Icon name="shield" size={14} />
            Verified
          </span>
        )}
      </div>

      <section className="panel">
        <h2>Your ratings</h2>
        {ratings.length === 0 ? (
          <p className="panel-hint">
            No ratings yet. After you mark a job done and the customer rates you, their
            score shows up here.
          </p>
        ) : (
          <>
            <div className="ratingsummary">
              <span className="ratingsummary-avg">
                <strong>{avg.toFixed(1)}</strong>
                <Stars value={avg} size={18} />
              </span>
              <em>
                {ratings.length} rating{ratings.length === 1 ? '' : 's'}
              </em>
            </div>
            <div className="list tight">
              {ratings.map((r, i) => (
                <div className="ratingrow" key={i}>
                  <span className="ratingrow-who">
                    <strong>{r.name}</strong>
                    {i === 0 && <em>Most recent · {timeLabel(r.at)}</em>}
                  </span>
                  <span className="ratingrow-score">
                    <Stars value={r.rating} size={15} />
                    <strong>{r.rating.toFixed(1)}</strong>
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      <section className="panel">
        <h2>Verification</h2>
        <p className="panel-hint">
          We check who you are, not how well you work. Customers see a badge saying your ID
          and licence have been checked — nothing beyond that.
        </p>

        {vState !== 'verified' && (
          <div className={vState === 'pending' ? 'banner good' : 'banner'}>
            <Icon name={vState === 'pending' ? 'check' : 'shield'} size={19} />
            <span>
              <strong>
                {vState === 'pending' ? 'Submitted — under review' : 'Not verified yet'}
              </strong>
              <em>
                {vState === 'pending'
                  ? "We'll check it and add the badge to your listings."
                  : `Verified operators win noticeably more work. ${docsSubmitted(driver)} of ${DOCS.length} in.`}
              </em>
            </span>
          </div>
        )}

        <div className="list tight">
          {DOCS.map((d) => (
            <label className="checkrow" key={d.id}>
              <input
                type="checkbox"
                checked={Boolean(driver.docs?.[d.id])}
                onChange={() => onToggleDoc(d.id)}
              />
              <span className="checkrow-body">
                <strong>{d.label}</strong>
                <em>{d.hint}</em>
              </span>
              <span className="checkrow-state">
                {driver.docs?.[d.id] ? 'Sent' : 'Not sent'}
              </span>
            </label>
          ))}
        </div>

        {vState === 'pending' && (
          <button className="btn secondary full" onClick={onApprove}>
            Demo only: approve my verification
          </button>
        )}
      </section>

      <section className="panel">
        <h2>When you work</h2>

        <label className="availrow">
          <span>
            <strong>Available now</strong>
            <em>
              {driver.availableNow
                ? 'Customers looking for someone right away will see you first.'
                : 'Turn this on when you’re sitting and ready for a job.'}
            </em>
          </span>
          <input
            type="checkbox"
            className="switch"
            checked={Boolean(driver.availableNow)}
            onChange={(e) => onUpdateDriver({ availableNow: e.target.checked })}
          />
        </label>

        {/* Separate from the switch above on purpose: the switch is about right
            now, this is the ordinary week people can expect to reach you. */}
        <div className="hoursblock">
          <span className="tripfield-label">Days you work</span>
          <div className="goodsrow">
            {DAY_LABELS.map((label, day) => {
              const on = hours.days.includes(day)
              return (
                <button
                  key={label}
                  className={on ? 'chip on' : 'chip'}
                  aria-pressed={on}
                  onClick={() =>
                    onUpdateDriver({
                      hours: {
                        ...hours,
                        days: on
                          ? hours.days.filter((d) => d !== day)
                          : [...hours.days, day].sort(),
                      },
                    })
                  }
                >
                  {label}
                </button>
              )
            })}
          </div>

          <div className="farecalc-fields">
            <label className="field">
              <span>From</span>
              <input
                type="time"
                value={hours.from}
                onChange={(e) => onUpdateDriver({ hours: { ...hours, from: e.target.value } })}
              />
            </label>
            <label className="field">
              <span>Until</span>
              <input
                type="time"
                value={hours.to}
                onChange={(e) => onUpdateDriver({ hours: { ...hours, to: e.target.value } })}
              />
            </label>
          </div>

          <p className="panel-hint">
            {hours.days.length === 0
              ? 'Pick at least one day, otherwise customers will think you’re never working.'
              : working
                ? 'You’re inside your working hours right now.'
                : 'You’re outside your working hours right now.'}
          </p>
        </div>
      </section>

      <section className="panel">
        <h2>Subscription</h2>
        <div className="planrow">
          <span>
            <strong>Free while we build up drivers</strong>
            <em>
              {live} vehicle{live === 1 ? '' : 's'} live
            </em>
          </span>
          <Icon name="wallet" size={22} />
        </div>
        <p className="panel-hint">
          One flat monthly fee keeps your listings up. No commission, no cut of your jobs —
          whatever you agree with the customer is yours, paid straight to you.
        </p>
      </section>

      <section className="panel">
        <button className="linkrow" onClick={onSwitchRole}>
          <Icon name="compass" size={20} />
          <span>Switch to looking for a vehicle</span>
          <Icon name="chevron" size={18} className="dim" />
        </button>
        <button className="linkrow" onClick={onSignOut}>
          <Icon name="logout" size={20} />
          <span>Sign out</span>
          <Icon name="chevron" size={18} className="dim" />
        </button>
        <button className="linkrow subtle" onClick={onReset}>
          <Icon name="refresh" size={20} />
          <span>Reset demo data</span>
          <Icon name="chevron" size={18} className="dim" />
        </button>
      </section>
    </div>
  )
}

const initials = (name) =>
  name
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase()
