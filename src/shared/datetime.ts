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

/** ISO week number (1–53) for the calendar date in Europe/Helsinki. */
export function isoWeekNumber(value: string | Date = new Date()): number {
  const ymd = /^\d{4}-\d{2}-\d{2}$/.test(String(value))
    ? String(value)
    : todayYmdHelsinki(value instanceof Date ? value : parseInput(value))
  const [y, m, d] = ymd.split('-').map(Number)
  // Treat Helsinki calendar day as UTC noon for ISO arithmetic
  const utc = new Date(Date.UTC(y!, m! - 1, d!, 12))
  const dayNum = utc.getUTCDay() || 7
  utc.setUTCDate(utc.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1))
  return Math.ceil(((utc.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7)
}

/** Today's calendar date as yyyy-MM-dd in Europe/Helsinki. */
export function todayYmdHelsinki(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

/** True when today (Helsinki) falls inside [weekStart, weekEnd] inclusive. */
export function isActiveCalendarWeek(weekStart: string, weekEnd: string, now = new Date()): boolean {
  const today = todayYmdHelsinki(now)
  return weekStart <= today && today <= weekEnd
}

/** Whole Mondays from fromWeekStart until toWeekStart (0 = same week). */
export function weeksUntilWeekStart(fromWeekStart: string, toWeekStart: string): number {
  const a = parseInput(fromWeekStart).getTime()
  const b = parseInput(toWeekStart).getTime()
  return Math.round((b - a) / (7 * 86_400_000))
}

/** e.g. maanantai 5.10.2026 */
export function formatWeekdayDateFi(value: string | Date = new Date()): string {
  try {
    const d = parseInput(value)
    const wd = new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      timeZone: TZ,
    }).format(d)
    const names: Record<string, string> = {
      Mon: 'maanantai',
      Tue: 'tiistai',
      Wed: 'keskiviikko',
      Thu: 'torstai',
      Fri: 'perjantai',
      Sat: 'lauantai',
      Sun: 'sunnuntai',
    }
    return `${names[wd] || wd} ${formatDateFi(d)}`
  } catch {
    return formatDateFi(value)
  }
}

/**
 * Compact week range for narrow lists (stays on one line):
 * same month → 19.–25.10.2026
 * same year  → 28.09.–04.10.2026
 * else       → 28.12.2026–03.01.2027
 */
export function formatWeekRangeFiCompact(weekStart: string, weekEnd: string): string {
  const start = parseInput(weekStart)
  const end = parseInput(weekEnd)
  const d1 = String(start.getDate()).padStart(2, '0')
  const d2 = String(end.getDate()).padStart(2, '0')
  const m1 = String(start.getMonth() + 1).padStart(2, '0')
  const m2 = String(end.getMonth() + 1).padStart(2, '0')
  const y1 = start.getFullYear()
  const y2 = end.getFullYear()
  if (y1 === y2 && m1 === m2) return `${d1}.–${d2}.${m1}.${y1}`
  if (y1 === y2) return `${d1}.${m1}.–${d2}.${m2}.${y1}`
  return `${d1}.${m1}.${y1}–${d2}.${m2}.${y2}`
}
