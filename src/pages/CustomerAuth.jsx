import { useState } from 'react'
import { looksLikeEmail } from '../lib/session.js'
import Icon from '../components/Icon.jsx'

// The customer's sign in — same email + password system as the driver, without
// the paperwork. Reached only when a signed-out customer tries to do something
// that needs an account (message a driver, open Messages or their profile).
//
// onSignIn / onSignUp set the session and return an error code or null. On a
// null (success) we call onAuthed, which sends the customer on to whatever they
// were trying to reach.

export default function CustomerAuth({
  onSignIn,
  onSignUp,
  onDemo,
  onAuthed,
  onBack,
  startMode = 'signin',
  reason = '',
}) {
  const [mode, setMode] = useState(startMode)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const swap = (next) => {
    setMode(next)
    setError('')
  }

  const submitSignIn = () => {
    if (!looksLikeEmail(email)) return setError('That doesn’t look like an email address.')
    if (!password) return setError('Enter your password.')
    const err = onSignIn({ email, password })
    if (err === 'no-account')
      return setError('No account with that email yet — create one below.')
    if (err === 'bad-password') return setError('That password doesn’t match.')
    onAuthed()
  }

  const submitSignUp = () => {
    if (!name.trim()) return setError('What should drivers call you?')
    if (!looksLikeEmail(email)) return setError('That doesn’t look like an email address.')
    if (password.length < 6) return setError('Use a password of at least 6 characters.')
    const err = onSignUp({ name: name.trim(), email, password })
    if (err === 'exists')
      return setError('An account with that email already exists — sign in instead.')
    onAuthed()
  }

  const onEnter = (fn) => (e) => e.key === 'Enter' && fn()
  const signingIn = mode === 'signin'

  return (
    <div className="onboard">
      <div className="onboard-inner">
        <button className="onboard-back" onClick={onBack}>
          <Icon name="back" size={18} />
          Back
        </button>

        <div className="logo">
          <Icon name="user" size={26} />
        </div>

        {signingIn ? (
          <>
            <h1>Sign in</h1>
            <p className="onboard-tag">{reason || 'Sign in to your account.'}</p>

            <label className="field spaced">
              <span>Email</span>
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                placeholder="you@example.com"
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={onEnter(submitSignIn)}
                autoFocus
              />
            </label>

            <label className="field spaced">
              <span>Password</span>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                placeholder="Your password"
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={onEnter(submitSignIn)}
              />
            </label>

            {error && <p className="hint bad">{error}</p>}

            <button className="btn primary full" onClick={submitSignIn}>
              Sign in
            </button>

            <p className="smallprint center">
              New here?{' '}
              <button className="linkish" onClick={() => swap('register')}>
                Create an account
              </button>
            </p>
          </>
        ) : (
          <>
            <h1>Create your account</h1>
            <p className="onboard-tag">
              {reason || 'It only takes a moment, and browsing stays free.'}
            </p>

            <label className="field spaced">
              <span>Your name</span>
              <input
                value={name}
                placeholder="e.g. Thandi Mokoena"
                onChange={(e) => setName(e.target.value)}
                onKeyDown={onEnter(submitSignUp)}
                autoFocus
              />
            </label>

            <label className="field spaced">
              <span>Email</span>
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                placeholder="you@example.com"
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={onEnter(submitSignUp)}
              />
            </label>

            <label className="field spaced">
              <span>Password</span>
              <input
                type="password"
                autoComplete="new-password"
                value={password}
                placeholder="At least 6 characters"
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={onEnter(submitSignUp)}
              />
            </label>

            {error && <p className="hint bad">{error}</p>}

            <button className="btn primary full" onClick={submitSignUp}>
              Create account
            </button>

            <p className="smallprint center">
              Already have an account?{' '}
              <button className="linkish" onClick={() => swap('signin')}>
                Sign in
              </button>
            </p>
          </>
        )}

        {onDemo && (
          <div className="demo-cta">
            <span className="demo-or">or just try it</span>
            <button
              type="button"
              className="btn secondary full"
              onClick={() => {
                onDemo()
                onAuthed()
              }}
            >
              <Icon name="play" size={15} />
              Use the demo account
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
