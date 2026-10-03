import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { api, type HubInspection, type HubSummary } from '../api'
import { useAuth } from '../auth'

function statusLabel(s: HubInspection['status']) {
  if (s === 'done') return 'Valmis'
  if (s === 'in_progress') return 'Kesken'
  return 'Avoin'
}

export function HubPage() {
  const { user } = useAuth()
  const [items, setItems] = useState<HubInspection[]>([])
  const [summary, setSummary] = useState<HubSummary | null>(null)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [seeding, setSeeding] = useState(false)

  async function load() {
    const data = await api<{ summary: HubSummary; inspections: HubInspection[] }>('/api/hub')
    setItems(data.inspections)
    setSummary(data.summary)
  }

  useEffect(() => {
    if (user?.role !== 'admin') return
    load().catch((e) => setError(e.message))
  }, [user?.role])

  if (user && user.role !== 'admin') return <Navigate to="/" replace />

  async function seed() {
    setSeeding(true)
    setError('')
    try {
      await api('/api/hub/seed', { method: 'POST', json: {} })
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Seed epäonnistui')
    } finally {
      setSeeding(false)
    }
  }

  async function toggleActivate(insp: HubInspection) {
    setBusyId(insp.id)
    setError('')
    try {
      await api(`/api/hub/${insp.id}/${insp.activated ? 'deactivate' : 'activate'}`, {
        method: 'POST',
        json: {},
      })
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Aktivointi epäonnistui')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="page hub-list-page">
      <header className="page-hero compact">
        <p className="brand-mark">Siisti salin piha</p>
        <h1>Huoltokorttien tehtävät</h1>
        <p className="lede">
          Vuosittaiset huoltokortit
          {summary ? ` · ${summary.year}` : ''}. Aktivoi kortti, jotta se näkyy
          viikkovuorossa oleville — vastuuveli merkitsee kohdat tehdyiksi.
        </p>
        <div className="row-actions">
          <Link className="btn ghost small" to="/yllapitaja">
            ← Ylläpitäjä
          </Link>
          <button
            className="btn ghost small"
            type="button"
            disabled={seeding}
            onClick={() => void seed()}
          >
            Luo / täydennä vuoden lista
          </button>
        </div>
      </header>

      {error && <p className="error">{error}</p>}

      {summary && (
        <section className="surface-card hub-summary" aria-label="Yhteenveto">
          <div className="hub-summary-grid">
            <div>
              <span className="hub-summary-value">{summary.activatedCount ?? 0}</span>
              <span className="hub-summary-label">aktiivista</span>
            </div>
            <div>
              <span className="hub-summary-value">{summary.openCount}</span>
              <span className="hub-summary-label">avointa</span>
            </div>
            <div>
              <span className="hub-summary-value">{items.length}</span>
              <span className="hub-summary-label">yhteensä</span>
            </div>
          </div>
        </section>
      )}

      <div className="card-list hub-card-list">
        {items.map((insp) => {
          const progress =
            insp.itemCount > 0 ? Math.round((insp.doneCount / insp.itemCount) * 100) : 0
          return (
            <article key={insp.id} className="hub-list-card hub-admin-card">
              <div className="week-card-top">
                <strong>{insp.title}</strong>
                <span className={`pill ${insp.activated ? 'status-ready' : `status-${insp.status}`}`}>
                  {insp.activated ? 'Aktivoitu vuorolle' : statusLabel(insp.status)}
                </span>
              </div>
              <p className="meta">
                {insp.cadenceLabel} · {insp.windowStart} – {insp.windowEnd}
              </p>
              <div className="hub-list-progress" aria-hidden="true">
                <span style={{ width: `${progress}%` }} />
              </div>
              <p className="meta hub-list-meta">
                {insp.doneCount}/{insp.itemCount} merkitty
                {insp.issueCount ? ` · ${insp.issueCount} puutetta` : ''}
              </p>
              <div className="row-actions">
                <Link className="btn small" to={`/huolto/${insp.id}`}>
                  Avaa kortti
                </Link>
                <button
                  className={`btn small ${insp.activated ? '' : 'primary'}`}
                  type="button"
                  disabled={busyId === insp.id || insp.status === 'done'}
                  onClick={() => void toggleActivate(insp)}
                >
                  {insp.activated ? 'Poista vuorolta' : 'Aktivoi vuorolle'}
                </button>
              </div>
            </article>
          )
        })}
        {!items.length && <p className="muted">Ei huoltokortteja vielä.</p>}
      </div>
    </div>
  )
}
