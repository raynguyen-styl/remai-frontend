import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { errorMessage } from '../api/client'
import { LIMITS } from '../api/types'
import { validateRegistration } from '../lib/validation'
import { returnPath } from '../lib/returnPath'
import { useSession } from '../session/session'
import { useDocumentTitle } from '../ui/useDocumentTitle'

function AuthLayout({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="auth">
      <div className="auth-card">
        <div className="auth-brand" aria-hidden="true">
          <span className="brand-mark">r</span> remai
        </div>
        <h1 className="auth-title">{title}</h1>
        {children}
      </div>
    </main>
  )
}

export function LoginPage() {
  const { api, signIn } = useSession()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  useDocumentTitle('Sign in')

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!email.trim() || !password) {
      setError('Enter your email and password.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const auth = await api.login({ email: email.trim(), password })
      signIn(auth)
      navigate(returnPath(location.state), { replace: true })
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <AuthLayout title="Sign in to remai">
      <form className="auth-form" onSubmit={onSubmit} noValidate>
        <label className="field">
          <span>Email</span>
          <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </label>
        <label className="field">
          <span>Password</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <p className="auth-switch">
        New to remai?{' '}
        <Link to="/register" state={location.state}>
          Create an account
        </Link>
      </p>
    </AuthLayout>
  )
}

export function RegisterPage() {
  const { api, signIn } = useSession()
  const navigate = useNavigate()
  const location = useLocation()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  useDocumentTitle('Create account')

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const invalid = validateRegistration({ email, name, password })
    if (invalid) {
      setError(invalid)
      return
    }
    setBusy(true)
    setError(null)
    try {
      const auth = await api.register({ email: email.trim(), name: name.trim(), password })
      signIn(auth)
      navigate(returnPath(location.state), { replace: true })
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <AuthLayout title="Create your account">
      <form className="auth-form" onSubmit={onSubmit} noValidate>
        <label className="field">
          <span>Name</span>
          <input autoComplete="name" value={name} maxLength={LIMITS.nameMax} onChange={(e) => setName(e.target.value)} required autoFocus />
        </label>
        <label className="field">
          <span>Email</span>
          <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <div className="field">
          <label htmlFor="register-password">Password</label>
          <input
            id="register-password"
            type="password"
            autoComplete="new-password"
            value={password}
            maxLength={LIMITS.passwordMax}
            onChange={(e) => setPassword(e.target.value)}
            aria-describedby="password-hint"
            required
          />
          <small id="password-hint" className="field-hint">
            {LIMITS.passwordMin}–{LIMITS.passwordMax} characters
          </small>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'Creating account…' : 'Create account'}
        </button>
      </form>
      <p className="auth-switch">
        Already have an account?{' '}
        <Link to="/login" state={location.state}>
          Sign in
        </Link>
      </p>
    </AuthLayout>
  )
}
