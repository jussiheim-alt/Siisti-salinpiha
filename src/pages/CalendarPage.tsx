import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, type Pihavuoro } from '../api'
import { useAuth } from '../auth'

export function CalendarPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [list, setList] = useState<Pihavuoro[]>([])
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const [publishingId, setPublishingId] = useState<string | null>(null)

  async function load() {
    const data = await api<{ pihavuorot: Pihavuoro[] }>('/api/pihavuorot')
    setList(data.pihavuorot)
  }

  useEffect(() => {
    load().catch((e) => setError(e.message))
  }, [])

  async function createWeek(andPublish: boolean) {
    setCreating(true)
    setError('')
    try {
      const data = await api<{ pihavuoro: Pihavuoro }>('/api/pihavuorot', {
        method: 'POST',
        json: { recommend: true, helperCount: 4 },
      })
      let id = data.pihavuoro.id
      if (andPublish) {
        const pub = await api<{ pihavuoro: Pihavuoro }>(`/api/pihavuorot/${id}/publish`, {
          method: 'POST',
        })
        id = pub.pihavuoro.id
      }
      await load()
      navigate(`/pihavuoro/${id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Luonti epäonnistui')
    } finally {
      setCreating(false)
    }
  }

  async function publish(id: string) {
    setPublishingId(id)
    setError('')
    try {
      await api(`/api/pihavuorot/${id}/publish`, { method: 'POST' })
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Julkaisu epäonnistui')
    } finally {
      setPublishingId(null)
    }
  }

  return (
    <div className="page">
      <header className="page-hero compact">
        <p className="brand-mark">Siisti salin piha</p>
        <h1>Kalenteri</h1>
        <p className="lede">Viikoittaiset Pihavuorot — luonnos tai julkaistu.</p>
      </header>

      {user?.role === 'admin' && (
        <div className="row-actions" style={{ marginBottom: '0.85rem' }}>
          <button
            className="btn primary"
            disabled={creating}
            onClick={() => void createWeek(true)}
          >
            {creating ? 'Luodaan…' : 'Luo ja julkaise viikko'}
          </button>
          <button className="btn" disabled={creating} onClick={() => void createWeek(false)}>
            Luo luonnos
          </button>
          <Link className="btn ghost" to="/esteet">
            Esteviikot
          </Link>
        </div>
      )}

      {error && <p className="error">{error}</p>}

      <div className="card-list">
        {list.map((p) => {
          const mine = p.assignments.find((a) => a.userId === user?.id)
          const lead = p.assignments.find((a) => a.role === 'lead')
          const openCount = p.tasks.filter((t) => t.status === 'open').length
          return (
            <div key={p.id} className="week-card">
              <Link to={`/pihavuoro/${p.id}`} className="week-card-link">
                <div className="week-card-top">
                  <strong>
                    {p.weekStart} – {p.weekEnd}
                  </strong>
                  <span className={`pill status-${p.status}`}>
                    {p.status === 'draft'
                      ? 'Luonnos'
                      : p.status === 'published'
                        ? 'Julkaistu'
                        : 'Valmis'}
                  </span>
                </div>
                <p>
                  {p.season === 'talvi' ? 'Talvi' : 'Sulankausi'} · Vastuu: {lead?.userName || '—'}
                </p>
                <p className="muted">
                  {openCount} avointa tehtävää
                  {mine
                    ? ` · sinä: ${mine.role === 'lead' ? 'vastuuveli' : 'avustaja'}`
                    : ''}
                </p>
              </Link>
              {user?.role === 'admin' && p.status === 'draft' && (
                <div className="row-actions">
                  <button
                    className="btn primary small"
                    disabled={publishingId === p.id}
                    onClick={() => void publish(p.id)}
                  >
                    {publishingId === p.id ? 'Julkaistaan…' : 'Julkaise'}
                  </button>
                  <Link className="btn small" to={`/pihavuoro/${p.id}`}>
                    Tarkista
                  </Link>
                </div>
              )}
            </div>
          )
        })}
        {!list.length && <p className="muted">Ei vuoroja vielä.</p>}
      </div>
    </div>
  )
}
