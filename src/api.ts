const TOKEN_KEY = 'siisti-piha-token'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

export const isLocalDataMode = import.meta.env.VITE_DATA_MODE === 'local'

type ApiOptions = Omit<RequestInit, 'body'> & {
  json?: unknown
  formData?: FormData
}

export async function api<T = unknown>(path: string, options: ApiOptions = {}): Promise<T> {
  if (isLocalDataMode) {
    const { localApi } = await import('./local/backend')
    return localApi<T>(path, {
      method: options.method,
      json: options.json,
      formData: options.formData,
    })
  }

  const headers = new Headers(options.headers || {})
  const token = getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)

  let body: BodyInit | undefined
  if (options.formData) {
    body = options.formData
  } else if (options.json !== undefined) {
    headers.set('Content-Type', 'application/json')
    body = JSON.stringify(options.json)
  }

  const res = await fetch(path, {
    method: options.method,
    headers,
    body,
    credentials: 'include',
  }).catch(() => null)

  if (!res) {
    throw new Error('Ei yhteyttä palvelimeen. Tarkista verkko tai demo-osoite.')
  }

  const contentType = res.headers.get('content-type') || ''
  const data = contentType.includes('application/json')
    ? await res.json().catch(() => ({}))
    : {}

  if (!res.ok) {
    const msg = (data as { error?: string }).error
    if (msg) throw new Error(msg)
    if (res.status >= 500) {
      throw new Error('Palvelin ei vastaa juuri nyt. Kokeile hetken päästä uudelleen.')
    }
    throw new Error('Pyyntö epäonnistui')
  }
  return data as T
}

export type User = {
  id: string
  name: string
  email: string
  role: 'admin' | 'member'
  active: boolean
  constraints: string[]
  constraintNote?: string | null
  snoozeUntil?: string | null
}

export type Assignment = {
  id: string
  userId: string
  role: 'lead' | 'helper'
  userName: string
  constraints: string[]
  constraintLabels: string[]
}

export type ShiftTask = {
  id: string
  templateId?: string
  title: string
  instructions: string
  effort: 'light' | 'heavy'
  assigneeUserId?: string | null
  assigneeName?: string | null
  status: 'open' | 'done' | 'skipped'
  skipReason?: string | null
  doneByName?: string | null
  doneAt?: string | null
}

export type TaskTemplate = {
  id: string
  title: string
  instructions: string
  season: 'talvi' | 'sulankausi' | 'all'
  cadence: 'every_week' | 'as_needed'
  defaultAssignee: 'lead' | 'helpers' | 'all'
  effort: 'light' | 'heavy'
  sortOrder: number
}

export type Pihavuoro = {
  id: string
  weekStart: string
  weekEnd: string
  status: 'draft' | 'published' | 'done'
  season: 'talvi' | 'sulankausi'
  notes?: string | null
  assignments: Assignment[]
  tasks: ShiftTask[]
}

export type Notice = {
  id: string
  body: string
  photoUrl?: string | null
  status: 'open' | 'in_progress' | 'resolved'
  authorName: string
  authorUserId: string
  createdAt: string
  replies: { id: string; body: string; authorName: string; createdAt: string }[]
}

export type ExtraTask = {
  id: string
  title: string
  description?: string | null
  minRequired: number
  status: 'open' | 'ready' | 'in_progress' | 'done' | 'cancelled'
  createdByUserId: string
  createdByName: string
  createdAt: string
  signups: { id: string; userId: string; userName: string; signedUpAt: string }[]
  signupCount: number
  spotsLeft: number
  iSignedUp: boolean
}

export type WeatherTip = {
  id: string
  title: string
  body: string
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
  warnings?: CapWarning[]
}

export type AppNotification = {
  id: string
  title: string
  body: string
  link?: string | null
  kind: string
  readAt?: string | null
  createdAt: string
}

export type HubInspectionItem = {
  id: string
  templateItemId: string
  label: string
  sortOrder: number
  status: 'open' | 'ok' | 'issue'
  note?: string | null
}

export type HubInspection = {
  id: string
  templateId: string
  year: number
  title: string
  cadenceLabel: string
  windowStart: string
  windowEnd: string
  intro?: string | null
  status: 'open' | 'in_progress' | 'done'
  notes?: string | null
  photoUrl?: string | null
  completedByUserId?: string | null
  completedByName?: string | null
  completedAt?: string | null
  createdAt: string
  items: HubInspectionItem[]
  doneCount: number
  issueCount: number
  itemCount: number
  protocol: string[]
}

export type HubSummary = {
  year: number
  openCount: number
  dueCount: number
  issueCount: number
}

export type AvailabilityWeek = {
  weekStart: string
  weekEnd: string
  blocked: boolean
  published: boolean
  myRole: string | null
}

export type SwapOffer = {
  id: string
  pihavuoroId: string
  weekStart: string
  weekEnd: string
  pihavuoroStatus?: string | null
  fromUserId: string
  fromUserName: string
  toUserId?: string | null
  toUserName?: string | null
  role: 'lead' | 'helper'
  message?: string | null
  status: 'open' | 'accepted' | 'cancelled'
  createdAt: string
  resolvedAt?: string | null
  acceptedByUserId?: string | null
  acceptedByUserName?: string | null
}

export type ShiftMessage = {
  id: string
  pihavuoroId: string
  authorUserId: string
  authorName: string
  body: string
  createdAt: string
}
