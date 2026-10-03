import { useEffect, useState } from 'react'
import { getISOWeek, parseISO } from 'date-fns'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'
import { formatWeekRangeFi } from '../shared/datetime'

type WeekRow = {
  weekStart: string
  weekEnd: string
  blocked: boolean
  published: boolean
  myRole: string | null
}

type SummaryWeek = {
  weekStart: string
  weekEnd: string
  blockedUsers: { id: string; name: string }[]
  availableCount: number
  tight: boolean
}

function weekNumber(weekStart: string) {
  return getISOWeek(parseISO(weekStart))
}

export function AvailabilityPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const [weeks, setWeeks] = useState<WeekRow[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [summary, setSummary] = useState<SummaryWeek[] | null>(null)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  async function load() {
    const data = await api<{ weeks: WeekRow[] }>('/api/availability?weeks=10')
    setWeeks(data.weeks)
    setSelected(new Set(data.weeks.filter((w) => w.blocked).map((w) => w.weekStart)))
    setDirty(false)
    if (isAdmin) {
      const sum = await api<{ weeks: SummaryWeek[] }>('/api/availability/summary?weeks=10')
      setSummary(sum.weeks)
    }
  }

  useEffect(() => {
    load().catch((e) => setError(e instanceof Error ? e.message : 'Lataus epäonnistui'))
  }, [isAdmin])

  function toggle(weekStart: string, locked: boolean) {
    if (locked) return
    setSaved(false)
    setDirty(true)
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(weekStart)) next.delete(weekStart)
      else next.add(weekStart)
      return next
    })
  }

  async function save() {
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      await api('/api/availability', {
        method: 'PUT',
        json: { blockedWeeks: [...selected], weeks: 10 },
      })
      await load()
      setSaved(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Tallennus epäonnistui')
    } finally {
      setSaving(false)
    }
  }

  const blockedCount = selected.size

  return (
    <div className="page">
      <Link className="back" to="/">
        ← Etusivu
      </Link>
      <header className="page-hero compact">
        <p className="brand-mark">Siisti salin piha</p>
        <h1>Käytettävyys</h1>
        <p className="lede">
          Merkitse viikot, jolloin et voi olla Pihavuorossa. Suositus ohittaa nämä viikot.
        </p>
      </header>

      {error && <p className="error">{error}</p>}
      {saved && !dirty && <p className="ok-flash">Käytettävyys tallennettu.</p>}

      <section className="panel">
        <h2>Seuraavat 10 viikkoa</h2>
        <p className="hint" style={{ marginTop: '-0.35rem', marginBottom: '0.85rem' }}>
          Valitse estetyt viikot · {blockedCount} merkitty
        </p>

        <ul className="avail-list">
          {weeks.map((w) => {
            const locked = Boolean(w.myRole && w.published)
            const checked = selected.has(w.weekStart)
            return (
              <li key={w.weekStart}>
                <button
                  type="button"
                  className={`avail-row${checked ? ' is-blocked' : ''}${locked ? ' is-locked' : ''}`}
                  onClick={() => toggle(w.weekStart, locked)}
                  aria-pressed={checked}
                  disabled={locked}
                >
                  <span className={`avail-check${checked ? ' on' : ''}`} aria-hidden="true">
                    {checked ? '✓' : ''}
                  </span>
                  <span className="avail-meta">
                    <strong>
                      Vk {weekNumber(w.weekStart)} · {formatWeekRangeFi(w.weekStart, w.weekEnd)}
                    </strong>
                    <span className="muted">
                      {locked
                        ? `Olet jo vuorossa (${w.myRole === 'lead' ? 'vastuu' : 'apu'}) — poista ensin kokoonpanosta`
                        : w.myRole
                          ? `Luonnoksessa: ${w.myRole === 'lead' ? 'vastuu' : 'apu'}`
                          : w.published
                            ? 'Viikko julkaistu'
                            : 'Vapaa merkittäväksi'}
                    </span>
                  </span>
                  <span className={`avail-flag${checked ? ' on' : ''}`}>
                    {checked ? 'Este' : 'OK'}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>

        <div className="row-actions" style={{ marginTop: '1rem' }}>
          <button
            className="btn primary"
            type="button"
            disabled={saving || !dirty}
            onClick={() => void save()}
          >
            {saving ? 'Tallennetaan…' : 'Tallenna käytettävyys'}
          </button>
        </div>
      </section>

      {isAdmin && summary && (
        <section className="panel">
          <h2>Saatavuus (ylläpito)</h2>
          <p className="hint" style={{ marginTop: '-0.35rem', marginBottom: '0.85rem' }}>
            Näet ketkä ovat merkinneet esteen — tiukat viikot korostetaan.
          </p>
          <ul className="avail-summary">
            {summary.map((w) => (
              <li key={w.weekStart} className={w.tight ? 'is-tight' : undefined}>
                <div className="avail-summary-top">
                  <strong>
                    Vk {weekNumber(w.weekStart)} · {formatWeekRangeFi(w.weekStart, w.weekEnd)}
                  </strong>
                  <span className={`pill${w.tight ? ' status-draft' : ''}`}>
                    {w.availableCount} saatavilla
                  </span>
                </div>
                {w.blockedUsers.length === 0 ? (
                  <p className="muted">Ei esteitä</p>
                ) : (
                  <p className="muted">
                    Este:{' '}
                    {w.blockedUsers.map((u) => u.name).join(', ')}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
