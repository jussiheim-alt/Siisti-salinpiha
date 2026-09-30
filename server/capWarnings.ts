/** FMI CAP weather warnings (Atom feed) filtered to the Vääksy property point. */

import { WEATHER_PLACE } from './weather.ts'

const CAP_ATOM = 'https://alerts.fmi.fi/cap/feed/atom_fi-FI.xml'
const CACHE_MS = 20 * 60 * 1000

/** Yard-relevant CAP event codes (FMI profile). Sea warnings excluded. */
const YARD_EVENT_CODES = new Set([
  'wind',
  'rain',
  'pedestrianSafety',
  'trafficWeather',
  'thunderstorm',
  'coldWeather',
  'hotWeather',
  'forestFireWeather',
])

const EVENT_TITLES: Record<string, string> = {
  wind: 'Tuulivaroitus',
  rain: 'Sadevaroitus',
  pedestrianSafety: 'Jalankulkusää',
  trafficWeather: 'Liikennesää',
  thunderstorm: 'Ukkosvaroitus',
  coldWeather: 'Pakkasvaroitus',
  hotWeather: 'Hellevaroitus',
  forestFireWeather: 'Maastopalovaroitus',
}

const SEVERITY_FI: Record<string, string> = {
  Extreme: 'Punainen',
  Severe: 'Oranssi',
  Moderate: 'Keltainen',
  Minor: 'Vihreä',
  Unknown: 'Varoitus',
}

export type CapWarning = {
  id: string
  eventCode: string
  event: string
  severity: string
  severityLabel: string
  headline: string
  description: string
  onset?: string | null
  expires?: string | null
  areas: string[]
  link: string
}

type CacheEntry = { at: number; data: CapWarning[] }
let cache: CacheEntry | null = null
let inflight: Promise<CapWarning[]> | null = null

function tag(xml: string, name: string): string {
  const m = xml.match(new RegExp(`<(?:[a-zA-Z0-9_]+:)?${name}[^>]*>([\\s\\S]*?)</(?:[a-zA-Z0-9_]+:)?${name}>`, 'i'))
  return m ? m[1]!.trim() : ''
}

function allTags(xml: string, name: string): string[] {
  const re = new RegExp(`<(?:[a-zA-Z0-9_]+:)?${name}[^>]*>([\\s\\S]*?)</(?:[a-zA-Z0-9_]+:)?${name}>`, 'gi')
  const out: string[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(xml))) out.push(m[1]!.trim())
  return out
}

function attr(xmlChunk: string, name: string): string {
  const m = xmlChunk.match(new RegExp(`${name}="([^"]+)"`, 'i'))
  return m ? m[1]! : ''
}

function pointInRing(lat: number, lon: number, ring: Array<[number, number]>): boolean {
  let inside = false
  const n = ring.length
  if (n < 3) return false
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [yi, xi] = ring[i]!
    const [yj, xj] = ring[j]!
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi + 1e-15) + xi) {
      inside = !inside
    }
  }
  return inside
}

function polygonContains(lat: number, lon: number, polygonText: string): boolean {
  const pts: Array<[number, number]> = []
  for (const pair of polygonText.trim().split(/\s+/)) {
    const parts = pair.split(',')
    if (parts.length < 2) continue
    pts.push([Number(parts[0]), Number(parts[1])])
  }
  return pointInRing(lat, lon, pts)
}

/** Pick Finnish <info> block when several languages exist. */
function pickFiInfo(xml: string): string {
  const infos = allTags(xml, 'info')
  if (!infos.length) return ''
  const fi = infos.find((i) => /^fi/i.test(tag(i, 'language')))
  return fi || infos[0]!
}

function parseCapDocument(xml: string, link: string): CapWarning | null {
  const info = pickFiInfo(xml)
  if (!info) return null

  let eventCode = ''
  for (const ec of allTags(info, 'eventCode')) {
    const name = tag(ec, 'valueName')
    if (name.includes('profile:cap') || name.includes('eventCode') || !eventCode) {
      const value = tag(ec, 'value')
      if (value) eventCode = value
      if (name.includes('profile:cap')) break
    }
  }
  if (!eventCode || !YARD_EVENT_CODES.has(eventCode)) return null

  const areas: string[] = []
  let covers = false
  for (const area of allTags(info, 'area')) {
    const desc = tag(area, 'areaDesc')
    if (desc) areas.push(desc)
    for (const poly of allTags(area, 'polygon')) {
      if (polygonContains(WEATHER_PLACE.lat, WEATHER_PLACE.lon, poly)) covers = true
    }
    if (!covers && /asikkala|vääksy|päijät-häme|päijät/i.test(desc)) covers = true
  }
  if (!covers) return null

  const severity = tag(info, 'severity') || 'Unknown'
  const event = tag(info, 'event') || EVENT_TITLES[eventCode] || eventCode
  const headline = tag(info, 'headline') || event
  const description = tag(info, 'description') || ''
  const id = tag(xml, 'identifier') || link

  return {
    id,
    eventCode,
    event,
    severity,
    severityLabel: SEVERITY_FI[severity] || severity,
    headline,
    description: description.slice(0, 280),
    onset: tag(info, 'onset') || null,
    expires: tag(info, 'expires') || null,
    areas: areas.slice(0, 8),
    link,
  }
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { Accept: 'application/atom+xml,application/xml,text/xml,*/*' },
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`CAP ${res.status}`)
  return res.text()
}

function atomEntryLinks(atomXml: string): string[] {
  const links: string[] = []
  for (const entry of allTags(atomXml, 'entry')) {
    const linkTags = entry.match(/<link\b[^>]*>/gi) || []
    for (const lt of linkTags) {
      const href = attr(lt, 'href')
      if (href.includes('/cap/')) links.push(href)
    }
  }
  return [...new Set(links)]
}

async function fetchActiveWarnings(): Promise<CapWarning[]> {
  const atom = await fetchText(CAP_ATOM)
  const links = atomEntryLinks(atom)
  const warnings: CapWarning[] = []

  for (const href of links.slice(0, 40)) {
    try {
      const xml = await fetchText(href)
      const parsed = parseCapDocument(xml, href)
      if (parsed) warnings.push(parsed)
    } catch (err) {
      console.warn('CAP entry failed', href, err)
    }
  }

  const severityRank: Record<string, number> = {
    Extreme: 0,
    Severe: 1,
    Moderate: 2,
    Minor: 3,
    Unknown: 4,
  }
  warnings.sort(
    (a, b) => (severityRank[a.severity] ?? 9) - (severityRank[b.severity] ?? 9),
  )
  return warnings
}

export async function getCapWarnings(): Promise<CapWarning[]> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.data
  if (inflight) return inflight
  inflight = fetchActiveWarnings()
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
    console.warn('CAP fetch failed', err)
    return []
  }
}

export function capToAlertTips(
  warnings: CapWarning[],
): Array<{ id: string; title: string; body: string }> {
  return warnings.slice(0, 3).map((w) => ({
    id: `cap:${w.eventCode}`,
    title: `${w.severityLabel} ${EVENT_TITLES[w.eventCode] || w.event}`,
    body: w.headline || w.description || w.event,
  }))
}
