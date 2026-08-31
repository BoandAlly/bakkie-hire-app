import { DOCS, docsSubmitted, verificationState } from '../lib/drivers.js'
import { formatPhone } from '../lib/session.js'
import Icon from '../components/Icon.jsx'

// Profile, paperwork and what you pay us. Kept off the working screens so the
// driver only comes here when something needs sorting out.

export default function DriverAccount({
  driver,
  listings,
  onToggleDoc,
  onApprove,
  onSwitchRole,
  onSignOut,
  onReset,
}) {
  const vState = verificationState(driver)
  const live = listings.filter((l) => !l.paused).length

  return (
    <div className="screen">
      <header className="screen-head">
        <h1>Account</h1>
      </header>

      <div className="profile">
        <span className="profile-avatar">{initials(driver.name)}</span>
        <span>
          <strong>{driver.name}</strong>
          <em>{formatPhone(driver.phone)}</em>
        </span>
        {vState === 'verified' && (
          <span className="status on">
            <Icon name="shield" size={14} />
            Verified
          </span>
        )}
      </div>

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
