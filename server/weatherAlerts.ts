import { getAppSettings } from './appSettings.ts'
import { db } from './db.ts'
import { capToAlertTips, getCapWarnings } from './capWarnings.ts'
import { getWeather, type WeatherPayload, type WeatherTip } from './weather.ts'
import { webpush } from './vapid.ts'

const CHECK_MS = 60 * 60 * 1000

function helsinkiDay(d = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Helsinki',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

function overlappingPublishedWeeks() {
  const today = helsinkiDay()
  return db
    .prepare(
      `SELECT * FROM pihavuorot
       WHERE status = 'published'
         AND week_start <= date(?, '+1 day')
         AND date(week_start, '+6 days') >= ?
       ORDER BY week_start ASC`,
    )
    .all(today, today) as Record<string, unknown>[]
}

function weekAssignees(pihavuoroId: string): string[] {
  return (
    db
      .prepare(`SELECT user_id FROM assignments WHERE pihavuoro_id = ?`)
      .all(pihavuoroId) as { user_id: string }[]
  ).map((r) => r.user_id)
}

function alreadySent(alertKey: string, day: string, pihavuoroId: string) {
  return Boolean(
    db
      .prepare(
        `SELECT id FROM weather_alert_log WHERE alert_key = ? AND day = ? AND pihavuoro_id = ?`,
      )
      .get(alertKey, day, pihavuoroId),
  )
}

function markSent(alertKey: string, day: string, pihavuoroId: string) {
  db.prepare(
    `INSERT INTO weather_alert_log (id, alert_key, day, pihavuoro_id, created_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(crypto.randomUUID(), alertKey, day, pihavuoroId, new Date().toISOString())
}

export function notifyUsers(
  userIds: string[],
  title: string,
  body: string,
  link: string,
  kind = 'general',
) {
  if (!userIds.length) return
  const unique = [...new Set(userIds)]
  const now = new Date().toISOString()
  const insert = db.prepare(
    `INSERT INTO notifications (id, user_id, title, body, link, kind, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
  const tx = db.transaction(() => {
    for (const id of unique) {
      insert.run(crypto.randomUUID(), id, title, body, link, kind, now)
    }
  })
  tx()

  const placeholders = unique.map(() => '?').join(',')
  const subs = db
    .prepare(
      `SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id IN (${placeholders})`,
    )
    .all(...unique) as { id: string; endpoint: string; p256dh: string; auth: string }[]

  const pushPayload = JSON.stringify({
    title,
    body,
    url: link,
    kind,
    tag: kind === 'chat' ? 'chat' : kind.startsWith('weather') ? 'weather' : kind,
    renotify: kind === 'chat',
  })

  void Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          pushPayload,
        )
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) {
          db.prepare(`DELETE FROM push_subscriptions WHERE id = ?`).run(sub.id)
        }
        console.warn('Push failed', status || err)
      }
    }),
  )
}

function tipToAlert(tip: WeatherTip): { key: string; title: string; body: string } {
  const isCap = tip.id.startsWith('cap:')
  return {
    key: tip.id,
    title: isCap ? tip.title : `Sää: ${tip.title}`,
    body: tip.body,
  }
}

/** Prefer CAP + actionable forecast tips. */
function collectAlertTips(weather: WeatherPayload, capTips: WeatherTip[]): WeatherTip[] {
  const order = ['cap:wind', 'cap:rain', 'cap:pedestrianSafety', 'cap:trafficWeather', 'cap:thunderstorm', 'cap:coldWeather', 'cap:hotWeather', 'cap:forestFireWeather', 'snow', 'ice', 'wind', 'rain']
  const merged = [...capTips, ...weather.tips]
  const seen = new Set<string>()
  const out: WeatherTip[] = []
  for (const tip of merged.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id))) {
    if (seen.has(tip.id)) continue
    seen.add(tip.id)
    out.push(tip)
  }
  return out.slice(0, 4)
}

export async function runWeatherAlertCheck(): Promise<{
  sent: string[]
  skipped: string
  place?: string
  warnings?: number
}> {
  const weeks = overlappingPublishedWeeks()
  if (!weeks.length) {
    return { sent: [], skipped: 'Ei julkaistua Pihavuoroa tälle viikolle' }
  }

  const [weather, caps] = await Promise.all([
    getWeather(getAppSettings().weatherPlace),
    getCapWarnings(),
  ])
  const tips = collectAlertTips(weather, capToAlertTips(caps))
  if (!tips.length) {
    return {
      sent: [],
      skipped: 'Ei hälytyskynnyksiä',
      place: weather.place,
      warnings: caps.length,
    }
  }

  const day = helsinkiDay()
  const sent: string[] = []

  for (const tip of tips) {
    const alert = tipToAlert(tip)
    const recipients = new Set<string>()
    const weeksToMark: string[] = []

    for (const week of weeks) {
      const pihavuoroId = String(week.id)
      if (alreadySent(alert.key, day, pihavuoroId)) continue
      for (const id of weekAssignees(pihavuoroId)) recipients.add(id)
      weeksToMark.push(pihavuoroId)
    }

    if (!recipients.size || !weeksToMark.length) continue

    notifyUsers([...recipients], alert.title, alert.body, '/', tip.id.startsWith('cap:') ? 'weather-cap' : 'weather')
    for (const pihavuoroId of weeksToMark) {
      markSent(alert.key, day, pihavuoroId)
    }
    sent.push(alert.key)
  }

  return {
    sent,
    skipped: sent.length ? '' : 'Kaikki hälytykset jo lähetetty tänään',
    place: weather.place,
    warnings: caps.length,
  }
}

export function startWeatherAlertScheduler() {
  const tick = () => {
    void runWeatherAlertCheck()
      .then((r) => {
        if (r.sent.length) console.log('Weather alerts sent:', r.sent.join(', '))
      })
      .catch((err) => console.warn('Weather alert check failed', err))
  }
  // Slight delay so DB/server is ready
  setTimeout(tick, 8_000)
  setInterval(tick, CHECK_MS)
}
