import Icon from '../components/Icon.jsx'

// The signed-in customer's profile. Only rendered once they're signed in — a
// signed-out customer sees the AuthGate instead.

export default function CustomerAccount({
  customer,
  areaName,
  onChangeArea,
  onBecomeDriver,
  onSignOut,
  onReset,
}) {
  return (
    <div className="screen">
      <header className="screen-head rowed">
        <h1>Account</h1>
        <button className="tab-action" onClick={onBecomeDriver}>
          <Icon name="truck" size={16} />
          I'm a driver
        </button>
      </header>

      <div className="profile">
        <span className="profile-avatar">{initials(customer.name)}</span>
        <span>
          <strong>{customer.name}</strong>
          <em>{customer.email}</em>
        </span>
      </div>

      <section className="panel">
        <h2>Location</h2>
        <button className="linkrow" onClick={onChangeArea}>
          <Icon name="pin" size={20} />
          <span>
            Searching near <strong>{areaName || 'nowhere yet'}</strong>
          </span>
          <Icon name="chevron" size={18} className="dim" />
        </button>
      </section>

      <section className="panel promo">
        <Icon name="truck" size={26} />
        <strong>Got a bakkie or a truck?</strong>
        <p>
          List it, set your own rate and keep every cent you earn. We charge a flat monthly
          fee and take nothing off your jobs.
        </p>
        <button className="btn primary full" onClick={onBecomeDriver}>
          List your vehicle
        </button>
      </section>

      <section className="panel">
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
