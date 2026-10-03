import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'
import { DEFAULT_LEAD_GUIDE, type LeadGuide } from '../shared/leadGuide'

export function LeadCallout({
  weekStart,
  weekEnd,
  pihavuoroId,
}: {
  weekStart: string
  weekEnd: string
  pihavuoroId: string
}) {
  const { user } = useAuth()
  const [guide, setGuide] = useState<LeadGuide>(DEFAULT_LEAD_GUIDE)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    api<{ guide: LeadGuide }>('/api/lead-guide')
      .then((d) => setGuide(d.guide || DEFAULT_LEAD_GUIDE))
      .catch(() => undefined)
  }, [])

  return (
    <>
      <section className="lead-callout" aria-label="Vastuuveli">
        <div className="lead-callout-badge">Vastuuveli</div>
        <h2>{guide.calloutTitle}</h2>
        <p>
          {guide.calloutBody} Viikko {weekStart} – {weekEnd}.
        </p>
        <div className="lead-callout-actions">
          <button type="button" className="btn primary" onClick={() => setOpen(true)}>
            Katso tarkemmat ohjeet
          </button>
          <Link className="btn ghost" to={`/pihavuoro/${pihavuoroId}`}>
            Avaa Pihavuoro
          </Link>
        </div>
      </section>

      {open && (
        <div className="lead-guide-backdrop" role="presentation" onClick={() => setOpen(false)}>
          <div
            className="lead-guide-sheet"
            role="dialog"
            aria-label={guide.guideTitle}
            onClick={(e) => e.stopPropagation()}
          >
            <header className="lead-guide-head">
              <div>
                <p className="kicker">Vastuuveli</p>
                <h2>{guide.guideTitle}</h2>
              </div>
              <button type="button" className="btn ghost small" onClick={() => setOpen(false)}>
                Sulje
              </button>
            </header>
            <div className="lead-guide-body">
              {guide.sections.map((s) => (
                <section key={s.id} className="lead-guide-section">
                  <h3>{s.title}</h3>
                  <p>{s.body}</p>
                </section>
              ))}
            </div>
            {user?.role === 'admin' && (
              <p className="lead-guide-admin">
                <Link to="/vastuuohjeet">Muokkaa ohjeita (ylläpitäjä)</Link>
              </p>
            )}
          </div>
        </div>
      )}
    </>
  )
}
