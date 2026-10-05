import { notifyUsers } from './weatherAlerts.ts'
import { db } from './db.ts'

const CHECK_MS = 60 * 60 * 1000
/** Sunnuntain muistutus klo 9–18 Suomen aikaa (kerran / viikko). */
const REMINDER_HOUR_START = 9
const REMINDER_HOUR_END = 18
const ALERT_KEY = 'lead-open-tasks'

function helsinkiDay(d = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Helsinki',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

function helsinkiHour(d = new Date()): number {
  const hour = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Helsinki',
    hour: 'numeric',
    hourCycle: 'h23',
  })
    .formatToParts(d)
    .find((p) => p.type === 'hour')?.value
  return Number(hour ?? 0)
}

function isSundayHelsinki(d = new Date()): boolean {
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Helsinki',
    weekday: 'short',
  }).format(d)
  return weekday === 'Sun'
}

function isReminderWindow(d = new Date()): boolean {
  if (!isSundayHelsinki(d)) return false
  const hour = helsinkiHour(d)
  return hour >= REMINDER_HOUR_START && hour < REMINDER_HOUR_END
}

function alreadySent(day: string, pihavuoroId: string) {
  return Boolean(
    db
      .prepare(
        `SELECT id FROM weather_alert_log WHERE alert_key = ? AND day = ? AND pihavuoro_id = ?`,
      )
      .get(ALERT_KEY, day, pihavuoroId),
  )
}

function markSent(day: string, pihavuoroId: string) {
  db.prepare(
    `INSERT INTO weather_alert_log (id, alert_key, day, pihavuoro_id, created_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(crypto.randomUUID(), ALERT_KEY, day, pihavuoroId, new Date().toISOString())
}

type OpenWeek = {
  id: string
  week_start: string
  lead_id: string
  open_count: number
}

function publishedWeeksWithOpenTasks(today: string): OpenWeek[] {
  return db
    .prepare(
      `SELECT p.id AS id, p.week_start AS week_start, a.user_id AS lead_id,
              (SELECT COUNT(*) FROM shift_tasks t
               WHERE t.pihavuoro_id = p.id AND t.status = 'open') AS open_count
       FROM pihavuorot p
       JOIN assignments a ON a.pihavuoro_id = p.id AND a.role = 'lead'
       WHERE p.status = 'published'
         AND p.week_start <= ?
         AND date(p.week_start, '+6 days') >= ?
       ORDER BY p.week_start ASC`,
    )
    .all(today, today) as OpenWeek[]
}

/**
 * Sunnuntaina: jos julkaistulla viikolla on avoimia tehtäväkortteja,
 * muistuta vastuuveljeä pushilla + Ilmo-listalla (linkki etusivulle).
 * `force` ohittaa sunnuntai/kelloikkunan (admin-testi).
 */
export function runLeadOpenTaskReminder(
  now = new Date(),
  opts: { force?: boolean } = {},
): {
  sent: string[]
  skipped: string
} {
  if (!opts.force && !isReminderWindow(now)) {
    return {
      sent: [],
      skipped: 'Muistutus lähetetään vain sunnuntaisin klo 9–18 (Suomen aikaa)',
    }
  }

  const day = helsinkiDay(now)
  const weeks = publishedWeeksWithOpenTasks(day).filter((w) => Number(w.open_count) > 0)
  if (!weeks.length) {
    return { sent: [], skipped: 'Ei avoimia tehtäväkortteja vastuuveljille' }
  }

  const sent: string[] = []
  for (const week of weeks) {
    if (alreadySent(day, week.id)) continue
    const n = Number(week.open_count)
    const title = 'Tehtäväkortteja merkkaamatta'
    const body =
      n === 1
        ? 'Viikolla on vielä 1 avoin tehtäväkortti. Kuittaa se etusivulta.'
        : `Viikolla on vielä ${n} avointa tehtäväkorttia. Kuittaa ne etusivulta.`
    notifyUsers([week.lead_id], title, body, '/', 'shift')
    markSent(day, week.id)
    sent.push(week.id)
  }

  return {
    sent,
    skipped: sent.length ? '' : 'Muistutus jo lähetetty tältä sunnuntailta',
  }
}

export function startLeadTaskReminderScheduler() {
  const tick = () => {
    try {
      const r = runLeadOpenTaskReminder()
      if (r.sent.length) console.log('Lead open-task reminders sent:', r.sent.join(', '))
    } catch (err) {
      console.warn('Lead open-task reminder failed', err)
    }
  }
  setTimeout(tick, 12_000)
  setInterval(tick, CHECK_MS)
}
