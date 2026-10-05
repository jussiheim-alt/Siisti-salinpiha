import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'
import { formatWeekRangeFi } from '../shared/datetime'
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

  /* Lock the app shell scroll so iOS doesn't pan .app-main behind the sheet. */
  useEffect(() => {
    if (!open) return
    const main = document.querySelector('.app-main')
    const prevOverflow = main instanceof HTMLElement ? main.style.overflow : ''
    const prevTouch = main instanceof HTMLElement ? main.style.touchAction : ''
    if (main instanceof HTMLElement) {
      main.style.overflow = 'hidden'
      main.style.touchAction = 'none'
    }
    document.documentElement.classList.add('lead-guide-open')
    document.body.classList.add('lead-guide-open')

    const onTouchMove = (e: TouchEvent) => {
      const target = e.target
      if (!(target instanceof Element) || !target.closest('.lead-guide-body')) {
        e.preventDefault()
      }
    }

    document.addEventListener('touchmove', onTouchMove, { passive: false })
    return () => {
      document.removeEventListener('touchmove', onTouchMove)
      if (main instanceof HTMLElement) {
        main.style.overflow = prevOverflow
        main.style.touchAction = prevTouch
      }
      document.documentElement.classList.remove('lead-guide-open')
      document.body.classList.remove('lead-guide-open')
    }
  }, [open])

  return (
    <>
      <section className="lead-callout" aria-label="Vastuuveli">
        <div className="lead-callout-badge">Vastuuveli</div>
        <h2>{guide.calloutTitle}</h2>
        <p>
          {guide.calloutBody} Viikko {formatWeekRangeFi(weekStart, weekEnd)}.
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

      {open &&
        createPortal(
          <div
            className="modal-backdrop lead-guide-backdrop"
            role="presentation"
            onClick={() => setOpen(false)}
          >
            <div
              className="modal user-rights-modal lead-guide-sheet"
              role="dialog"
              aria-modal="true"
              aria-label={guide.guideTitle}
              onClick={(e) => e.stopPropagation()}
            >
              <header className="modal-head lead-guide-head">
                <div>
                  <p className="kicker">Vastuuveli</p>
                  <h2>{guide.guideTitle}</h2>
                </div>
                <button type="button" className="btn ghost small" onClick={() => setOpen(false)}>
                  Sulje
                </button>
              </header>
              <div className="modal-scroll lead-guide-body">
                {guide.sections.map((s) => (
                  <section key={s.id} className="lead-guide-section">
                    <h3>{s.title}</h3>
                    <p>{s.body}</p>
                  </section>
                ))}
                {user?.role === 'admin' && (
                  <p className="lead-guide-admin">
                    <Link to="/yllapitaja" onClick={() => setOpen(false)}>
                      Ylläpitäjä: ohjeet ja asetukset
                    </Link>
                  </p>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
