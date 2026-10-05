import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { api, type Assignment, type SeasonKey } from '../api'
import { useAuth } from '../auth'
import { formatDateTimeFi, formatWeekRangeFi } from '../shared/datetime'
import { SEASON_LABELS } from '../shared/seasons'

type HistoryTask = {
  id: string
  title: string
  effort: 'light' | 'heavy'
  status: 'open' | 'done' | 'skipped'
  skipReason?: string | null
  doneByName?: string | null
  doneAt?: string | null
}

type HistoryNotice = {
  id: string
  body: string
  status: string
  audience: 'all' | 'leads'
  authorName: string
  createdAt: string
  photoUrl?: string | null
}

type WeekHistory = {
  id: string
  weekStart: string
  weekEnd: string
  status: 'published' | 'done'
  season: SeasonKey
  seasonLabel?: string
  notes?: string | null
  assignments: Assignment[]
  taskStats: { total: number; done: number; skipped: number; open: number }
  tasks: HistoryTask[]
  notices: HistoryNotice[]
}

function taskStatusLabel(status: HistoryTask['status']) {
  if (status === 'done') return 'Tehty'
  if (status === 'skipped') return 'Ei tarvetta'
  return 'Avoin'
}

function noticeStatusLabel(status: string) {
  if (status === 'resolved') return 'Ratkaistu'
  if (status === 'in_progress') return 'Kesken'
  return 'Avoin'
}

export function WeekHistoryPage() {
  const { user } = useAuth()
  const [weeks, setWeeks] = useState<WeekHistory[]>([])
  const [openId, setOpenId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user?.role !== 'admin') return
    setLoading(true)
    api<{ weeks: WeekHistory[] }>('/api/admin/week-history')
      .then((data) => {
        setWeeks(data.weeks || [])
        if (data.weeks?.length) setOpenId(data.weeks[0]!.id)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Lataus epäonnistui'))
      .finally(() => setLoading(false))
  }, [user?.role])

  if (user && user.role !== 'admin') return <Navigate to="/" replace />

  return (
    <div className="page">
      <header className="page-hero compact">
        <p className="brand-mark">Siisti salin piha</p>
        <h1>Viikkohistoria</h1>
        <p className="lede">
          Julkaistujen viikkojen kokoonpanot, tehtäväkuittaukset ja viikon aikana kirjatut
          huomiot — apuna tulevien töiden suunnitteluun.
        </p>
      </header>

      <p className="row-actions" style={{ marginBottom: '0.85rem' }}>
        <Link className="btn ghost small" to="/yllapitaja">
          ← Ylläpito
        </Link>
      </p>

      {error && <p className="error">{error}</p>}
      {loading && <p className="muted">Ladataan historiaa…</p>}
      {!loading && !weeks.length && (
        <p className="muted">Ei vielä julkaistuja viikkoja historiassa.</p>
      )}

      <div className="week-history-list">
        {weeks.map((w) => {
          const open = openId === w.id
          const lead = w.assignments.find((a) => a.role === 'lead')
          const helpers = w.assignments.filter((a) => a.role === 'helper')
          const season = w.seasonLabel || SEASON_LABELS[w.season] || w.season
          return (
            <section key={w.id} className={`week-history-card${open ? ' is-open' : ''}`}>
              <button
                type="button"
                className="week-history-toggle"
                aria-expanded={open}
                onClick={() => setOpenId(open ? null : w.id)}
              >
                <span className="week-history-toggle-main">
                  <strong>{formatWeekRangeFi(w.weekStart, w.weekEnd)}</strong>
                  <span className="muted">
                    {season}
                    {lead ? ` · vastuu ${lead.userName}` : ''}
                  </span>
                </span>
                <span className="week-history-stats" aria-label="Tehtävien tila">
                  <span className="pill status-done">{w.taskStats.done} tehty</span>
                  {w.taskStats.skipped > 0 && (
                    <span className="pill">{w.taskStats.skipped} ohitettu</span>
                  )}
                  {w.taskStats.open > 0 && (
                    <span className="pill status-published">{w.taskStats.open} avoin</span>
                  )}
                  {w.notices.length > 0 && (
                    <span className="pill">{w.notices.length} huomioita</span>
                  )}
                </span>
              </button>

              {open && (
                <div className="week-history-body">
                  <div className="week-history-section">
                    <h2>Kokoonpano</h2>
                    <ul className="week-history-roster">
                      {w.assignments.map((a) => (
                        <li key={a.id}>
                          <strong>{a.userName}</strong>
                          <span className="muted">
                            {a.role === 'lead' ? 'Vastuuveli' : 'Avustaja'}
                            {a.constraintLabels?.length
                              ? ` · ${a.constraintLabels.join(', ')}`
                              : ''}
                          </span>
                        </li>
                      ))}
                      {!w.assignments.length && <li className="muted">Ei kokoonpanoa</li>}
                    </ul>
                    {helpers.length > 0 && lead && (
                      <p className="hint" style={{ marginBottom: 0 }}>
                        {1 + helpers.length} henkilöä vuorolla
                      </p>
                    )}
                  </div>

                  <div className="week-history-section">
                    <h2>Tehtäväkortit</h2>
                    {w.tasks.length === 0 ? (
                      <p className="muted">Ei tehtäväkortteja tällä viikolla.</p>
                    ) : (
                      <ul className="week-history-tasks">
                        {w.tasks.map((t) => (
                          <li key={t.id} className={`status-${t.status}`}>
                            <div className="week-history-task-top">
                              <strong>{t.title}</strong>
                              <span
                                className={`pill status-${
                                  t.status === 'done'
                                    ? 'done'
                                    : t.status === 'open'
                                      ? 'published'
                                      : 'draft'
                                }`}
                              >
                                {taskStatusLabel(t.status)}
                              </span>
                            </div>
                            <p className="meta">
                              {t.effort === 'heavy' ? 'Raskas' : 'Kevyt'}
                              {t.doneByName ? ` · kuitannut ${t.doneByName}` : ''}
                              {t.doneAt ? ` · ${formatDateTimeFi(t.doneAt)}` : ''}
                              {t.status === 'skipped' && t.skipReason
                                ? ` · ${t.skipReason}`
                                : ''}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="week-history-section">
                    <h2>Huomiot viikon aikana</h2>
                    {w.notices.length === 0 ? (
                      <p className="muted">Ei huomioita tällä viikolla.</p>
                    ) : (
                      <ul className="week-history-notices">
                        {w.notices.map((n) => (
                          <li key={n.id}>
                            <div className="week-history-task-top">
                              <strong>{n.authorName}</strong>
                              <span className="pill">{noticeStatusLabel(n.status)}</span>
                            </div>
                            <p>{n.body}</p>
                            <p className="meta">
                              {formatDateTimeFi(n.createdAt)}
                              {n.audience === 'leads' ? ' · vain vastuuveljille' : ''}
                            </p>
                            {n.photoUrl && (
                              <a className="btn ghost small" href={n.photoUrl} target="_blank" rel="noreferrer">
                                Avaa kuva
                              </a>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {w.notes && (
                    <div className="week-history-section">
                      <h2>Viikon muistiinpanot</h2>
                      <p>{w.notes}</p>
                    </div>
                  )}

                  <p className="row-actions">
                    <Link className="btn small" to={`/pihavuoro/${w.id}`}>
                      Avaa viikko
                    </Link>
                  </p>
                </div>
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}
