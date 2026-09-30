import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'

const showDemoHint =
  import.meta.env.DEV || import.meta.env.VITE_DATA_MODE === 'local'

export function LoginPage() {
  const { user, login, loading } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (!loading && user) return <Navigate to="/" replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await login(email, password)
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kirjautuminen epäonnistui')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-shell">
      <div className="login-panel">
        <p className="brand-mark">Siisti piha</p>
        <h1>Tervetuloa</h1>
        <p className="lede">Pihavuorot, tehtävät ja huomiot samassa paikassa.</p>
        <form onSubmit={onSubmit} className="stack">
          <label>
            Sähköposti
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
            />
          </label>
          <label>
            Salasana
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          {error && <p className="error">{error}</p>}
          <button className="btn primary" disabled={busy} type="submit">
            {busy ? 'Kirjaudutaan…' : 'Kirjaudu'}
          </button>
        </form>
        {showDemoHint && (
          <p className="hint">Kehitys: admin@siistipiha.local / admin123</p>
        )}
      </div>
    </div>
  )
}
