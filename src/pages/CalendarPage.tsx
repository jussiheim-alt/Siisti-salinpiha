import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, type Pihavuoro } from '../api'
import { useAuth } from '../auth'
import { AddToCalendarButton } from '../components/AddToCalendarButton'
import { PublishWeekModal } from '../components/PublishWeekModal'
import { formatWeekRangeFi } from '../shared/datetime'
import {
  DEFAULT_TOTAL_PEOPLE,
  MAX_TOTAL_PEOPLE,
  MIN_TOTAL_PEOPLE,
} from '../shared/travelGroup'

export function CalendarPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [list, setList] = useState<Pihavuoro[]>([])
  const [error, setError] = useState('')
  const [publishingId, setPublishingId] = useState<string | null>(null)
  const [totalPeople, setTotalPeople] = useState(DEFAULT_TOTAL_PEOPLE)
  const [reviewMode, setReviewMode] = useState<'publish' | 'draft' | null>(null)

  async function load() {
    const data = await api<{ pihavuorot: Pihavuoro[] }>('/api/pihavuorot')
    setList(data.pihavuorot)
  }

  useEffect(() => {
    load().catch((e) => setError(e.message))
  }, [])

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

  const sizeOptions = Array.from(
    { length: MAX_TOTAL_PEOPLE - MIN_TOTAL_PEOPLE + 1 },
    (_, i) => MIN_TOTAL_PEOPLE + i,
  )

  const myShifts = useMemo(
    () =>
      list
        .filter((p) => p.status !== 'draft')
        .map((p) => {
          const mine = p.assignments.find((a) => a.userId === user?.id)
          if (!mine) return null
          return {
            id: p.id,
            weekStart: p.weekStart,
            weekEnd: p.weekEnd,
            role: mine.role,
            seasonLabel: p.seasonLabel || p.season,
          }
        })
        .filter((x): x is NonNullable<typeof x> => Boolean(x)),
    [list, user?.id],
  )

  return (
    <div className="page">
      <header className="page-hero compact">
        <p className="brand-mark">Siisti salin piha</p>
        <h1>Kalenteri</h1>
        <p className="lede">Viikoittaiset Pihavuorot — luonnos tai julkaistu.</p>
      </header>

      {myShifts.length > 0 && (
        <section className="panel" style={{ marginBottom: '0.85rem' }}>
          <h2 style={{ marginTop: 0, fontSize: '1.05rem' }}>Omat vuorot kalenteriin</h2>
          <AddToCalendarButton
            events={myShifts}
            label={
              myShifts.length === 1
                ? 'Lisää kalenteriin'
                : `Lisää ${myShifts.length} vuoroa kalenteriin`
            }
          />
        </section>
      )}

      {user?.role === 'admin' && (
        <div className="stack" style={{ marginBottom: '0.85rem' }}>
          <label style={{ maxWidth: '16rem' }}>
            Henkilöitä vuorolla
            <select
              value={totalPeople}
              onChange={(e) => setTotalPeople(Number(e.target.value))}
              disabled={Boolean(reviewMode)}
            >
              {sizeOptions.map((n) => (
                <option key={n} value={n}>
                  {n} henkilöä (1 vastuuveli + {n - 1} avustajaa)
                </option>
              ))}
            </select>
          </label>
          <div className="row-actions">
            <button
              className="btn primary"
              disabled={Boolean(reviewMode)}
              onClick={() => setReviewMode('publish')}
            >
              Luo ja julkaise viikko
            </button>
            <button
              className="btn"
              disabled={Boolean(reviewMode)}
              onClick={() => setReviewMode('draft')}
            >
              Luo luonnos
            </button>
            <Link className="btn ghost" to="/kaytettavyys">
              Käytettävyys
            </Link>
          </div>
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
                    {formatWeekRangeFi(p.weekStart, p.weekEnd)}
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
                  {p.seasonLabel || p.season} · Vastuu: {lead?.userName || '—'}
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

      {reviewMode && (
        <PublishWeekModal
          open
          mode={reviewMode}
          initialTotalPeople={totalPeople}
          onClose={() => setReviewMode(null)}
          onCreated={(id) => {
            setReviewMode(null)
            void load().then(() => navigate(`/pihavuoro/${id}`))
          }}
        />
      )}
    </div>
  )
}
