import Icon from './Icon.jsx'

// Shown in place of a tab's content when a signed-out customer opens something
// that needs an account. Browsing is never gated — only this handful of screens.

export default function AuthGate({ icon = 'lock', title, message, action, onSignIn, onCreate }) {
  return (
    <div className="screen">
      {action && (
        <div className="gate-topbar">
          <button className="tab-action" onClick={action.onClick}>
            <Icon name={action.icon} size={16} />
            {action.label}
          </button>
        </div>
      )}
      <div className="authgate">
        <span className="authgate-icon">
          <Icon name={icon} size={30} />
        </span>
        <strong>{title}</strong>
        <p>{message}</p>
        <button className="btn primary full" onClick={onSignIn}>
          Sign in
        </button>
        <button className="btn secondary full" onClick={onCreate}>
          Create an account
        </button>
      </div>
    </div>
  )
}
