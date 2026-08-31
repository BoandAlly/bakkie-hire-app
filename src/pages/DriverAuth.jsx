import { useState } from 'react'
import { looksLikeEmail, normalisePhone } from '../lib/session.js'
import Icon from '../components/Icon.jsx'

// Driver accounts sign in with an email + password. The mobile number is asked
// for at registration because it's the contact a customer actually rings — not
// part of the login.
//
// One screen, two modes: "Sign in" for a returning driver, "Create account"
// for a new one. onSignIn / onSignUp return an error code (or null on success)
// so this screen can explain exactly what went wrong.

export default function DriverAuth({ onSignIn, onSignUp, onBack }) {
  const [mode, setMode] = useState('signin')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
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
  }

  const submitSignUp = () => {
    if (!name.trim()) return setError('We need a name to put on your listings.')
    if (normalisePhone(phone).length < 9)
      return setError('That doesn’t look like a full mobile number.')
    if (!looksLikeEmail(email)) return setError('That doesn’t look like an email address.')
    if (password.length < 6) return setError('Use a password of at least 6 characters.')
    const err = onSignUp({ name: name.trim(), phone, email, password })
    if (err === 'exists')
      return setError('An account with that email already exists — sign in instead.')
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
          <Icon name="truck" size={26} />
        </div>

        {signingIn ? (
          <>
            <h1>Driver sign in</h1>
            <p className="onboard-tag">Welcome back. Sign in to your driver account.</p>

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
              New driver?{' '}
              <button className="linkish" onClick={() => swap('register')}>
                Create an account
              </button>
            </p>
          </>
        ) : (
          <>
            <h1>Create your driver account</h1>
            <p className="onboard-tag">
              Takes a minute. Your email and password are how you sign in; your number is
              how customers reach you.
            </p>

            <label className="field spaced">
              <span>Your name</span>
              <input
                value={name}
                placeholder="e.g. Sipho Ndlovu"
                onChange={(e) => setName(e.target.value)}
                onKeyDown={onEnter(submitSignUp)}
                autoFocus
              />
            </label>

            <label className="field spaced">
              <span>Mobile number</span>
              <input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={phone}
                placeholder="082 000 0000"
                onChange={(e) => setPhone(e.target.value)}
                onKeyDown={onEnter(submitSignUp)}
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
              Already registered?{' '}
              <button className="linkish" onClick={() => swap('signin')}>
                Sign in
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
