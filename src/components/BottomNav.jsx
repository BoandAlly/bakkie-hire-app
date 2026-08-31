import Icon from './Icon.jsx'

// Persistent bottom tabs — the single biggest thing that makes this read as an
// app rather than a website. Everything top-level is one thumb-reach away
// instead of hidden behind a hamburger.
//
// Three or four destinations only. Past five, tap targets get too narrow and
// labels start truncating on a 360px phone.

const CUSTOMER_TABS = [
  { id: 'explore', label: 'Explore', icon: 'compass' },
  { id: 'messages', label: 'Messages', icon: 'message' },
  { id: 'account', label: 'Account', icon: 'user' },
]

const DRIVER_TABS = [
  { id: 'enquiries', label: 'Enquiries', icon: 'inbox' },
  { id: 'vehicles', label: 'Vehicles', icon: 'truck' },
  { id: 'account', label: 'Account', icon: 'user' },
]

export default function BottomNav({ role, active, badges = {}, onSelect }) {
  const tabs = role === 'driver' ? DRIVER_TABS : CUSTOMER_TABS

  return (
    <nav className="bottomnav" aria-label="Main">
      {tabs.map((t) => {
        const on = active === t.id
        const badge = badges[t.id] ?? 0
        return (
          <button
            key={t.id}
            className={on ? 'tab on' : 'tab'}
            onClick={() => onSelect(t.id)}
            aria-current={on ? 'page' : undefined}
          >
            <span className="tab-icon">
              <Icon name={t.icon} size={23} strokeWidth={on ? 2.3 : 1.9} />
              {badge > 0 && <span className="tab-badge">{badge > 9 ? '9+' : badge}</span>}
            </span>
            <span className="tab-label">{t.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
