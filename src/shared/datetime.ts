/** Finnish date/time display helpers (Europe/Helsinki, pv.kk.vvvv). */

const TZ = 'Europe/Helsinki'

function parseInput(value: string | Date): Date {
  if (value instanceof Date) return value
  const s = String(value || '').trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split('-').map(Number)
    return new Date(y!, m! - 1, d!, 12, 0, 0)
  }
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? new Date() : d
}

/** pv.kk.vvvv e.g. 28.09.2026 */
export function formatDateFi(value: string | Date): string {
  try {
    return new Intl.DateTimeFormat('fi-FI', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: TZ,
    }).format(parseInput(value))
  } catch {
    return String(value)
  }
}

/** pv.kk.vvvv hh.mm e.g. 28.09.2026 14.30 */
export function formatDateTimeFi(value: string | Date): string {
  try {
    return new Intl.DateTimeFormat('fi-FI', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: TZ,
    }).format(parseInput(value))
  } catch {
    return String(value)
  }
}

/** hh.mm in Finnish locale */
export function formatTimeFi(value: string | Date): string {
  try {
    return new Intl.DateTimeFormat('fi-FI', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: TZ,
    }).format(parseInput(value))
  } catch {
    return String(value)
  }
}

/** Week range: 28.09.2026 – 04.10.2026 */
export function formatWeekRangeFi(weekStart: string, weekEnd: string): string {
  return `${formatDateFi(weekStart)} – ${formatDateFi(weekEnd)}`
}
