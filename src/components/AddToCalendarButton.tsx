import { googleCalendarUrl, type ShiftCalendarEvent } from '../shared/shiftCalendar'
import { formatWeekRangeFiCompact } from '../shared/datetime'

type Props = {
  events: ShiftCalendarEvent[]
  /** Override label for a single-event button. */
  label?: string
  className?: string
}

export function AddToCalendarButton({
  events,
  label = 'Lisää Google-kalenteriin',
  className = 'btn primary calendar-google-btn',
}: Props) {
  if (!events.length) return null

  const sorted = [...events].sort((a, b) => a.weekStart.localeCompare(b.weekStart))

  return (
    <div className="stack calendar-google-block">
      {sorted.length === 1 ? (
        <a
          className={className}
          href={googleCalendarUrl(sorted[0]!)}
          target="_blank"
          rel="noopener noreferrer"
        >
          {label}
        </a>
      ) : (
        sorted.map((event) => (
          <a
            key={event.id}
            className={className}
            href={googleCalendarUrl(event)}
            target="_blank"
            rel="noopener noreferrer"
          >
            Google-kalenteri · {formatWeekRangeFiCompact(event.weekStart, event.weekEnd)}
          </a>
        ))
      )}
      <p className="hint calendar-google-hint">
        Avaa Google-kalenterin — tallenna viikko koko päivän tapahtumaksi.
      </p>
    </div>
  )
}
