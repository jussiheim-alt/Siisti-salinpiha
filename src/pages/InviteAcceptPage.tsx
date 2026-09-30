import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { api, setToken } from '../api'
import { useAuth } from '../auth'

type InviteInfo = {
  name: string
  email: string
  role: 'admin' | 'member'
  constraints: string[]
  expiresAt: string
}

export function InviteAcceptPage() {
  const { token } = useParams<{ token: string }>()
  const { user, loading, refresh } = useAuth()
  const navigate = useNavigate()
  const [invite, setInvite] = useState<InviteInfo | null>(null)
  const [error, setError] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!token) return
    api<{ invite: InviteInfo }>(`/api/invites/token/${token}`)
      .then((d) => setInvite(d.invite))
      .catch((e) => setError(e instanceof Error ? e.message : 'Kutsu ei kelpaa'))
  }, [token])

  if (!loading && user) return <Navigate to="/" replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!token) return
    if (password.length < 8) {
      setError('Salasanan oltava vähintään 8 merkkiä')
      return
    }
    if (password !== password2) {
      setError('Salasanat eivät täsmää')
      return
    }
    setBusy(true)
    setError('')
    try {
      const data = await api<{ token: string }>('/api/invites/token/' + token + '/accept', {
        method: 'POST',
        json: { password },
      })
      setToken(data.token)
      await refresh()
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Liittyminen epäonnistui')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-shell">
      <div className="login-panel">
        <p className="brand-mark">Siisti piha</p>
        <h1>Liity mukaan</h1>
        {invite ? (
          <>
            <p className="lede">
              Hei {invite.name}. Sinut on kutsuttu{' '}
              {invite.role === 'admin' ? 'ylläpitäjäksi' : 'jäseneksi'}.
            </p>
            <p className="muted">Sähköposti: {invite.email}</p>
            <form onSubmit={onSubmit} className="stack">
              <label>
                Valitse salasana
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                  minLength={8}
                />
              </label>
              <label>
                Vahvista salasana
                <input
                  type="password"
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                  autoComplete="new-password"
                  required
                  minLength={8}
                />
              </label>
              {error && <p className="error">{error}</p>}
              <button className="btn primary" disabled={busy} type="submit">
                {busy ? 'Luodaan tiliä…' : 'Luo tili ja kirjaudu'}
              </button>
            </form>
          </>
        ) : (
          <>
            {error ? <p className="error">{error}</p> : <p className="lede">Ladataan kutsua…</p>}
            <p>
              <Link to="/kirjaudu">Siirry kirjautumiseen</Link>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
