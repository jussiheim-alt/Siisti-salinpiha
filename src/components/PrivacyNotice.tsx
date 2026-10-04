import { useState } from 'react'
import { createPortal } from 'react-dom'
import {
  PRIVACY_NOTICE_INTRO,
  PRIVACY_NOTICE_SECTIONS,
  PRIVACY_NOTICE_TITLE,
  PRIVACY_NOTICE_VERSION,
} from '../shared/privacyNotice'

type Mode = 'required' | 'readonly'

type Props = {
  open: boolean
  mode: Mode
  busy?: boolean
  error?: string
  onAccept?: () => void | Promise<void>
  onClose?: () => void
}

export function PrivacyNotice({ open, mode, busy, error, onAccept, onClose }: Props) {
  const [checked, setChecked] = useState(false)
  if (!open) return null

  const required = mode === 'required'

  return createPortal(
    <div
      className="privacy-backdrop"
      role="presentation"
      onClick={() => {
        if (!required) onClose?.()
      }}
    >
      <div
        className="privacy-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="privacy-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="privacy-head">
          <div>
            <p className="kicker">Tietosuoja</p>
            <h2 id="privacy-title">{PRIVACY_NOTICE_TITLE}</h2>
            <p className="muted privacy-version">Versio {PRIVACY_NOTICE_VERSION}</p>
          </div>
          {!required && (
            <button type="button" className="btn ghost small" onClick={() => onClose?.()}>
              Sulje
            </button>
          )}
        </header>

        <p className="privacy-intro">{PRIVACY_NOTICE_INTRO}</p>

        <div className="privacy-body">
          {PRIVACY_NOTICE_SECTIONS.map((s) => (
            <section key={s.id} className="privacy-section">
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </section>
          ))}
        </div>

        {required ? (
          <div className="privacy-accept">
            <label className="privacy-check">
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => setChecked(e.target.checked)}
              />
              <span>Olen lukenut tietosuojaselosteen ja hyväksyn henkilötietojen käsittelyn siinä kuvatulla tavalla.</span>
            </label>
            {error && <p className="error">{error}</p>}
            <button
              type="button"
              className="btn primary"
              disabled={!checked || busy}
              onClick={() => void onAccept?.()}
            >
              {busy ? 'Tallennetaan…' : 'Hyväksy ja jatka'}
            </button>
          </div>
        ) : (
          <div className="privacy-accept">
            <button type="button" className="btn primary" onClick={() => onClose?.()}>
              Sulje
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
