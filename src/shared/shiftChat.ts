/** Vuorokeskustelu aukeaa viikon maanantaina klo 8.00 (Europe/Helsinki). */

export const SHIFT_CHAT_TZ = 'Europe/Helsinki'
export const SHIFT_CHAT_OPEN_HOUR = 8

function partsInTz(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0)
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
  }
}

/**
 * UTC instant for `yyyy-MM-dd` at `hour:00:00` in Europe/Helsinki.
 * Corrects for EET/EEST via iterative offset fix.
 */
export function helsinkiWallTimeToUtc(dateStr: string, hour: number, minute = 0): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr)
  if (!m) return new Date(NaN)
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  // Rough start: Helsinki is UTC+2/+3, so 08:00 local ≈ 05:00–06:00 UTC
  let utcMs = Date.UTC(y, mo - 1, d, hour - 3, minute, 0)
  for (let i = 0; i < 4; i++) {
    const got = partsInTz(new Date(utcMs), SHIFT_CHAT_TZ)
    const wantMs = Date.UTC(y, mo - 1, d, hour, minute, 0)
    const gotMs = Date.UTC(got.year, got.month - 1, got.day, got.hour, got.minute, got.second)
    utcMs += wantMs - gotMs
  }
  return new Date(utcMs)
}

/** Millisecond when the week's chat opens (Monday 08:00 Europe/Helsinki). */
export function shiftChatOpensAt(weekStart: string): Date {
  return helsinkiWallTimeToUtc(weekStart, SHIFT_CHAT_OPEN_HOUR, 0)
}

/** True from Monday 08:00 Helsinki until the week has ended (after Sunday). */
export function isShiftChatOpen(weekStart: string, now = new Date()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) return false
  const opens = shiftChatOpensAt(weekStart)
  if (Number.isNaN(opens.getTime()) || now.getTime() < opens.getTime()) return false
  const weekEnd = addDaysYmd(weekStart, 6)
  const todayHelsinki = new Intl.DateTimeFormat('en-CA', {
    timeZone: SHIFT_CHAT_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
  return weekEnd >= todayHelsinki
}

export const SHIFT_CHAT_NOT_YET_MSG =
  'Vuorokeskustelu aukeaa viikon maanantaina klo 8.00'

function addDaysYmd(ymd: string, n: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const dt = new Date(Date.UTC(y!, m! - 1, d!))
  dt.setUTCDate(dt.getUTCDate() + n)
  return dt.toISOString().slice(0, 10)
}
