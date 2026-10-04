import { useEffect, useId, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { AddToCalendarButton } from './AddToCalendarButton'
import type { Pihavuoro, ShiftTask } from '../api'
import { formatWeekRangeFi } from '../shared/datetime'
import { SEASON_LABELS, type SeasonKey } from '../shared/seasons'

type Props = {
  pihavuoro: Pihavuoro
  role?: 'lead' | 'helper' | null
  showCalendar?: boolean
}

function taskStatusLabel(task: ShiftTask) {
  if (task.status === 'done') return 'Hoidettu'
  if (task.status === 'skipped') return 'Ohitettu'
  return task.effort === 'heavy' ? 'Raskas · avoin' : 'Kevyt · avoin'
}

export function HomeShiftPanel({ pihavuoro, role, showCalendar }: Props) {
  const [open, setOpen] = useState(false)
  const titleId = useId()
  const season =
    SEASON_LABELS[pihavuoro.season as SeasonKey] ||
    pihavuoro.seasonLabel ||
    pihavuoro.season
  const openCount = pihavuoro.tasks.filter((t) => t.status === 'open').length
  const tasks = [...pihavuoro.tasks].sort((a, b) => {
    const order = { open: 0, skipped: 1, done: 2 }
    return (order[a.status] ?? 9) - (order[b.status] ?? 9)
  })

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <section className="surface-card home-shift" style={{ animationDelay: '0.14s' }}>
      <p className="kicker">Pihavuoro</p>
      <button
        type="button"
        className="quick-link home-shift-trigger"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className="quick-link-text">
          <strong>{formatWeekRangeFi(pihavuoro.weekStart, pihavuoro.weekEnd)}</strong>
          <span>
            {season}
            {role ? ` · ${role === 'lead' ? 'vastuuveli' : 'avustaja'}` : ''}
            {openCount ? ` · ${openCount} avointa tehtävää` : ' · ei avoimia tehtäviä'}
          </span>
        </span>
        <span className="quick-link-action">Tehtävät</span>
      </button>

      {showCalendar && (
        <div className="home-shift-calendar">
          <AddToCalendarButton
            events={[
              {
                id: pihavuoro.id,
                weekStart: pihavuoro.weekStart,
                weekEnd: pihavuoro.weekEnd,
                role,
                seasonLabel: season,
              },
            ]}
          />
        </div>
      )}

      {open &&
        createPortal(
          <div
            className="home-shift-backdrop"
            role="presentation"
            onClick={() => setOpen(false)}
          >
            <div
              className="home-shift-sheet"
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              onClick={(e) => e.stopPropagation()}
            >
              <header className="home-shift-sheet-head">
                <div>
                  <p className="kicker">Viikon tehtävät</p>
                  <h2 id={titleId}>
                    {formatWeekRangeFi(pihavuoro.weekStart, pihavuoro.weekEnd)}
                  </h2>
                  <p className="muted home-shift-sheet-meta">
                    {season}
                    {role ? ` · ${role === 'lead' ? 'vastuuveli' : 'avustaja'}` : ''}
                    {` · ${openCount}/${pihavuoro.tasks.length} avointa`}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn ghost small"
                  onClick={() => setOpen(false)}
                >
                  Sulje
                </button>
              </header>

              <ul className="home-shift-task-list">
                {tasks.length === 0 ? (
                  <li className="muted">Ei tehtäviä tälle viikolle.</li>
                ) : (
                  tasks.map((t) => (
                    <li
                      key={t.id}
                      className={`home-shift-task-row status-${t.status}`}
                    >
                      <strong>{t.title}</strong>
                      <span>{taskStatusLabel(t)}</span>
                    </li>
                  ))
                )}
              </ul>

              <div className="home-shift-sheet-actions">
                <Link
                  className="btn primary"
                  to={`/pihavuoro/${pihavuoro.id}`}
                  onClick={() => setOpen(false)}
                >
                  Avaa Pihavuoro
                </Link>
                <button type="button" className="btn" onClick={() => setOpen(false)}>
                  Sulje
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </section>
  )
}
