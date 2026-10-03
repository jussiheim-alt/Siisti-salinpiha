/** FMI Open Data — official edited point forecast for Vääksy centre. */

export const WEATHER_PLACE = {
  name: 'Vääksy',
  /** FMI geocode for place=Vääksy (centre) */
  lat: 61.17379,
  lon: 25.54716,
}

const FMI_URL =
  'https://opendata.fmi.fi/wfs?service=WFS&version=2.0.0&request=getFeature' +
  `&storedquery_id=fmi::forecast::edited::weather::scandinavia::point::simple` +
  `&place=${encodeURIComponent(WEATHER_PLACE.name)}` +
  `&parameters=Temperature,WeatherSymbol3,WindSpeedMS,Precipitation1h` +
  `&timestep=60`

const CACHE_MS = 60 * 60 * 1000

export type WeatherHour = {
  time: string
  temperature: number | null
  symbol: number | null
  windMs: number | null
  precipitationMm: number | null
}

export type WeatherDay = {
  date: string
  label: string
  symbol: number | null
  symbolLabel: string
  tempMin: number | null
  tempMax: number | null
  precipMm: number
  windMaxMs: number | null
}

export type WeatherTip = {
  id: string
  title: string
  body: string
}

export type WeatherPayload = {
  place: string
  updatedAt: string
  current: {
    time: string
    temperature: number | null
    symbol: number | null
    symbolLabel: string
    windMs: number | null
    precipitationMm: number | null
  }
  days: WeatherDay[]
  tips: WeatherTip[]
  source: 'fmi-edited'
}

type CacheEntry = { at: number; data: WeatherPayload }

let cache: CacheEntry | null = null
let inflight: Promise<WeatherPayload> | null = null

/** FMI WeatherSymbol3 — https://en.ilmatieteenlaitos.fi/weather-symbols (numeric WFS codes) */
const SYMBOL_LABELS: Record<number, string> = {
  1: 'Selkeää',
  2: 'Puolipilvistä',
  3: 'Pilvistä',
  21: 'Sadekuuroja',
  22: 'Sadekuuroja',
  23: 'Voimakkaita sadekuuroja',
  31: 'Vesisadetta',
  32: 'Vesisadetta',
  33: 'Voimakasta vesisadetta',
  41: 'Lumikuuroja',
  42: 'Lumikuuroja',
  43: 'Voimakkaita lumikuuroja',
  51: 'Lumisadetta',
  52: 'Lumisadetta',
  53: 'Voimakasta lumisadetta',
  61: 'Ukkoskuuroja',
  62: 'Voimakkaita ukkoskuuroja',
  63: 'Ukkonen',
  64: 'Voimakasta ukkosta',
  71: 'Räntäkuuroja',
  72: 'Räntäkuuroja',
  73: 'Voimakkaita räntäkuuroja',
  81: 'Räntäsadetta',
  82: 'Räntäsadetta',
  83: 'Voimakasta räntäsadetta',
  91: 'Utua',
  92: 'Sumua',
}

export function symbolLabel(symbol: number | null | undefined): string {
  if (symbol == null || Number.isNaN(symbol)) return 'Sää'
  const code = Math.round(symbol)
  return SYMBOL_LABELS[code] || 'Vaihtelevaa'
}

/** Lumi tai räntä — ei vesisadetta (31–33). */
function isSnowy(symbol: number | null): boolean {
  if (symbol == null) return false
  const s = Math.round(symbol)
  return (
    (s >= 41 && s <= 43) ||
    (s >= 51 && s <= 53) ||
    (s >= 71 && s <= 73) ||
    (s >= 81 && s <= 83)
  )
}

function isRainy(symbol: number | null): boolean {
  if (symbol == null) return false
  const s = Math.round(symbol)
  return (s >= 21 && s <= 23) || (s >= 31 && s <= 33)
}

function parseFmiXml(xml: string): WeatherHour[] {
  const byTime = new Map<string, WeatherHour>()
  const re =
    /<BsWfs:Time>([^<]+)<\/BsWfs:Time>\s*<BsWfs:ParameterName>([^<]+)<\/BsWfs:ParameterName>\s*<BsWfs:ParameterValue>([^<]+)<\/BsWfs:ParameterValue>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(xml))) {
    const time = m[1]
    const name = m[2]
    const raw = m[3]
    const value = raw === 'NaN' ? null : Number(raw)
    let row = byTime.get(time)
    if (!row) {
      row = { time, temperature: null, symbol: null, windMs: null, precipitationMm: null }
      byTime.set(time, row)
    }
    if (name === 'Temperature') row.temperature = value
    else if (name === 'WeatherSymbol3') row.symbol = value == null ? null : Math.round(value)
    else if (name === 'WindSpeedMS') row.windMs = value
    else if (name === 'Precipitation1h') row.precipitationMm = value
  }
  return [...byTime.values()].sort((a, b) => a.time.localeCompare(b.time))
}

function helsinkiDate(isoUtc: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Helsinki',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(isoUtc))
}

function dayLabel(dateStr: string, todayStr: string): string {
  if (dateStr === todayStr) return 'Tänään'
  const [y, m, d] = todayStr.split('-').map(Number)
  const tomorrow = new Date(Date.UTC(y, m - 1, d + 1))
  const tomorrowStr = tomorrow.toISOString().slice(0, 10)
  if (dateStr === tomorrowStr) return 'Huomenna'
  const labelDate = new Date(`${dateStr}T12:00:00`)
  return new Intl.DateTimeFormat('fi-FI', { weekday: 'short' }).format(labelDate)
}

