import { useState } from 'react'
import {
  buildShiftIcs,
  googleCalendarUrl,
  shareOrDownloadIcs,
  type ShiftCalendarEvent,
} from '../shared/shiftCalendar'

type Props = {
  events: ShiftCalendarEvent[]
  label?: string
  className?: string
}

export function AddToCalendarButton({
  events,
  label = 'Lisää kalenteriin',
  className = 'btn small',
}: Props) {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (!events.length) return null

  const single = events.length === 1 ? events[0]! : null
  const googleUrl = single ? googleCalendarUrl(single) : null

  async function onAdd() {
    setError('')
    setBusy(true)
    try {
      const ics = buildShiftIcs(events)
      const filename =
        events.length === 1
          ? `pihavuoro-${events[0]!.weekStart}.ics`
          : 'omat-pihavuorot.ics'
      await shareOrDownloadIcs(filename, ics)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kalenteriin lisäys epäonnistui')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="stack" style={{ gap: '0.45rem' }}>
      <div className="row-actions">
        <button className={className} type="button" disabled={busy} onClick={() => void onAdd()}>
          {busy ? 'Avataan…' : label}
        </button>
        {googleUrl && (
          <a className="btn ghost small" href={googleUrl} target="_blank" rel="noopener noreferrer">
            Google-kalenteri
          </a>
        )}
      </div>
      {error && <p className="error">{error}</p>}
      <p className="hint" style={{ margin: 0 }}>
        Luo koko päivän tapahtuma viikolle — aukeaa puhelimen kalenteriin (esim. Google).
      </p>
    </div>
  )
}
