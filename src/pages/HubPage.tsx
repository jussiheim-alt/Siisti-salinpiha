import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
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
  const [busy, setBusy] = useState(false)

  async function load() {
    const data = await api<{ summary: HubSummary; inspections: HubInspection[] }>('/api/hub')
    setItems(data.inspections)
    setSummary(data.summary)
  }

  useEffect(() => {
    load().catch((e) => setError(e.message))
  }, [])

  async function seed() {
    setBusy(true)
    setError('')
    try {
      await api('/api/hub/seed', { method: 'POST', json: {} })
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Seed epäonnistui')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page hub-list-page">
      <header className="page-hero compact">
        <p className="brand-mark">Siisti salin piha</p>
        <h1>Hub-huolto</h1>
        <p className="lede">
          Vuosittaiset tarkastukset
          {summary ? ` · ${summary.year}` : ''}.
          {summary
            ? ` ${summary.openCount} avointa, ${summary.dueCount} ajankohtaista.`
            : ''}
        </p>
        {user?.role === 'admin' && (
          <button
            className="btn ghost small"
            type="button"
            disabled={busy}
            onClick={() => void seed()}
          >
            Luo / täydennä vuoden lista
          </button>
        )}
      </header>

      {error && <p className="error">{error}</p>}

      {summary && (
        <section className="surface-card hub-summary" aria-label="Yhteenveto">
          <div className="hub-summary-grid">
            <div>
              <span className="hub-summary-value">{summary.openCount}</span>
              <span className="hub-summary-label">avointa</span>
            </div>
            <div>
              <span className="hub-summary-value">{summary.dueCount}</span>
              <span className="hub-summary-label">ajankohtaista</span>
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
            <Link key={insp.id} className="hub-list-card" to={`/huolto/${insp.id}`}>
              <div className="week-card-top">
                <strong>{insp.title}</strong>
                <span className={`pill status-${insp.status}`}>{statusLabel(insp.status)}</span>
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
            </Link>
          )
        })}
        {!items.length && <p className="muted">Ei tarkastuksia vielä.</p>}
      </div>
    </div>
  )
}
