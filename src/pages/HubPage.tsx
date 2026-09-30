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
    <div className="page">
      <header className="page-hero compact">
        <p className="brand-mark">Siisti piha</p>
        <h1>Hub-huolto</h1>
        <p className="lede">
          Vuosittaiset tarkastukset
          {summary ? ` · ${summary.year}` : ''}.
          {summary
            ? ` ${summary.openCount} avointa, ${summary.dueCount} ajankohtaista.`
            : ''}
        </p>
        {user?.role === 'admin' && (
          <button className="btn ghost small" type="button" disabled={busy} onClick={() => void seed()}>
            Luo / täydennä vuoden lista
          </button>
        )}
      </header>

      {error && <p className="error">{error}</p>}

      <div className="card-list">
        {items.map((insp) => (
          <Link key={insp.id} className="week-card week-card-link" to={`/huolto/${insp.id}`}>
            <div className="week-card-top">
              <strong>{insp.title}</strong>
              <span className={`pill status-${insp.status}`}>{statusLabel(insp.status)}</span>
            </div>
            <p className="meta">
              {insp.cadenceLabel} · {insp.windowStart} – {insp.windowEnd}
            </p>
            <p className="meta">
              {insp.doneCount}/{insp.itemCount} merkitty
              {insp.issueCount ? ` · ${insp.issueCount} puutetta` : ''}
            </p>
          </Link>
        ))}
      </div>
    </div>
  )
}