function buildDays(hours: WeatherHour[]): WeatherDay[] {
  const todayStr = helsinkiDate(new Date().toISOString())
  const groups = new Map<string, WeatherHour[]>()
  for (const h of hours) {
    const d = helsinkiDate(h.time)
    const list = groups.get(d) || []
    list.push(h)
    groups.set(d, list)
  }
  const days: WeatherDay[] = []
  for (const [date, list] of groups) {
    const temps = list.map((h) => h.temperature).filter((t): t is number => t != null)
    const winds = list.map((h) => h.windMs).filter((w): w is number => w != null)
    const precip = list.reduce((sum, h) => sum + (h.precipitationMm ?? 0), 0)
    // Pick midday-ish symbol, else first available
    const midday =
      list.find((h) => {
        const hour = Number(
          new Intl.DateTimeFormat('en-GB', {
            timeZone: 'Europe/Helsinki',
            hour: '2-digit',
            hour12: false,
          }).format(new Date(h.time)),
        )
        return hour >= 12 && hour <= 15 && h.symbol != null
      }) || list.find((h) => h.symbol != null)
    const symbol = midday?.symbol ?? null
    days.push({
      date,
      label: dayLabel(date, todayStr),
      symbol,
      symbolLabel: symbolLabel(symbol),
      tempMin: temps.length ? Math.min(...temps) : null,
      tempMax: temps.length ? Math.max(...temps) : null,
      precipMm: Math.round(precip * 10) / 10,
      windMaxMs: winds.length ? Math.max(...winds) : null,
    })
    if (days.length >= 3) break
  }
  return days
}

function buildTips(days: WeatherDay[], current: WeatherHour | undefined): WeatherTip[] {
  const tips: WeatherTip[] = []
  const window = days.slice(0, 3)
  const snowDay = window.find(
    (d) =>
      isSnowy(d.symbol) ||
      (d.symbol == null &&
        d.tempMax != null &&
        d.tempMax <= 1 &&
        d.precipMm >= 1 &&
        !isRainy(d.symbol)),
  )
  const rainDay = window.find((d) => isRainy(d.symbol) && d.precipMm >= 0.2)
  const freezeRisk = window.some(
    (d) =>
      d.tempMin != null &&
      d.tempMax != null &&
      d.tempMin <= 0 &&
      d.tempMax >= 0 &&
      d.precipMm >= 0.5,
  )
  const windy = window.some((d) => (d.windMaxMs ?? 0) >= 12) || (current?.windMs ?? 0) >= 12

  if (snowDay) {
    tips.push({
      id: 'snow',
      title: 'Lumityöt',
      body:
        snowDay.label === 'Tänään'
          ? 'Lunta tai räntää tulossa — lumityöt ajoissa ennen väkeä.'
          : `${snowDay.label} lumisadetta — suunnittele lumityöt etukäteen.`,
    })
  }
  if (freezeRisk) {
    tips.push({
      id: 'ice',
      title: 'Liukkaus',
      body: 'Lämpötila käy nollan molemmin puolin — hiekoitus kannattaa.',
    })
  } else if (rainDay && !snowDay) {
    tips.push({
      id: 'rain',
      title: 'Sade',
      body:
        rainDay.label === 'Tänään'
          ? 'Sadekuuroja tänään — märät pinnat, tarkista sisäänkäynnit.'
          : `${rainDay.label} sadetta — märät pinnat mahdollisia.`,
    })
  }
  if (windy) {
    tips.push({
      id: 'wind',
      title: 'Tuuli',
      body: 'Kovaa tuulta — tarkista piha: roskat, oksat ja irtotavara.',
    })
  }
  return tips.slice(0, 2)
}

function pickCurrent(hours: WeatherHour[]): WeatherHour | undefined {
  const now = Date.now()
  let best: WeatherHour | undefined
  let bestDiff = Infinity
  for (const h of hours) {
    const t = new Date(h.time).getTime()
    const diff = Math.abs(t - now)
    if (diff < bestDiff) {
      best = h
      bestDiff = diff
    }
  }
  return best
}

async function fetchFromFmi(): Promise<WeatherPayload> {
  const res = await fetch(FMI_URL, {
    headers: { Accept: 'application/xml,text/xml,*/*' },
    signal: AbortSignal.timeout(12_000),
  })
  if (!res.ok) throw new Error(`FMI ${res.status}`)
  const xml = await res.text()
  const hours = parseFmiXml(xml)
  if (!hours.length) throw new Error('FMI tyhjä vastaus')
  const currentHour = pickCurrent(hours)
  const days = buildDays(hours)
  return {
    place: WEATHER_PLACE.name,
    updatedAt: new Date().toISOString(),
    current: {
      time: currentHour?.time || hours[0].time,
      temperature: currentHour?.temperature ?? null,
      symbol: currentHour?.symbol ?? null,
      symbolLabel: symbolLabel(currentHour?.symbol),
      windMs: currentHour?.windMs ?? null,
      precipitationMm: currentHour?.precipitationMm ?? null,
    },
    days,
    tips: buildTips(days, currentHour),
    source: 'fmi-edited',
  }
}

export async function getWeather(): Promise<WeatherPayload> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.data
  if (inflight) return inflight
  inflight = fetchFromFmi()
    .then((data) => {
      cache = { at: Date.now(), data }
      return data
    })
    .finally(() => {
      inflight = null
    })
  try {
    return await inflight
  } catch (err) {
    if (cache) return cache.data
    throw err
  }
}
