/** Build .ics / Google Calendar links for week-long Pihavuoro shifts. */

export type ShiftCalendarEvent = {
  id: string
  weekStart: string
  weekEnd: string
  role?: 'lead' | 'helper' | null
  seasonLabel?: string | null
}

function compactDate(isoDate: string): string {
  return String(isoDate || '')
    .trim()
    .slice(0, 10)
    .replace(/-/g, '')
}

/** ICS all-day DTEND is exclusive → day after Sunday. */
export function dayAfterIso(isoDate: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(isoDate || '').trim())
  if (!m) return isoDate
  const dt = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  dt.setUTCDate(dt.getUTCDate() + 1)
  return dt.toISOString().slice(0, 10)
}

function escapeIcsText(value: string): string {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
}

function roleLabel(role?: 'lead' | 'helper' | null): string {
  if (role === 'lead') return 'vastuuveli'
  if (role === 'helper') return 'avustaja'
  return ''
}

function eventSummary(event: ShiftCalendarEvent): string {
  const role = roleLabel(event.role)
  return role ? `Pihavuoro (${role})` : 'Pihavuoro'
}

function eventDescription(event: ShiftCalendarEvent): string {
  const role = roleLabel(event.role)
  return [
    'Siisti salin piha — viikon pihavuoro.',
    event.seasonLabel ? `Kausi: ${event.seasonLabel}` : '',
    role ? `Roolisi: ${role}` : '',
    'Avaa sovellus nähdäksesi tehtävät ja kokoonpanon.',
  ]
    .filter(Boolean)
    .join('\n')
}

function stampUtc(): string {
  return new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z')
}

export function buildShiftIcs(
  events: ShiftCalendarEvent[],
  opts?: { calName?: string },
): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Siisti salin piha//Pihavuorot//FI',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(opts?.calName || 'Omat pihavuorot')}`,
  ]

  for (const event of events) {
    const start = compactDate(event.weekStart)
    const end = compactDate(dayAfterIso(event.weekEnd))
    if (start.length !== 8 || end.length !== 8) continue
    lines.push(
      'BEGIN:VEVENT',
      `UID:pihavuoro-${event.id}@siisti-salinpiha`,
      `DTSTAMP:${stampUtc()}`,
      `DTSTART;VALUE=DATE:${start}`,
      `DTEND;VALUE=DATE:${end}`,
      `SUMMARY:${escapeIcsText(eventSummary(event))}`,
      `DESCRIPTION:${escapeIcsText(eventDescription(event))}`,
      'END:VEVENT',
    )
  }

  lines.push('END:VCALENDAR')
  return `${lines.join('\r\n')}\r\n`
}

export function googleCalendarUrl(event: ShiftCalendarEvent): string {
  const dates = `${compactDate(event.weekStart)}/${compactDate(dayAfterIso(event.weekEnd))}`
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: eventSummary(event),
    dates,
    details: eventDescription(event),
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

export async function shareOrDownloadIcs(filename: string, ics: string): Promise<void> {
  const file = new File([ics], filename, { type: 'text/calendar' })
  const nav = navigator as Navigator & {
    canShare?: (data?: ShareData) => boolean
  }
  if (typeof nav.share === 'function' && typeof nav.canShare === 'function') {
    try {
      if (nav.canShare({ files: [file] })) {
        await nav.share({ files: [file], title: 'Pihavuoro', text: 'Lisää kalenteriin' })
        return
      }
    } catch (err) {
      // User cancelled share sheet — treat as done.
      if (err instanceof DOMException && err.name === 'AbortError') return
    }
  }

  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
