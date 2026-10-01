import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, type HubInspection, type HubSummary } from '../api'
import { useAuth } from '../auth'

function statusLabel(s: HubInspection['status']) {
  if (s === 'done') return 'Valmis'
  if (s === 'in_progress') return 'Kesken'
  return 'Avoin'
}

function defaultWindow() {
  const year = new Date().getFullYear()
  return { start: `${year}-04-01`, end: `${year}-10-31` }
}

export function HubPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [items, setItems] = useState<HubInspection[]>([])
  const [summary, setSummary] = useState<HubSummary | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [creating, setCreating] = useState(false)
  const win = defaultWindow()
  const [title, setTitle] = useState('')
  const [cadenceLabel, setCadenceLabel] = useState('Kerran vuodessa')
  const [windowStart, setWindowStart] = useState(win.start)
  const [windowEnd, setWindowEnd] = useState(win.end)
  const [intro, setIntro] = useState('')
  const [itemsText, setItemsText] = useState('')

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

  async function createInspection(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const data = await api<{ inspection: HubInspection }>('/api/hub', {
        method: 'POST',
        json: {
          title,
          cadenceLabel,
          windowStart,
          windowEnd,
          intro,
          itemsText,
        },
      })
      setCreating(false)
      setTitle('')
      setIntro('')
      setItemsText('')
      navigate(`/huolto/${data.inspection.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Luonti epäonnistui')
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
          <div className="row-actions" style={{ marginTop: '0.65rem' }}>
            <button
              className="btn primary small"
              type="button"
              disabled={busy}
              onClick={() => setCreating((v) => !v)}
            >
              {creating ? 'Sulje lomake' : 'Lisää tarkastuskortti'}
            </button>
            <button
              className="btn ghost small"
              type="button"
              disabled={busy}
              onClick={() => void seed()}
            >
              Täydennä oletuslista
            </button>
          </div>
        )}
      </header>

      {error && <p className="error">{error}</p>}

      {creating && user?.role === 'admin' && (
        <form className="surface-card hub-create stack" onSubmit={(e) => void createInspection(e)}>
          <p className="kicker">Uusi kortti</p>
          <h2>Lisää tarkastus</h2>
          <label>
            Otsikko
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="Esim. Asfaltti ja kulkuväylät"
            />
          </label>
          <label>
            Jakso / rytmi
            <input
              value={cadenceLabel}
              onChange={(e) => setCadenceLabel(e.target.value)}
              placeholder="Kerran vuodessa"
            />
          </label>
          <div className="hub-date-row">
            <label>
              Alkaa
              <input
                type="date"
                value={windowStart}
                onChange={(e) => setWindowStart(e.target.value)}
                required
              />
            </label>
            <label>
              Päättyy
              <input
                type="date"
                value={windowEnd}
                onChange={(e) => setWindowEnd(e.target.value)}
                required
              />
            </label>
          </div>
          <label>
            Taustateksti (valinnainen)
            <textarea
              rows={2}
              value={intro}
              onChange={(e) => setIntro(e.target.value)}
              placeholder="Lyhyt ohje tarkastukseen"
            />
          </label>
          <label>
            Tarkistuskohdat (yksi per rivi)
            <textarea
              rows={5}
              value={itemsText}
              onChange={(e) => setItemsText(e.target.value)}
              placeholder={'Poista kasvillisuus asfaltin raoista\nTarkista seisova vesi'}
            />
          </label>
          <button className="btn primary" type="submit" disabled={busy || !title.trim()}>
            Luo kortti
          </button>
        </form>
      )}

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
