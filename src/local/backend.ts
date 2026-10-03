import { CONSTRAINT_LABELS, TASK_CATALOG_V1 } from '../shared/catalog'
import { getWeather } from '../shared/fmiWeather'
import {
  DEFAULT_APP_SETTINGS,
  normalizeAppSettings,
  type AppSettings,
} from '../shared/appSettings'
import { DEFAULT_LEAD_GUIDE, normalizeLeadGuide, type LeadGuide } from '../shared/leadGuide'
import {
  isCadenceKey,
  isSeasonKey,
  SEASON_LABELS,
  seasonForWeekStart,
  type SeasonKey,
  type TaskCadence,
} from '../shared/seasons'
import { formatWeekRangeFi } from '../shared/datetime'
import { isOwnerEmail } from '../shared/owner'
import { seedTaskCardsFromCatalog, type TaskCard } from '../shared/taskCards'
import {
  normalizeTravelGroup,
  pickLeadAndHelpers,
  resolveHelperCount,
} from '../shared/travelGroup'


const DB_KEY = 'siisti-piha-local-db-v3'
const SESSION_KEY = 'siisti-piha-local-session'

const HUB_ISSUE_PROTOCOL = [
  'Kirjaa havainnot huomautuksiin. Lisää kuva liitteisiin, jos siitä on apua.',
  'Kerro huoltokoordinaattorille / valtakunnansalikomitean koordinaattorille.',
  'Jos mahdollista, tee korjaukset saatujen ohjeiden mukaan.',
  'Kirjaa tehdyt korjaukset huomautuksiin.',
]

type Role = 'admin' | 'member'
type User = {
  id: string
  name: string
  email: string
  passwordHash: string
  role: Role
  active: boolean
  constraints: string[]
  constraintNote?: string | null
  snoozeUntil?: string | null
  travelGroup?: string | null
  createdAt: string
}

type Assignment = { id: string; userId: string; role: 'lead' | 'helper' }
type ShiftTask = {
  id: string
  templateId?: string
  title: string
  instructions: string
  effort: 'light' | 'heavy'
  assigneeUserId?: string | null
  status: 'open' | 'done' | 'skipped'
  skipReason?: string | null
  doneByUserId?: string | null
  doneAt?: string | null
  sortOrder: number
}
type Pihavuoro = {
  id: string
  weekStart: string
  status: 'draft' | 'published' | 'done'
  season: SeasonKey
  notes?: string | null
  createdAt: string
  assignments: Assignment[]
  tasks: ShiftTask[]
}
type Notice = {
  id: string
  authorUserId: string
  body: string
  photoDataUrl?: string | null
  status: 'open' | 'in_progress' | 'resolved'
  audience: 'all' | 'leads'
  acknowledgedAt?: string | null
  acknowledgedByUserId?: string | null
  createdAt: string
  resolvedAt?: string | null
  replies: { id: string; authorUserId: string; body: string; createdAt: string }[]
}
type SwapOffer = {
  id: string
  pihavuoroId: string
  fromUserId: string
  toUserId?: string | null
  role: 'lead' | 'helper'
  message?: string | null
  status: 'open' | 'accepted' | 'cancelled'
  createdAt: string
  resolvedAt?: string | null
  acceptedByUserId?: string | null
}
type ShiftMessage = {
  id: string
  pihavuoroId: string
  authorUserId: string
  body: string
  createdAt: string
}
type WeekBlock = { id: string; userId: string; weekStart: string; createdAt: string }
type Notification = {
  id: string
  userId: string
  title: string
  body: string
  link?: string | null
  kind: string
  readAt?: string | null
  createdAt: string
}
type HubInspection = {
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
  photoDataUrl?: string | null
  completedByUserId?: string | null
  completedAt?: string | null
  createdAt: string
  activatedAt?: string | null
  activatedByUserId?: string | null
  items: {
    id: string
    templateItemId: string
    label: string
    sortOrder: number
    status: 'open' | 'ok' | 'issue'
    note?: string | null
  }[]
}

type Invite = {
  id: string
  token: string
  name: string
  email: string
  role: Role
  constraints: string[]
  travelGroup?: string | null
  createdByUserId: string
  createdAt: string
  expiresAt: string
  acceptedAt?: string | null
  revokedAt?: string | null
}

type Db = {
  users: User[]
  invites: Invite[]
  pihavuorot: Pihavuoro[]
  notices: Notice[]
  swaps: SwapOffer[]
  messages: ShiftMessage[]
  weekBlocks: WeekBlock[]
  notifications: Notification[]
  hub: HubInspection[]
  taskCards: TaskCard[]
  leadGuide?: LeadGuide
  appSettings?: AppSettings
  extraTasks: {
    id: string
    createdByUserId: string
    title: string
    description?: string | null
    minRequired: number
    status: string
    createdAt: string
    signups: { id: string; userId: string; signedUpAt: string }[]
  }[]
}

function uid() {
  return crypto.randomUUID()
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function mondayOf(dateStr?: string) {
  const d = dateStr ? new Date(`${dateStr}T12:00:00`) : new Date()
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d.toISOString().slice(0, 10)
}

function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T12:00:00`)
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

function seasonFor(weekStart: string): SeasonKey {
  return seasonForWeekStart(weekStart)
}

async function hashPassword(password: string) {
  const data = new TextEncoder().encode(`siisti:${password}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function normalizeDb(db: Db): Db {
  if (!db.invites) db.invites = []
  if (!Array.isArray(db.taskCards) || db.taskCards.length === 0) {
    db.taskCards = seedTaskCardsFromCatalog()
  }
  // Vastuuveli-ohjeet eivät ole tehtäväkortti
  db.taskCards = db.taskCards.filter(
    (c) => c.id !== 'T5' && !c.title.startsWith('Vastuuveli: viikon tilanne'),
  )
  db.leadGuide = normalizeLeadGuide(db.leadGuide || DEFAULT_LEAD_GUIDE)
  db.appSettings = normalizeAppSettings(db.appSettings || DEFAULT_APP_SETTINGS)
  for (const p of db.pihavuorot) {
    if (!isSeasonKey(p.season)) {
      p.season = seasonForWeekStart(p.weekStart)
    }
  }
  for (const n of db.notices) {
    if (n.audience !== 'all' && n.audience !== 'leads') n.audience = 'all'
    if (n.acknowledgedAt === undefined) n.acknowledgedAt = null
    if (n.acknowledgedByUserId === undefined) n.acknowledgedByUserId = null
  }
  for (const u of db.users) {
    if (u.travelGroup === undefined) u.travelGroup = null
  }
  for (const inv of db.invites) {
    if (inv.travelGroup === undefined) inv.travelGroup = null
  }
  return db
}

function loadDb(): Db {
  const raw = localStorage.getItem(DB_KEY)
  if (raw) {
    const parsed = JSON.parse(raw) as Db
    return normalizeDb(parsed)
  }
  // Migrate previous local key if present
  const legacy = localStorage.getItem('siisti-piha-local-db-v2')
  if (legacy) {
    try {
      const parsed = JSON.parse(legacy) as Db
      const next = normalizeDb(parsed)
      localStorage.setItem(DB_KEY, JSON.stringify(next))
      return next
    } catch {
      /* fall through */
    }
  }
  return normalizeDb({
    users: [],
    invites: [],
    pihavuorot: [],
    notices: [],
    swaps: [],
    messages: [],
    weekBlocks: [],
    notifications: [],
    hub: [],
    taskCards: seedTaskCardsFromCatalog(),
    extraTasks: [],
  })
}

function saveDb(db: Db) {
  localStorage.setItem(DB_KEY, JSON.stringify(db))
}

async function ensureDemoMembers(db: Db, passwordHash: string) {
  const demoMembers = [
    'Anna Korhonen',
    'Mikko Virtanen',
    'Liisa Mäkinen',
    'Pekka Nieminen',
    'Sari Laine',
  ]
  const now = new Date().toISOString()
  let added = false
  for (const name of demoMembers) {
    if (db.users.some((u) => u.name === name)) continue
    const slug = name
      .toLowerCase()
      .replace(/ä/g, 'a')
      .replace(/ö/g, 'o')
      .replace(/\s+/g, '.')
    db.users.push({
      id: uid(),
      name,
      email: `${slug}@example.com`,
      passwordHash,
      role: 'member',
      active: true,
      constraints: [],
      createdAt: now,
    })
    added = true
  }
  if (added) saveDb(db)
}

async function ensureSeed(db: Db) {
  if (!db.invites) db.invites = []
  const viteEnv = (import.meta as ImportMeta & { env?: ImportMetaEnv }).env
  const localPass = viteEnv?.VITE_LOCAL_ADMIN_PASSWORD || 'vaihda-tama-8'
  const adminHash = await hashPassword(localPass)
  if (db.users.length) {
    await ensureDemoMembers(db, adminHash)
    return db
  }
  const now = new Date().toISOString()
  // Selaintila: vain oikeat ylläpitäjät. Salasana vaihdetaan tuotannossa env/kutsuilla.
  db.users = [
    {
      id: uid(),
      name: 'Jussi Heimonen',
      email: 'jussiheim@gmail.com',
      passwordHash: adminHash,
      role: 'admin',
      active: true,
      constraints: [],
      createdAt: now,
    },
  ]
  // Joni lisätään kutsulla tai kun VITE_JONI_EMAIL on asetettu buildissa
  const joniEmail = String(viteEnv?.VITE_JONI_EMAIL || '').trim().toLowerCase()
  if (joniEmail) {
    db.users.push({
      id: uid(),
      name: 'Joni Moilanen',
      email: joniEmail,
      passwordHash: adminHash,
      role: 'admin',
      active: true,
      constraints: [],
      createdAt: now,
    })
  }
  await ensureDemoMembers(db, adminHash)

  const year = new Date().getFullYear()
  db.hub = [
    {
      id: uid(),
      templateId: 'hub-spring',
      year,
      title: 'Kevättarkastus',
      cadenceLabel: 'Kevät',
      windowStart: `${year}-04-01`,
      windowEnd: `${year}-05-31`,
      intro: 'Tarkista piha-alueen kevätkunto.',
      status: 'open',
      createdAt: now,
      items: [
        { id: uid(), templateItemId: '1', label: 'Sadevesijärjestelmä', sortOrder: 1, status: 'open' },
        { id: uid(), templateItemId: '2', label: 'Pihavarusteet', sortOrder: 2, status: 'open' },
        { id: uid(), templateItemId: '3', label: 'Kulku-urat ja portaat', sortOrder: 3, status: 'open' },
        { id: uid(), templateItemId: '4', label: 'Roska-alue', sortOrder: 4, status: 'open' },
        { id: uid(), templateItemId: '5', label: 'Valaisimet', sortOrder: 5, status: 'open' },
      ],
    },
  ]
  for (const u of db.users) {
    db.notifications.push({
      id: uid(),
      userId: u.id,
      title: 'Tervetuloa Siisti salin pihaan',
      body: 'Täältä näet ilmoitukset vuorosta, huomioista ja apukutsuista.',
      link: '/',
      kind: 'general',
      createdAt: now,
    })
  }
  saveDb(db)
  return db
}

function publicInvite(inv: Invite, inviteUrl?: string) {
  const expired = new Date(inv.expiresAt) < new Date()
  return {
    id: inv.id,
    name: inv.name,
    email: inv.email,
    role: inv.role,
    constraints: inv.constraints,
    travelGroup: inv.travelGroup ?? null,
    createdAt: inv.createdAt,
    expiresAt: inv.expiresAt,
    acceptedAt: inv.acceptedAt ?? null,
    revokedAt: inv.revokedAt ?? null,
    inviteUrl: inviteUrl ?? null,
    status: inv.revokedAt
      ? 'revoked'
      : inv.acceptedAt
        ? 'accepted'
        : expired
          ? 'expired'
          : 'pending',
  }
}

function publicUser(u: User) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    active: u.active,
    constraints: u.constraints,
    constraintNote: u.constraintNote ?? null,
    snoozeUntil: u.snoozeUntil ?? null,
    travelGroup: u.travelGroup ?? null,
  }
}

function hydratePihavuoro(db: Db, p: Pihavuoro) {
  const season = isSeasonKey(p.season) ? p.season : seasonForWeekStart(p.weekStart)
  return {
    id: p.id,
    weekStart: p.weekStart,
    weekEnd: addDays(p.weekStart, 6),
    status: p.status,
    season,
    seasonLabel: SEASON_LABELS[season],
    notes: p.notes ?? null,
    createdAt: p.createdAt,
    assignments: p.assignments
      .map((a) => {
        const u = db.users.find((x) => x.id === a.userId)
        return {
          id: a.id,
          userId: a.userId,
          role: a.role,
          userName: u?.name || '—',
          constraints: u?.constraints || [],
          constraintLabels: (u?.constraints || []).map((c) => CONSTRAINT_LABELS[c] || c),
        }
      })
      .sort((a, b) => (a.role === 'lead' ? -1 : b.role === 'lead' ? 1 : a.userName.localeCompare(b.userName, 'fi'))),
    tasks: p.tasks
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((t) => {
        const assignee = t.assigneeUserId ? db.users.find((u) => u.id === t.assigneeUserId) : null
        const doneBy = t.doneByUserId ? db.users.find((u) => u.id === t.doneByUserId) : null
        return {
          id: t.id,
          templateId: t.templateId,
          title: t.title,
          instructions: t.instructions,
          effort: t.effort,
          assigneeUserId: t.assigneeUserId ?? null,
          assigneeName: assignee?.name ?? null,
          status: t.status,
          skipReason: t.skipReason ?? null,
          doneByUserId: t.doneByUserId ?? null,
          doneByName: doneBy?.name ?? null,
          doneAt: t.doneAt ?? null,
          sortOrder: t.sortOrder,
        }
      }),
  }
}

function defaultTemplateIdsForSeason(season: SeasonKey, db: Db): string[] {
  return db.taskCards
    .filter((t) => t.active && t.season === season && t.cadence === 'weekly')
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((t) => t.id)
}

function resolveTemplatesForSeason(
  season: SeasonKey,
  db: Db,
  templateIds?: string[] | null,
): TaskCard[] {
  const seasonTemplates = db.taskCards
    .filter((t) => t.active && t.season === season)
    .sort((a, b) => a.sortOrder - b.sortOrder)
  if (!templateIds || templateIds.length === 0) {
    return seasonTemplates.filter((t) => t.cadence === 'weekly')
  }
  const wanted = new Set(templateIds)
  return seasonTemplates.filter((t) => wanted.has(t.id))
}

function createTasks(
  season: SeasonKey,
  _assignments: Assignment[],
  db: Db,
  templateIds?: string[] | null,
): ShiftTask[] {
  const templates = resolveTemplatesForSeason(season, db, templateIds)
  // Tehtävät ovat koko vuoron yhteisiä — ei henkilökohtaista nimeämistä
  return templates.map((t, idx) => ({
    id: uid(),
    templateId: t.id,
    title: t.title,
    instructions: t.instructions,
    effort: t.effort,
    assigneeUserId: null,
    status: 'open' as const,
    sortOrder: t.sortOrder || idx * 10,
  }))
}

function getSessionUser(db: Db): User | null {
  let sid = sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY)
  if (!sid) {
    const token = localStorage.getItem('siisti-piha-token')
    if (token?.startsWith('local.')) sid = token.slice('local.'.length)
  }
  if (!sid) return null
  return db.users.find((u) => u.id === sid && u.active) || null
}

function setSession(userId: string | null) {
  if (userId) {
    sessionStorage.setItem(SESSION_KEY, userId)
    localStorage.setItem(SESSION_KEY, userId)
  } else {
    sessionStorage.removeItem(SESSION_KEY)
    localStorage.removeItem(SESSION_KEY)
  }
}

function notify(db: Db, userIds: string[], title: string, body: string, link: string, kind: string) {
  const now = new Date().toISOString()
  for (const userId of [...new Set(userIds)]) {
    db.notifications.unshift({
      id: uid(),
      userId,
      title,
      body,
      link,
      kind,
      createdAt: now,
    })
  }
}

function upcomingMondays(count = 10) {
  const start = mondayOf()
  return Array.from({ length: count }, (_, i) => addDays(start, i * 7))
}

function parsePath(path: string) {
  const [pathname, search = ''] = path.split('?')
  const params = new URLSearchParams(search)
  return { pathname: pathname || '/', params }
}

function publishedCoveringToday(db: Db) {
  const todayStr = today()
  return db.pihavuorot.filter(
    (p) =>
      p.status === 'published' &&
      p.weekStart <= todayStr &&
      addDays(p.weekStart, 6) >= todayStr,
  )
}

function currentPublishedWeekLeads(db: Db): string[] {
  const covering = publishedCoveringToday(db)
  const weeks =
    covering.length > 0
      ? covering
      : (() => {
          const next = db.pihavuorot
            .filter((p) => p.status === 'published' && p.weekStart >= mondayOf())
            .sort((a, b) => a.weekStart.localeCompare(b.weekStart))[0]
          return next ? [next] : []
        })()
  return weeks.flatMap((p) =>
    p.assignments.filter((a) => a.role === 'lead').map((a) => a.userId),
  )
}

function noticeVisibleTo(db: Db, n: Notice, user: User) {
  if (user.role === 'admin' || n.authorUserId === user.id) return true
  if (n.audience === 'all') return true
  if (n.audience === 'leads') {
    return db.pihavuorot.some(
      (p) =>
        p.status === 'published' &&
        p.assignments.some((a) => a.userId === user.id && a.role === 'lead'),
    )
  }
  return false
}

function hydrateNotice(db: Db, n: Notice) {
  const ackUser = n.acknowledgedByUserId
    ? db.users.find((u) => u.id === n.acknowledgedByUserId)
    : null
  return {
    id: n.id,
    body: n.body,
    photoUrl: n.photoDataUrl || null,
    status: n.status,
    audience: n.audience || 'all',
    acknowledgedAt: n.acknowledgedAt ?? null,
    acknowledgedByName: ackUser?.name ?? null,
    authorName: db.users.find((u) => u.id === n.authorUserId)?.name || '—',
    authorUserId: n.authorUserId,
    createdAt: n.createdAt,
    replies: n.replies.map((r) => ({
      id: r.id,
      body: r.body,
      authorName: db.users.find((u) => u.id === r.authorUserId)?.name || '—',
      authorUserId: r.authorUserId,
      createdAt: r.createdAt,
    })),
  }
}

export async function localApi<T = unknown>(
  path: string,
  options: { method?: string; json?: unknown; formData?: FormData; headers?: Headers } = {},
): Promise<T> {
  let db = await ensureSeed(loadDb())
  const method = (options.method || 'GET').toUpperCase()
  const { pathname, params } = parsePath(path)
  const body = (options.json || {}) as Record<string, unknown>
  const user = getSessionUser(db)

  const ok = (data: unknown) => data as T
  const err = (message: string) => {
    throw new Error(message)
  }

  // Auth
  if (pathname === '/api/auth/login' && method === 'POST') {
    const email = String(body.email || '').trim()
    const password = String(body.password || '')
    const hash = await hashPassword(password)
    const found = db.users.find((u) => u.email.toLowerCase() === email.toLowerCase() && u.active)
    if (!found || found.passwordHash !== hash) err('Virheellinen tunnus tai salasana')
    setSession(found!.id)
    const token = `local.${found!.id}`
    return ok({ token, user: publicUser(found!) })
  }
  if (pathname === '/api/auth/logout' && method === 'POST') {
    setSession(null)
    return ok({ ok: true })
  }
  if (pathname === '/api/auth/me' && method === 'GET') {
    if (!user) err('Istunto vanhentunut')
    return ok({ user: publicUser(user!) })
  }

  const inviteTokenGet = pathname.match(/^\/api\/invites\/token\/([^/]+)$/)
  if (inviteTokenGet && method === 'GET') {
    const inv = db.invites.find((i) => i.token === inviteTokenGet[1])
    if (!inv || inv.revokedAt) err('Kutsu ei ole voimassa')
    if (inv!.acceptedAt) err('Kutsu on jo käytetty')
    if (new Date(inv!.expiresAt) < new Date()) err('Kutsu on vanhentunut')
    return ok({
      invite: {
        name: inv!.name,
        email: inv!.email,
        role: inv!.role,
        constraints: inv!.constraints,
        expiresAt: inv!.expiresAt,
      },
    })
  }
  const inviteTokenAccept = pathname.match(/^\/api\/invites\/token\/([^/]+)\/accept$/)
  if (inviteTokenAccept && method === 'POST') {
    const inv = db.invites.find((i) => i.token === inviteTokenAccept[1])
    if (!inv || inv.revokedAt) err('Kutsu ei ole voimassa')
    if (inv!.acceptedAt) err('Kutsu on jo käytetty')
    if (new Date(inv!.expiresAt) < new Date()) err('Kutsu on vanhentunut')
    const password = String(body.password || '')
    if (password.length < 8) err('Salasanan oltava vähintään 8 merkkiä')
    if (db.users.some((u) => u.email.toLowerCase() === inv!.email.toLowerCase())) {
      err('Käyttäjä on jo olemassa')
    }
    const nu: User = {
      id: uid(),
      name: inv!.name,
      email: inv!.email,
      passwordHash: await hashPassword(password),
      role: inv!.role,
      active: true,
      constraints: [...inv!.constraints],
      travelGroup: inv!.travelGroup ?? null,
      createdAt: new Date().toISOString(),
    }
    inv!.acceptedAt = new Date().toISOString()
    db.users.push(nu)
    setSession(nu.id)
    saveDb(db)
    return ok({ token: `local.${nu.id}`, user: publicUser(nu) })
  }

  if (!user && pathname.startsWith('/api/')) err('Istunto vanhentunut')

  if (pathname === '/api/users' && method === 'GET') {
    if (user!.role !== 'admin') err('Vain ylläpitäjälle')
    return ok({ users: db.users.map(publicUser) })
  }
  if (pathname === '/api/users' && method === 'POST') {
    if (user!.role !== 'admin') err('Vain ylläpitäjälle')
    const name = String(body.name || '').trim()
    const email = String(body.email || '').trim().toLowerCase()
    const password = String(body.password || '')
    if (!name || !email || password.length < 8) err('Nimi, sähköposti ja salasana (min. 8) vaaditaan')
    if (db.users.some((u) => u.email.toLowerCase() === email)) err('Sähköposti on jo käytössä')
    const nextRole = body.role === 'admin' ? 'admin' : 'member'
    if (nextRole === 'admin' && !isOwnerEmail(user!.email)) {
      err('Vain pääkäyttäjä (Jussi Heimonen) voi lisätä tai poistaa ylläpitäjiä')
    }
    const nu: User = {
      id: uid(),
      name,
      email,
      passwordHash: await hashPassword(password),
      role: nextRole,
      active: true,
      constraints: Array.isArray(body.constraints) ? (body.constraints as string[]) : [],
      travelGroup: normalizeTravelGroup(body.travelGroup),
      createdAt: new Date().toISOString(),
    }
    db.users.push(nu)
    saveDb(db)
    return ok({ user: publicUser(nu) })
  }
  const userPatch = pathname.match(/^\/api\/users\/([^/]+)$/)
  if (userPatch && method === 'PATCH') {
    if (user!.role !== 'admin') err('Vain ylläpitäjälle')
    const target = db.users.find((u) => u.id === userPatch[1])
    if (!target) err('Käyttäjää ei löydy')
    const nextRole = body.role === 'admin' || body.role === 'member' ? body.role : target!.role
    const nextActive = typeof body.active === 'boolean' ? body.active : target!.active
    const wasAdmin = target!.role === 'admin' && target!.active
    const staysAdmin = nextRole === 'admin' && nextActive
    const roleChangingToOrFromAdmin =
      (target!.role === 'admin' && nextRole !== 'admin') ||
      (target!.role !== 'admin' && nextRole === 'admin')
    if (roleChangingToOrFromAdmin && !isOwnerEmail(user!.email)) {
      err('Vain pääkäyttäjä (Jussi Heimonen) voi lisätä tai poistaa ylläpitäjiä')
    }
    if (isOwnerEmail(target!.email) && nextRole !== 'admin') {
      err('Pääkäyttäjän ylläpito-oikeutta ei voi poistaa')
    }
    if (isOwnerEmail(target!.email) && !isOwnerEmail(user!.email)) {
      err('Pääkäyttäjän tietoja voi muokata vain hän itse')
    }
    if (wasAdmin && !staysAdmin) {
      const admins = db.users.filter((u) => u.role === 'admin' && u.active).length
      if (admins <= 1) err('Viimeistä ylläpitäjää ei voi poistaa tai alentaa')
    }
    if (body.name !== undefined) target!.name = String(body.name).trim()
    if (body.email !== undefined) target!.email = String(body.email).trim().toLowerCase()
    if (body.role === 'admin' || body.role === 'member') target!.role = body.role
    if (typeof body.active === 'boolean') target!.active = body.active
    if (Array.isArray(body.constraints)) target!.constraints = body.constraints as string[]
    if (body.constraintNote !== undefined) target!.constraintNote = String(body.constraintNote || '') || null
    if (body.snoozeUntil !== undefined) target!.snoozeUntil = body.snoozeUntil ? String(body.snoozeUntil) : null
    if (body.travelGroup !== undefined) target!.travelGroup = normalizeTravelGroup(body.travelGroup)
    if (body.password) {
      if (String(body.password).length < 8) err('Salasanan oltava vähintään 8 merkkiä')
      target!.passwordHash = await hashPassword(String(body.password))
    }
    saveDb(db)
    return ok({ user: publicUser(target!) })
  }
  if (userPatch && method === 'DELETE') {
    if (user!.role !== 'admin') err('Vain ylläpitäjälle')
    const target = db.users.find((u) => u.id === userPatch[1])
    if (!target) err('Käyttäjää ei löydy')
    if (target!.id === user!.id) err('Et voi poistaa omaa tiliäsi')
    if (isOwnerEmail(target!.email)) err('Pääkäyttäjää ei voi poistaa')
    if (target!.role === 'admin' && target!.active && !isOwnerEmail(user!.email)) {
      err('Vain pääkäyttäjä voi poistaa ylläpitäjän')
    }
    if (target!.role === 'admin' && target!.active) {
      const admins = db.users.filter((u) => u.role === 'admin' && u.active).length
      if (admins <= 1) err('Viimeistä ylläpitäjää ei voi poistaa')
    }
    const id = target!.id
    for (const p of db.pihavuorot) {
      p.assignments = p.assignments.filter((a) => a.userId !== id)
      for (const t of p.tasks) {
        if (t.assigneeUserId === id) t.assigneeUserId = null
        if (t.doneByUserId === id) t.doneByUserId = null
      }
    }
    db.messages = (db.messages || []).filter((m) => m.authorUserId !== id)
    db.weekBlocks = db.weekBlocks.filter((b) => b.userId !== id)
    db.notifications = db.notifications.filter((n) => n.userId !== id)
    db.swaps = (db.swaps || []).filter((s) => s.fromUserId !== id)
    for (const s of db.swaps || []) {
      if (s.toUserId === id) s.toUserId = null
      if (s.acceptedByUserId === id) s.acceptedByUserId = null
    }
    db.extraTasks = (db.extraTasks || []).filter((t) => t.createdByUserId !== id)
    for (const t of db.extraTasks || []) {
      t.signups = (t.signups || []).filter((s) => s.userId !== id)
    }
    db.notices = (db.notices || []).filter((n) => n.authorUserId !== id)
    for (const n of db.notices || []) {
      n.replies = (n.replies || []).filter((r) => r.authorUserId !== id)
      if (n.acknowledgedByUserId === id) n.acknowledgedByUserId = null
    }
    for (const h of db.hub || []) {
      if (h.completedByUserId === id) {
        h.completedByUserId = null
        h.completedAt = null
      }
    }
    db.invites = (db.invites || []).filter((i) => i.createdByUserId !== id)
    db.users = db.users.filter((u) => u.id !== id)
    saveDb(db)
    return ok({ ok: true })
  }
  if (pathname === '/api/invites' && method === 'GET') {
    if (user!.role !== 'admin') err('Vain ylläpitäjälle')
    const pending = db.invites.filter((i) => !i.acceptedAt && !i.revokedAt)
    return ok({
      invites: pending.map((i) =>
        publicInvite(i, `${location.origin}/kutsu/${i.token}`),
      ),
    })
  }
  if (pathname === '/api/invites' && method === 'POST') {
    if (user!.role !== 'admin') err('Vain ylläpitäjälle')
    const name = String(body.name || '').trim()
    const email = String(body.email || '').trim().toLowerCase()
    if (!name || !email) err('Nimi ja sähköposti vaaditaan')
    const nextRole = body.role === 'admin' ? 'admin' : 'member'
    if (nextRole === 'admin' && !isOwnerEmail(user!.email)) {
      err('Vain pääkäyttäjä (Jussi Heimonen) voi kutsua ylläpitäjiä')
    }
    if (db.users.some((u) => u.email.toLowerCase() === email)) {
      err('Käyttäjä on jo olemassa tällä sähköpostilla')
    }
    const open = db.invites.find(
      (i) =>
        i.email.toLowerCase() === email &&
        !i.acceptedAt &&
        !i.revokedAt &&
        new Date(i.expiresAt) > new Date(),
    )
    if (open) err('Tälle sähköpostille on jo avoin kutsu')
    const inv: Invite = {
      id: uid(),
      token: uid().replace(/-/g, '') + uid().replace(/-/g, ''),
      name,
      email,
      role: nextRole,
      constraints: Array.isArray(body.constraints) ? (body.constraints as string[]) : [],
      travelGroup: normalizeTravelGroup(body.travelGroup),
      createdByUserId: user!.id,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    }
    db.invites.unshift(inv)
    saveDb(db)
    return ok({
      invite: publicInvite(inv, `${location.origin}/kutsu/${inv.token}`),
    })
  }
  const inviteDel = pathname.match(/^\/api\/invites\/([^/]+)$/)
  if (inviteDel && method === 'DELETE') {
    if (user!.role !== 'admin') err('Vain ylläpitäjälle')
    const inv = db.invites.find((i) => i.id === inviteDel[1])
    if (!inv) err('Kutsua ei löydy')
    inv!.revokedAt = new Date().toISOString()
    saveDb(db)
    return ok({ ok: true })
  }
  if (pathname === '/api/directory' && method === 'GET') {
    return ok({ users: db.users.filter((u) => u.active).map((u) => ({ id: u.id, name: u.name })) })
  }
  if (pathname === '/api/catalog' && method === 'GET') {
    return ok({ templates: TASK_CATALOG_V1, constraintLabels: CONSTRAINT_LABELS })
  }

  if (pathname === '/api/lead-guide' && method === 'GET') {
    return ok({ guide: normalizeLeadGuide(db.leadGuide || DEFAULT_LEAD_GUIDE) })
  }
  if (pathname === '/api/lead-guide' && method === 'PUT') {
    if (user!.role !== 'admin') err('Vain ylläpitäjälle')
    db.leadGuide = normalizeLeadGuide(body.guide ?? body)
    saveDb(db)
    return ok({ guide: db.leadGuide })
  }

  if (pathname === '/api/app-settings' && method === 'GET') {
    return ok({ settings: normalizeAppSettings(db.appSettings || DEFAULT_APP_SETTINGS) })
  }
  if (pathname === '/api/app-settings' && method === 'PUT') {
    if (user!.role !== 'admin') err('Vain ylläpitäjälle')
    db.appSettings = normalizeAppSettings(body.settings ?? body)
    saveDb(db)
    return ok({ settings: db.appSettings })
  }

  if (pathname === '/api/task-cards' && method === 'GET') {
    if (user!.role !== 'admin') err('Vain ylläpitäjälle')
    const cards = (db.taskCards || [])
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title, 'fi'))
    return ok({ cards })
  }
  if (pathname === '/api/task-cards' && method === 'POST') {
    if (user!.role !== 'admin') err('Vain ylläpitäjälle')
    const title = String(body.title || '').trim()
    const instructions = String(body.instructions || '').trim()
    if (!title) err('Anna otsikko')
    const effort = body.effort === 'heavy' ? 'heavy' : 'light'
    const season: SeasonKey = isSeasonKey(body.season) ? body.season : 'kesa'
    const cadence: TaskCadence = isCadenceKey(body.cadence) ? body.cadence : 'weekly'
    const defaultAssignee =
      body.defaultAssignee === 'lead' || body.defaultAssignee === 'all'
        ? body.defaultAssignee
        : 'helpers'
    const maxOrder = (db.taskCards || []).reduce((m, c) => Math.max(m, c.sortOrder), 0)
    const card: TaskCard = {
      id: uid(),
      title,
      instructions,
      effort,
      season,
      cadence,
      defaultAssignee,
      active: true,
      sortOrder: maxOrder + 10,
    }
    db.taskCards.push(card)
    saveDb(db)
    return ok({ card })
  }
  const taskCardMatch = pathname.match(/^\/api\/task-cards\/([^/]+)$/)
  if (taskCardMatch && method === 'PATCH') {
    if (user!.role !== 'admin') err('Vain ylläpitäjälle')
    const card = db.taskCards.find((c) => c.id === taskCardMatch[1])
    if (!card) err('Korttia ei löydy')
    if (body.title !== undefined) card!.title = String(body.title).trim() || card!.title
    if (body.instructions !== undefined) card!.instructions = String(body.instructions || '')
    if (body.effort === 'light' || body.effort === 'heavy') card!.effort = body.effort
    if (isSeasonKey(body.season)) card!.season = body.season
    if (isCadenceKey(body.cadence)) card!.cadence = body.cadence
    if (
      body.defaultAssignee === 'lead' ||
      body.defaultAssignee === 'helpers' ||
      body.defaultAssignee === 'all'
    ) {
      card!.defaultAssignee = body.defaultAssignee
    }
    if (typeof body.active === 'boolean') card!.active = body.active
    if (typeof body.sortOrder === 'number') card!.sortOrder = body.sortOrder
    saveDb(db)
    return ok({ card })
  }
  if (taskCardMatch && method === 'DELETE') {
    if (user!.role !== 'admin') err('Vain ylläpitäjälle')
    const idx = db.taskCards.findIndex((c) => c.id === taskCardMatch[1])
    if (idx < 0) err('Korttia ei löydy')
    db.taskCards.splice(idx, 1)
    saveDb(db)
    return ok({ ok: true })
  }

  if (pathname === '/api/meta/app' && method === 'GET') {
    return ok({ commit: 'local', commitFull: null, uiVersion: 'hub-checklist-light-2026-10' })
  }

  if (pathname === '/api/home' && method === 'GET') {
    const weekStart = mondayOf()
    const next = db.pihavuorot
      .filter(
        (p) =>
          p.status === 'published' &&
          p.weekStart >= weekStart &&
          p.assignments.some((a) => a.userId === user!.id),
      )
      .sort((a, b) => a.weekStart.localeCompare(b.weekStart))[0]
    const openNotices = db.notices.filter(
      (n) => n.status !== 'resolved' && noticeVisibleTo(db, n, user!),
    ).length
    const openExtras = db.extraTasks.filter((t) =>
      ['open', 'ready', 'in_progress'].includes(t.status),
    ).length
    // Poista vanhat chat-ilmoitukset (kuuluvat FAB-merkkiin)
    db.notifications = db.notifications.filter((n) => n.kind !== 'chat')
    const inbox = db.notifications.filter((n) => n.userId === user!.id && n.kind !== 'chat')
    const unread = inbox.filter((n) => !n.readAt).length
    const recent = inbox
      .slice(0, 5)
      .map((n) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        link: n.link,
        kind: n.kind,
        readAt: n.readAt ?? null,
        createdAt: n.createdAt,
      }))
    const window = upcomingMondays(10)
    const blockedCount = db.weekBlocks.filter(
      (b) => b.userId === user!.id && b.weekStart >= window[0]! && b.weekStart <= window[window.length - 1]!,
    ).length
    const openSwapOffers = db.swaps.filter((s) => {
      if (s.status !== 'open') return false
      const p = db.pihavuorot.find((x) => x.id === s.pihavuoroId)
      if (!p || p.status !== 'published') return false
      if (s.fromUserId === user!.id) return false
      if (s.toUserId && s.toUserId !== user!.id) return false
      if (p.assignments.some((a) => a.userId === user!.id)) return false
      return true
    }).length
    const myOpenSwaps = db.swaps.filter((s) => s.fromUserId === user!.id && s.status === 'open').length
    const hubOpen = db.hub.filter((h) => h.status !== 'done')
    const hubDue = hubOpen.filter((h) => h.windowStart <= today() && h.windowEnd >= today())
    return ok({
      nextPihavuoro: next ? hydratePihavuoro(db, next) : null,
      openNotices,
      openExtraTasks: openExtras,
      canCreateExtraTask: user!.role === 'admin',
      constraintLabels: CONSTRAINT_LABELS,
      weather: await getWeather(
        normalizeAppSettings(db.appSettings || DEFAULT_APP_SETTINGS).weatherPlace,
      ),
      unreadNotifications: unread,
      recentNotifications: recent,
      hub: {
        year: new Date().getFullYear(),
        openCount: hubOpen.length,
        dueCount: hubDue.length,
        issueCount: hubOpen.reduce(
          (n, h) => n + h.items.filter((i) => i.status === 'issue').length,
          0,
        ),
      },
      availability: { weeksAhead: 10, blockedCount },
      swaps: { availableCount: openSwapOffers, myOpenCount: myOpenSwaps },
      chat: next
        ? {
            pihavuoroId: next.id,
            messageCount: db.messages.filter((m) => m.pihavuoroId === next.id).length,
          }
        : null,
    })
  }

  if (pathname === '/api/weather' && method === 'GET') {
    return ok(
      await getWeather(normalizeAppSettings(db.appSettings || DEFAULT_APP_SETTINGS).weatherPlace),
    )
  }

  if (pathname === '/api/chat/current' && method === 'GET') {
    const t = today()
    const current = db.pihavuorot
      .filter(
        (p) =>
          p.status === 'published' &&
          addDays(p.weekStart, 6) >= t &&
          p.assignments.some((a) => a.userId === user!.id),
      )
      .sort((a, b) => a.weekStart.localeCompare(b.weekStart))[0]
    if (!current) return ok({ chat: null })
    const msgs = db.messages.filter((m) => m.pihavuoroId === current.id)
    const last = msgs.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
    const myRole = current.assignments.find((a) => a.userId === user!.id)?.role || null
    return ok({
      chat: {
        pihavuoroId: current.id,
        weekStart: current.weekStart,
        weekEnd: addDays(current.weekStart, 6),
        messageCount: msgs.length,
        lastMessageAt: last?.createdAt ?? null,
        myRole,
      },
    })
  }

  if (pathname === '/api/pihavuorot' && method === 'GET') {
    const list = db.pihavuorot
      .filter((p) => user!.role === 'admin' || p.status !== 'draft')
      .sort((a, b) => b.weekStart.localeCompare(a.weekStart))
      .map((p) => hydratePihavuoro(db, p))
    return ok({ pihavuorot: list })
  }

  if (pathname === '/api/pihavuorot' && method === 'POST') {
    if (user!.role !== 'admin') err('Vain ylläpitäjälle')
    let weekStart = mondayOf(body.weekStart ? String(body.weekStart) : undefined)
    if (!body.weekStart) {
      for (let i = 0; i < 52; i++) {
        const candidate = addDays(weekStart, i * 7)
        if (!db.pihavuorot.some((p) => p.weekStart === candidate)) {
          weekStart = candidate
          break
        }
      }
    }
    if (db.pihavuorot.some((p) => p.weekStart === weekStart)) err('Viikolle on jo Pihavuoro')
    const helperCount = resolveHelperCount({
      totalPeople: body.totalPeople,
      helperCount: body.helperCount,
    })
    const blocked = new Set(db.weekBlocks.filter((b) => b.weekStart === weekStart).map((b) => b.userId))
    const ranked = db.users
      .filter((u) => u.active && (!u.snoozeUntil || u.snoozeUntil <= today()))
      .filter((u) => !blocked.has(u.id))
      .map((u) => {
        const last = db.pihavuorot
          .filter((p) => p.assignments.some((a) => a.userId === u.id))
          .map((p) => p.weekStart)
          .sort()
          .at(-1) as string | undefined
        return { ...publicUser(u), last }
      })
      .sort((a, b) => {
        if (!a.last && !b.last) return a.name.localeCompare(b.name, 'fi')
        if (!a.last) return -1
        if (!b.last) return 1
        return a.last.localeCompare(b.last) || a.name.localeCompare(b.name, 'fi')
      })
    const { lead, helpers } = pickLeadAndHelpers(ranked, helperCount)
    if (!lead) err('Vastuuhenkilöä ei löytynyt')
    if (helpers.length < 1) {
      err(
        `Vain ${helpers.length} saatavilla olevaa jäsentä tälle viikolle (tarvitaan 1–5 avustajaa). Tarkista esteviikot.`,
      )
    }
    const assignments: Assignment[] = [
      { id: uid(), userId: lead!.id, role: 'lead' },
      ...helpers.map((h) => ({ id: uid(), userId: h.id, role: 'helper' as const })),
    ]
    const season = seasonFor(weekStart)
    const p: Pihavuoro = {
      id: uid(),
      weekStart,
      status: 'draft',
      season,
      createdAt: new Date().toISOString(),
      assignments,
      tasks: createTasks(
        season,
        assignments,
        db,
        Array.isArray(body.templateIds)
          ? (body.templateIds as unknown[]).map(String)
          : defaultTemplateIdsForSeason(season, db),
      ),
    }
    db.pihavuorot.push(p)
    saveDb(db)
    return ok({ pihavuoro: hydratePihavuoro(db, p) })
  }

  const pihaMatch = pathname.match(/^\/api\/pihavuorot\/([^/]+)(.*)$/)
  if (pihaMatch) {
    const id = pihaMatch[1]!
    const rest = pihaMatch[2] || ''

    if (id === 'meta' && rest.startsWith('/recommend') && method === 'GET') {
      if (user!.role !== 'admin') err('Vain ylläpitäjälle')
      const weekStart = mondayOf(params.get('weekStart') || undefined)
      const helperCount = resolveHelperCount({
        totalPeople: params.get('totalPeople'),
        helperCount: params.get('helperCount'),
      })
      const ignoreCurrent = params.get('fresh') === '1'
      const blocked = new Set(
        db.weekBlocks.filter((b) => b.weekStart === weekStart).map((b) => b.userId),
      )
      const already = new Set(
        ignoreCurrent
          ? []
          : (db.pihavuorot.find((x) => x.weekStart === weekStart)?.assignments.map((a) => a.userId) ??
              []),
      )
      const ranked = db.users
        .filter((u) => u.active && (!u.snoozeUntil || u.snoozeUntil <= today()))
        .filter((u) => !blocked.has(u.id) && !already.has(u.id))
        .map((u) => {
          const last = db.pihavuorot
            .filter((p) => p.assignments.some((a) => a.userId === u.id))
            .map((p) => p.weekStart)
            .sort()
            .at(-1) as string | undefined
          return { ...publicUser(u), last }
        })
        .sort((a, b) => {
          if (!a.last && !b.last) return a.name.localeCompare(b.name, 'fi')
          if (!a.last) return -1
          if (!b.last) return 1
          return a.last.localeCompare(b.last) || a.name.localeCompare(b.name, 'fi')
        })
      const { lead, helpers } = pickLeadAndHelpers(ranked, helperCount)
      return ok({
        weekStart,
        lead,
        helpers,
        ranked,
        helperCount,
        totalPeople: helperCount + 1,
        blockedCount: blocked.size,
        availableCount: ranked.length,
        season: seasonFor(weekStart),
      })
    }

    const p = db.pihavuorot.find((x) => x.id === id)
    if (!p) err('Ei löydy')

    if (rest === '' && method === 'GET' && p) {
      if (p.status === 'draft' && user!.role !== 'admin') err('Luonnos vain ylläpitäjälle')
      return ok({ pihavuoro: hydratePihavuoro(db, p) })
    }
    if (rest === '' && method === 'PATCH' && p) {
      if (user!.role !== 'admin') err('Vain ylläpitäjälle')
      if (body.status === 'draft' || body.status === 'published' || body.status === 'done') {
        p.status = body.status
      }
      if (isSeasonKey(body.season)) p.season = body.season
      if (body.notes !== undefined) p.notes = String(body.notes || '') || null
      if (body.leadUserId || body.helperUserIds) {
        const leadId = String(body.leadUserId || '')
        const helperIds = Array.isArray(body.helperUserIds)
          ? (body.helperUserIds as string[]).map(String)
          : []
        if (!leadId || helperIds.length < 1 || helperIds.length > 5) {
          err('Kokoonpano: 1 vastuu + 1–5 avustajaa')
        }
        if (helperIds.includes(leadId)) err('Vastuuhenkilö ei voi olla samalla avustaja')
        const assignments: Assignment[] = [
          { id: uid(), userId: leadId, role: 'lead' },
          ...helperIds.map((hid) => ({ id: uid(), userId: hid, role: 'helper' as const })),
        ]
        const existingIds = p.tasks.map((t) => t.templateId).filter(Boolean) as string[]
        const templateIds = Array.isArray(body.templateIds)
          ? (body.templateIds as unknown[]).map(String)
          : existingIds.length
            ? existingIds
            : defaultTemplateIdsForSeason(p.season, db)
        p.assignments = assignments
        p.tasks = createTasks(p.season, assignments, db, templateIds)
      }
      saveDb(db)
      return ok({ pihavuoro: hydratePihavuoro(db, p) })
    }
    if (rest === '/tasks' && method === 'PUT' && p) {
      if (user!.role !== 'admin') err('Vain ylläpitäjälle')
      if (!Array.isArray(body.templateIds)) err('templateIds vaaditaan')
      const templateIds = (body.templateIds as unknown[]).map(String)
      const templates = resolveTemplatesForSeason(p.season, db, templateIds)
      if (!templates.length) err('Valitse ainakin yksi huoltotehtävä')
      const keep = new Map(p.tasks.filter((t) => t.templateId).map((t) => [t.templateId!, t]))
      const next: ShiftTask[] = []
      for (const t of templates) {
        const prev = keep.get(t.id)
        if (prev) {
          next.push({
            ...prev,
            title: t.title,
            instructions: t.instructions,
            effort: t.effort,
            sortOrder: t.sortOrder,
            assigneeUserId: null,
          })
          continue
        }
        next.push({
          id: uid(),
          templateId: t.id,
          title: t.title,
          instructions: t.instructions,
          effort: t.effort,
          assigneeUserId: null,
          status: 'open',
          sortOrder: t.sortOrder,
        })
      }
      p.tasks = next
      saveDb(db)
      return ok({ pihavuoro: hydratePihavuoro(db, p) })
    }
    if (rest === '/publish' && method === 'POST' && p) {
      if (user!.role !== 'admin') err('Vain ylläpitäjälle')
      p.status = 'published'
      notify(
        db,
        p.assignments.map((a) => a.userId),
        'Pihavuoro julkaistu',
        `${formatWeekRangeFi(p.weekStart, addDays(p.weekStart, 6))}: vuorosi on valmis katsottavaksi.`,
        `/pihavuoro/${p.id}`,
        'shift',
      )
      saveDb(db)
      return ok({ pihavuoro: hydratePihavuoro(db, p) })
    }
    if (rest === '' && method === 'DELETE' && p) {
      if (user!.role !== 'admin') err('Vain ylläpitäjälle')
      const weekStart = p.weekStart
      db.pihavuorot = db.pihavuorot.filter((x) => x.id !== p.id)
      db.swaps = db.swaps.filter((s) => s.pihavuoroId !== p.id)
      db.messages = db.messages.filter((m) => m.pihavuoroId !== p.id)
      saveDb(db)
      return ok({ ok: true, message: 'Pihavuoro poistettu', weekStart })
    }
    if (rest === '/messages' && method === 'GET' && p) {
      if (!p.assignments.some((a) => a.userId === user!.id)) {
        err('Viestit näkyvät vain tämän viikon vuorossa oleville')
      }
      const messages = db.messages
        .filter((m) => m.pihavuoroId === p.id)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .map((m) => ({
          id: m.id,
          pihavuoroId: m.pihavuoroId,
          authorUserId: m.authorUserId,
          authorName: db.users.find((u) => u.id === m.authorUserId)?.name || '—',
          body: m.body,
          createdAt: m.createdAt,
        }))
      return ok({ messages })
    }
    if (rest === '/messages' && method === 'POST' && p) {
      if (!p.assignments.some((a) => a.userId === user!.id)) {
        err('Vain vuorossa olevat voivat lähettää viestejä')
      }
      if (p.status === 'draft') err('Keskustelu aukeaa kun vuoro on julkaistu')
      const text = String(body.body || '').trim()
      if (!text) err('Kirjoita viesti')
      const msg: ShiftMessage = {
        id: uid(),
        pihavuoroId: p.id,
        authorUserId: user!.id,
        body: text,
        createdAt: new Date().toISOString(),
      }
      db.messages.push(msg)
      // Chat: ei Ilmo-listaan — lukemattomat näkyvät chat-kuvakkeessa
      saveDb(db)
      return ok({
        message: {
          id: msg.id,
          pihavuoroId: msg.pihavuoroId,
          authorUserId: msg.authorUserId,
          authorName: user!.name,
          body: msg.body,
          createdAt: msg.createdAt,
        },
      })
    }
    if (rest === '/swaps' && method === 'GET' && p) {
      const swaps = db.swaps
        .filter((s) => s.pihavuoroId === p.id && s.status === 'open')
        .map((s) => hydrateSwap(db, s))
      return ok({ swaps })
    }
    if (rest === '/swaps' && method === 'POST' && p) {
      if (p.status !== 'published') err('Vaihto vain julkaistulle vuorolle')
      const assignment = p.assignments.find((a) => a.userId === user!.id)
      if (!assignment) err('Et ole tässä vuorossa')
      if (db.swaps.some((s) => s.pihavuoroId === p.id && s.fromUserId === user!.id && s.status === 'open')) {
        err('Sinulla on jo avoin vaihtotarjous tälle viikolle')
      }
      const toUserId = body.toUserId ? String(body.toUserId) : null
      const swap: SwapOffer = {
        id: uid(),
        pihavuoroId: p.id,
        fromUserId: user!.id,
        toUserId,
        role: assignment!.role,
        message: String(body.message || '').trim() || null,
        status: 'open',
        createdAt: new Date().toISOString(),
      }
      db.swaps.push(swap)
      const recipients = toUserId
        ? [toUserId]
        : db.users
            .filter((u) => u.active && u.id !== user!.id && !p.assignments.some((a) => a.userId === u.id))
            .map((u) => u.id)
      notify(
        db,
        recipients,
        toUserId ? 'Sinulle tarjottiin vuoronvaihtoa' : 'Avoin vuoronvaihto',
        `${user!.name} etsii sijaisia viikolle ${formatWeekRangeFi(p.weekStart, addDays(p.weekStart, 6))}.`,
        '/vaihdot',
        'swap',
      )
      saveDb(db)
      return ok({ swap: hydrateSwap(db, swap) })
    }
  }

  if (pathname === '/api/swaps' && method === 'GET') {
    const mine = db.swaps
      .filter((s) => s.fromUserId === user!.id && s.status === 'open')
      .map((s) => hydrateSwap(db, s))
    const available = db.swaps
      .filter((s) => {
        if (s.status !== 'open' || s.fromUserId === user!.id) return false
        const p = db.pihavuorot.find((x) => x.id === s.pihavuoroId)
        if (!p || p.status !== 'published') return false
        if (s.toUserId && s.toUserId !== user!.id) return false
        if (p.assignments.some((a) => a.userId === user!.id)) return false
        return true
      })
      .map((s) => hydrateSwap(db, s))
    return ok({ mine, available })
  }

  const swapAccept = pathname.match(/^\/api\/swaps\/([^/]+)\/accept$/)
  if (swapAccept && method === 'POST') {
    const swap = db.swaps.find((s) => s.id === swapAccept[1])
    if (!swap || swap.status !== 'open') err('Tarjous ei ole enää auki')
    if (swap!.fromUserId === user!.id) err('Et voi hyväksyä omaa tarjoustasi')
    if (swap!.toUserId && swap!.toUserId !== user!.id) err('Tarjous on suunnattu toiselle')
    const p = db.pihavuorot.find((x) => x.id === swap!.pihavuoroId)
    if (!p || p.status !== 'published') err('Vuoro ei ole enää vaihdettavissa')
    if (p!.assignments.some((a) => a.userId === user!.id)) err('Olet jo tässä vuorossa')
    const assignment = p!.assignments.find((a) => a.userId === swap!.fromUserId && a.role === swap!.role)
    if (!assignment) err('Alkuperäistä vuoropaikkaa ei löydy')
    assignment!.userId = user!.id
    for (const t of p!.tasks) {
      if (t.assigneeUserId === swap!.fromUserId && t.status === 'open') {
        const me = db.users.find((u) => u.id === user!.id)
        if (t.effort === 'heavy' && me?.constraints.includes('no_heavy')) t.assigneeUserId = null
        else t.assigneeUserId = user!.id
      }
    }
    swap!.status = 'accepted'
    swap!.resolvedAt = new Date().toISOString()
    swap!.acceptedByUserId = user!.id
    notify(db, [swap!.fromUserId], 'Vuoronvaihto hyväksytty', `${user!.name} otti paikkasi.`, `/pihavuoro/${p!.id}`, 'swap')
    saveDb(db)
    return ok({ swap: hydrateSwap(db, swap!), pihavuoro: hydratePihavuoro(db, p!) })
  }

  const swapCancel = pathname.match(/^\/api\/swaps\/([^/]+)\/cancel$/)
  if (swapCancel && method === 'POST') {
    const swap = db.swaps.find((s) => s.id === swapCancel[1])
    if (!swap || swap.status !== 'open') err('Tarjous ei ole enää auki')
    if (swap!.fromUserId !== user!.id && user!.role !== 'admin') err('Ei oikeutta')
    swap!.status = 'cancelled'
    swap!.resolvedAt = new Date().toISOString()
    saveDb(db)
    return ok({ swap: hydrateSwap(db, swap!) })
  }

  if (pathname === '/api/availability' && method === 'GET') {
    const weeks = upcomingMondays(Number(params.get('weeks') || 10))
    const targetId =
      user!.role === 'admin' && params.get('userId') ? String(params.get('userId')) : user!.id
    const blocked = new Set(
      db.weekBlocks.filter((b) => b.userId === targetId).map((b) => b.weekStart),
    )
    return ok({
      userId: targetId,
      weeks: weeks.map((weekStart) => {
        const p = db.pihavuorot.find((x) => x.weekStart === weekStart)
        const myRole = p?.assignments.find((a) => a.userId === targetId)?.role || null
        return {
          weekStart,
          weekEnd: addDays(weekStart, 6),
          blocked: blocked.has(weekStart),
          published: p?.status === 'published' || p?.status === 'done',
          myRole,
        }
      }),
    })
  }
  if (pathname === '/api/availability' && method === 'PUT') {
    const weeks = upcomingMondays(Number(body.weeks || 10))
    const windowSet = new Set(weeks)
    const blockedWeeks = Array.isArray(body.blockedWeeks)
      ? (body.blockedWeeks as string[]).filter((w) => windowSet.has(w))
      : []
    db.weekBlocks = db.weekBlocks.filter(
      (b) =>
        !(b.userId === user!.id && b.weekStart >= weeks[0]! && b.weekStart <= weeks[weeks.length - 1]!),
    )
    for (const weekStart of blockedWeeks) {
      const p = db.pihavuorot.find((x) => x.weekStart === weekStart)
      if (p?.status === 'published' && p.assignments.some((a) => a.userId === user!.id)) continue
      db.weekBlocks.push({
        id: uid(),
        userId: user!.id,
        weekStart,
        createdAt: new Date().toISOString(),
      })
    }
    saveDb(db)
    return ok({
      ok: true,
      blockedWeeks: db.weekBlocks
        .filter((b) => b.userId === user!.id && windowSet.has(b.weekStart))
        .map((b) => b.weekStart),
    })
  }
  if (pathname === '/api/availability/summary' && method === 'GET') {
    if (user!.role !== 'admin') err('Vain ylläpitäjälle')
    const weeks = upcomingMondays(Number(params.get('weeks') || 10))
    return ok({
      userCount: db.users.filter((u) => u.active).length,
      weeks: weeks.map((weekStart) => {
        const blockedUsers = db.weekBlocks
          .filter((b) => b.weekStart === weekStart)
          .map((b) => {
            const u = db.users.find((x) => x.id === b.userId)
            return { id: b.userId, name: u?.name || '—' }
          })
        const availableCount = db.users.filter((u) => u.active).length - blockedUsers.length
        return {
          weekStart,
          weekEnd: addDays(weekStart, 6),
          blockedUsers,
          availableCount,
          tight: availableCount < 5,
        }
      }),
    })
  }

  if (pathname === '/api/notices' && method === 'GET') {
    return ok({
      notices: db.notices
        .filter((n) => noticeVisibleTo(db, n, user!))
        .slice()
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((n) => hydrateNotice(db, n)),
    })
  }
  if (pathname === '/api/notices' && method === 'POST') {
    let text = String(body.body || '').trim()
    let photoDataUrl: string | null = null
    let audience: 'all' | 'leads' = 'all'
    if (options.formData) {
      text = String(options.formData.get('body') || '').trim()
      const aud = String(options.formData.get('audience') || 'all')
      audience = aud === 'leads' ? 'leads' : 'all'
      const file = options.formData.get('photo')
      if (file instanceof File) {
        photoDataUrl = await fileToDataUrl(file)
      }
    } else if (body.audience === 'leads') {
      audience = 'leads'
    }
    if (!text) err('Kirjoita viesti')
    const notice: Notice = {
      id: uid(),
      authorUserId: user!.id,
      body: text,
      photoDataUrl,
      status: 'open',
      audience,
      acknowledgedAt: null,
      acknowledgedByUserId: null,
      createdAt: new Date().toISOString(),
      replies: [],
    }
    db.notices.unshift(notice)
    const recipients =
      audience === 'all'
        ? db.users.filter((u) => u.active && u.id !== user!.id).map((u) => u.id)
        : [
            ...db.users.filter((u) => u.active && u.role === 'admin').map((u) => u.id),
            ...currentPublishedWeekLeads(db),
          ].filter((id) => id !== user!.id)
    notify(db, recipients, 'Uusi huomio', text.slice(0, 120), '/huomiot', 'notice')
    saveDb(db)
    return ok({ ok: true, notice: hydrateNotice(db, notice) })
  }
  const noticeAck = pathname.match(/^\/api\/notices\/([^/]+)\/ack$/)
  if (noticeAck && method === 'POST') {
    if (user!.role !== 'admin') err('Vain ylläpitäjälle')
    const notice = db.notices.find((n) => n.id === noticeAck[1])
    if (!notice) err('Huomiota ei löydy')
    notice!.acknowledgedAt = new Date().toISOString()
    notice!.acknowledgedByUserId = user!.id
    if (notice!.status === 'open') notice!.status = 'in_progress'
    notify(
      db,
      [notice!.authorUserId],
      'Huomio kuitattu',
      `${user!.name} kuitasi huomiosi.`,
      '/huomiot',
      'notice',
    )
    saveDb(db)
    return ok({ notice: hydrateNotice(db, notice!) })
  }
  const noticeReply = pathname.match(/^\/api\/notices\/([^/]+)\/replies$/)
  if (noticeReply && method === 'POST') {
    if (user!.role !== 'admin') err('Vain ylläpitäjälle')
    const notice = db.notices.find((n) => n.id === noticeReply[1])
    if (!notice) err('Huomiota ei löydy')
    const text = String(body.body || '').trim()
    if (!text) err('Kirjoita vastaus')
    notice!.replies.push({
      id: uid(),
      authorUserId: user!.id,
      body: text,
      createdAt: new Date().toISOString(),
    })
    if (notice!.status === 'open') notice!.status = 'in_progress'
    notify(db, [notice!.authorUserId], 'Vastaus huomioon', text.slice(0, 120), '/huomiot', 'notice')
    saveDb(db)
    return ok({ ok: true })
  }
  const noticePatch = pathname.match(/^\/api\/notices\/([^/]+)$/)
  if (noticePatch && method === 'PATCH') {
    if (user!.role !== 'admin') err('Vain ylläpitäjälle')
    const notice = db.notices.find((n) => n.id === noticePatch[1])
    if (!notice) err('Huomiota ei löydy')
    if (body.status === 'resolved' || body.status === 'open' || body.status === 'in_progress') {
      notice!.status = body.status
      if (body.status === 'resolved') notice!.resolvedAt = new Date().toISOString()
    }
    saveDb(db)
    return ok({ ok: true })
  }
  if (noticePatch && method === 'DELETE') {
    if (user!.role !== 'admin') err('Vain ylläpitäjälle')
    const idx = db.notices.findIndex((n) => n.id === noticePatch[1])
    if (idx < 0) err('Huomiota ei löydy')
    db.notices.splice(idx, 1)
    saveDb(db)
    return ok({ ok: true })
  }

  if (pathname === '/api/notifications' && method === 'GET') {
    db.notifications = db.notifications.filter((n) => n.kind !== 'chat')
    const items = db.notifications
      .filter((n) => n.userId === user!.id && n.kind !== 'chat')
      .slice(0, 50)
      .map((n) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        link: n.link ?? null,
        kind: n.kind || 'general',
        readAt: n.readAt ?? null,
        createdAt: n.createdAt,
      }))
    saveDb(db)
    return ok({
      items,
      unreadCount: items.filter((n) => !n.readAt).length,
    })
  }
  if (pathname === '/api/notifications/read-all' && method === 'POST') {
    const now = new Date().toISOString()
    for (const n of db.notifications) {
      if (n.userId === user!.id && !n.readAt) n.readAt = now
    }
    saveDb(db)
    return ok({ ok: true })
  }
  if (pathname === '/api/notifications' && method === 'DELETE') {
    if (user!.role !== 'admin') err('Vain ylläpitäjälle')
    db.notifications = []
    saveDb(db)
    return ok({ ok: true })
  }
  const notifRead = pathname.match(/^\/api\/notifications\/([^/]+)\/read$/)
  if (notifRead && method === 'POST') {
    const n = db.notifications.find((x) => x.id === notifRead[1] && x.userId === user!.id)
    if (n && !n.readAt) n.readAt = new Date().toISOString()
    saveDb(db)
    return ok({ ok: true })
  }

  function localIsCurrentWeekLead(userId: string) {
    const weekStart = mondayOf()
    return db.pihavuorot.some(
      (p) =>
        p.status === 'published' &&
        p.weekStart === weekStart &&
        p.assignments.some((a) => a.userId === userId && a.role === 'lead'),
    )
  }
  function localIsOnCurrentWeekShift(userId: string) {
    const weekStart = mondayOf()
    return db.pihavuorot.some(
      (p) =>
        p.status === 'published' &&
        p.weekStart === weekStart &&
        p.assignments.some((a) => a.userId === userId),
    )
  }
  function localCanEditHub(insp: HubInspection) {
    if (user!.role === 'admin') return true
    return Boolean(insp.activatedAt) && localIsCurrentWeekLead(user!.id)
  }
  function localCanViewHub(insp: HubInspection) {
    if (user!.role === 'admin') return true
    return Boolean(insp.activatedAt) && localIsOnCurrentWeekShift(user!.id)
  }

  if (pathname === '/api/hub' && method === 'GET') {
    if (user!.role !== 'admin' && !localIsOnCurrentWeekShift(user!.id)) {
      err('Huoltokortit ovat ylläpitäjän hallinnassa')
    }
    const activeOnly = String(params.get('activeOnly') || '') === '1'
    const all = db.hub.map((h) => hydrateHub(h, db))
    const inspections =
      user!.role === 'admin' && !activeOnly
        ? all
        : all.filter((h) => h.activated && h.status !== 'done')
    return ok({
      year: new Date().getFullYear(),
      inspections,
      canManage: user!.role === 'admin',
      summary: {
        year: new Date().getFullYear(),
        openCount: db.hub.filter((h) => h.status !== 'done').length,
        dueCount: db.hub.filter(
          (h) => h.status !== 'done' && h.windowStart <= today() && h.windowEnd >= today(),
        ).length,
        issueCount: db.hub.reduce(
          (n, h) => n + h.items.filter((i) => i.status === 'issue').length,
          0,
        ),
        activatedCount: db.hub.filter((h) => h.activatedAt && h.status !== 'done').length,
      },
    })
  }
  if (pathname === '/api/hub/active' && method === 'GET') {
    if (user!.role !== 'admin' && !localIsOnCurrentWeekShift(user!.id)) {
      return ok({ inspections: [], canEdit: false })
    }
    return ok({
      inspections: db.hub
        .filter((h) => h.activatedAt && h.status !== 'done')
        .map((h) => hydrateHub(h, db)),
      canEdit: user!.role === 'admin' || localIsCurrentWeekLead(user!.id),
    })
  }
  if (pathname === '/api/hub/seed' && method === 'POST') {
    if (user!.role !== 'admin') err('Vain ylläpitäjälle')
    const year = new Date().getFullYear()
    if (!db.hub.some((h) => h.year === year && h.templateId === 'hub-spring')) {
      const now = new Date().toISOString()
      db.hub.push({
        id: uid(),
        templateId: 'hub-spring',
        year,
        title: 'Kevättarkastus',
        cadenceLabel: 'Kevät',
        windowStart: `${year}-04-01`,
        windowEnd: `${year}-05-31`,
        intro: 'Tarkista piha-alueen kevätkunto.',
        status: 'open',
        createdAt: now,
        activatedAt: null,
        items: [
          { id: uid(), templateItemId: '1', label: 'Sadevesijärjestelmä', sortOrder: 1, status: 'open' },
          { id: uid(), templateItemId: '2', label: 'Pihavarusteet', sortOrder: 2, status: 'open' },
          { id: uid(), templateItemId: '3', label: 'Kulku-urat ja portaat', sortOrder: 3, status: 'open' },
          { id: uid(), templateItemId: '4', label: 'Roska-alue', sortOrder: 4, status: 'open' },
          { id: uid(), templateItemId: '5', label: 'Valaisimet', sortOrder: 5, status: 'open' },
        ],
      })
      saveDb(db)
    }
    return ok({
      year,
      inspections: db.hub.map((h) => hydrateHub(h, db)),
    })
  }
  const hubActivate = pathname.match(/^\/api\/hub\/([^/]+)\/(activate|deactivate)$/)
  if (hubActivate && method === 'POST') {
    if (user!.role !== 'admin') err('Vain ylläpitäjälle')
    const insp = db.hub.find((h) => h.id === hubActivate[1])
    if (!insp) err('Ei löydy')
    if (hubActivate[2] === 'activate') {
      insp!.activatedAt = new Date().toISOString()
      insp!.activatedByUserId = user!.id
    } else {
      insp!.activatedAt = null
      insp!.activatedByUserId = null
    }
    saveDb(db)
    return ok({ inspection: hydrateHub(insp!, db) })
  }
  const hubItem = pathname.match(/^\/api\/hub\/([^/]+)\/items\/([^/]+)$/)
  if (hubItem && method === 'PATCH') {
    const insp = db.hub.find((h) => h.id === hubItem[1])
    if (!insp) err('Ei löydy')
    if (!localCanEditHub(insp!)) err('Vain ylläpitäjä tai viikon vastuuveli (aktivoitu kortti)')
    const item = insp!.items.find((i) => i.id === hubItem[2])
    if (!item) err('Kohtaa ei löydy')
    if (body.status === 'ok' || body.status === 'issue' || body.status === 'open') {
      item!.status = body.status
    }
    if (body.note !== undefined) item!.note = String(body.note || '') || null
    if (insp!.status === 'open') insp!.status = 'in_progress'
    saveDb(db)
    return ok({ inspection: hydrateHub(insp!, db) })
  }
  const hubPhoto = pathname.match(/^\/api\/hub\/([^/]+)\/photo$/)
  if (hubPhoto && method === 'POST') {
    const insp = db.hub.find((h) => h.id === hubPhoto[1])
    if (!insp) err('Ei löydy')
    if (!localCanEditHub(insp!)) err('Vain ylläpitäjä tai viikon vastuuveli (aktivoitu kortti)')
    const file = options.formData?.get('photo')
    if (!(file instanceof File)) err('Kuva puuttuu')
    insp!.photoDataUrl = await fileToDataUrl(file as File)
    saveDb(db)
    return ok({ inspection: hydrateHub(insp!, db) })
  }
  const hubMatch = pathname.match(/^\/api\/hub\/([^/]+)$/)
  if (hubMatch && method === 'GET') {
    const insp = db.hub.find((h) => h.id === hubMatch[1])
    if (!insp) err('Ei löydy')
    if (!localCanViewHub(insp!)) err('Kortti ei ole aktivoitu viikkovuorolle')
    return ok({
      inspection: hydrateHub(insp!, db),
      canEdit: localCanEditHub(insp!),
      canManage: user!.role === 'admin',
    })
  }
  if (hubMatch && method === 'PATCH') {
    const insp = db.hub.find((h) => h.id === hubMatch[1])
    if (!insp) err('Ei löydy')
    if (!localCanEditHub(insp!)) err('Vain ylläpitäjä tai viikon vastuuveli (aktivoitu kortti)')
    if (body.notes !== undefined) insp!.notes = String(body.notes || '') || null
    if (body.status === 'done' || body.status === 'open' || body.status === 'in_progress') {
      insp!.status = body.status
      if (body.status === 'done') {
        insp!.completedByUserId = user!.id
        insp!.completedAt = new Date().toISOString()
      }
    }
    saveDb(db)
    return ok({ inspection: hydrateHub(insp!, db) })
  }

  if (pathname === '/api/extra-tasks' && method === 'GET') {
    return ok({
      tasks: db.extraTasks.map((t) => hydrateExtra(db, t, user!.id)),
      canCreate: user!.role === 'admin',
    })
  }
  if (pathname === '/api/extra-tasks' && method === 'POST') {
    if (user!.role !== 'admin') err('Vain ylläpitäjälle')
    const title = String(body.title || '').trim()
    if (!title) err('Anna otsikko')
    const task = {
      id: uid(),
      createdByUserId: user!.id,
      title,
      description: String(body.description || '').trim() || null,
      minRequired: Math.max(1, Number(body.minRequired) || 2),
      status: 'open',
      createdAt: new Date().toISOString(),
      signups: [] as { id: string; userId: string; signedUpAt: string }[],
    }
    db.extraTasks.unshift(task)
    notify(
      db,
      db.users.filter((u) => u.active && u.id !== user!.id).map((u) => u.id),
      'Uusi apukutsu',
      title,
      '/apukutsut',
      'extra',
    )
    saveDb(db)
    return ok({ task: hydrateExtra(db, task, user!.id) })
  }
  if (pathname === '/api/extra-tasks' && method === 'DELETE') {
    if (user!.role !== 'admin') err('Vain ylläpitäjälle')
    db.extraTasks = []
    saveDb(db)
    return ok({ ok: true })
  }
  const extraAct = pathname.match(/^\/api\/extra-tasks\/([^/]+)\/(signup|start|complete|cancel)$/)
  if (extraAct) {
    const task = db.extraTasks.find((t) => t.id === extraAct[1])
    if (!task) err('Tehtävää ei löydy')
    const action = extraAct[2]!
    if (action === 'signup' && method === 'POST') {
      if (task!.signups.some((s) => s.userId === user!.id)) err('Olet jo ilmoittautunut')
      task!.signups.push({ id: uid(), userId: user!.id, signedUpAt: new Date().toISOString() })
      if (task!.signups.length >= task!.minRequired && task!.status === 'open') task!.status = 'ready'
      saveDb(db)
      return ok({ task: hydrateExtra(db, task!, user!.id) })
    }
    if (action === 'signup' && method === 'DELETE') {
      task!.signups = task!.signups.filter((s) => s.userId !== user!.id)
      if (task!.status === 'ready' && task!.signups.length < task!.minRequired) task!.status = 'open'
      saveDb(db)
      return ok({ task: hydrateExtra(db, task!, user!.id) })
    }
    if (action === 'start' && method === 'POST') {
      if (user!.role !== 'admin' && !task!.signups.some((s) => s.userId === user!.id)) {
        err('Ei oikeutta')
      }
      task!.status = 'in_progress'
      saveDb(db)
      return ok({ task: hydrateExtra(db, task!, user!.id) })
    }
    if (action === 'complete' && method === 'POST') {
      if (user!.role !== 'admin' && !task!.signups.some((s) => s.userId === user!.id)) {
        err('Ei oikeutta')
      }
      task!.status = 'done'
      saveDb(db)
      return ok({ task: hydrateExtra(db, task!, user!.id) })
    }
    if (action === 'cancel' && method === 'POST') {
      if (user!.role !== 'admin') err('Vain ylläpitäjälle')
      task!.status = 'cancelled'
      saveDb(db)
      return ok({ task: hydrateExtra(db, task!, user!.id) })
    }
  }

  // task complete / assign
  const taskComplete = pathname.match(/^\/api\/tasks\/([^/]+)\/complete$/)
  if (taskComplete && method === 'POST') {
    const taskId = taskComplete[1]!
    const p = db.pihavuorot.find((x) => x.tasks.some((t) => t.id === taskId))
    if (!p) err('Tehtävää ei löydy')
    const task = p!.tasks.find((t) => t.id === taskId)!
    const assignment = p!.assignments.find((a) => a.userId === user!.id)
    if (!assignment && user!.role !== 'admin') err('Et ole tässä Pihavuorossa')
    task.status = body.status === 'skipped' ? 'skipped' : 'done'
    task.skipReason = task.status === 'skipped' ? String(body.skipReason || 'Ei tarvetta') : null
    task.doneByUserId = user!.id
    task.doneAt = new Date().toISOString()
    saveDb(db)
    return ok({ pihavuoro: hydratePihavuoro(db, p!) })
  }
  const taskPatch = pathname.match(/^\/api\/tasks\/([^/]+)$/)
  if (taskPatch && method === 'PATCH') {
    const taskId = taskPatch[1]!
    const p = db.pihavuorot.find((x) => x.tasks.some((t) => t.id === taskId))
    if (!p) err('Ei löydy')
    const task = p!.tasks.find((t) => t.id === taskId)!
    const assignment = p!.assignments.find((a) => a.userId === user!.id)
    if (user!.role !== 'admin' && assignment?.role !== 'lead') {
      err('Vain vastuuhenkilö tai admin')
    }
    if (body.assigneeUserId !== undefined) {
      const assigneeId = body.assigneeUserId ? String(body.assigneeUserId) : null
      if (assigneeId) {
        const assignee = db.users.find((u) => u.id === assigneeId)
        if (task.effort === 'heavy' && assignee?.constraints.includes('no_heavy')) {
          err('Henkilöllä on rajoitus: ei raskaisiin töihin')
        }
      }
      task.assigneeUserId = assigneeId
    }
    saveDb(db)
    return ok({ pihavuoro: hydratePihavuoro(db, p!) })
  }

  // push stubs (no VAPID in Netlify Drop / local mode)
  if (pathname === '/api/push/vapid-public-key' && method === 'GET') {
    return ok({ publicKey: null })
  }
  if (pathname === '/api/push/status' && method === 'GET') {
    return ok({ subscribed: false })
  }
  if (pathname === '/api/push/subscribe' && (method === 'POST' || method === 'DELETE')) {
    return ok({ ok: true })
  }
  if (pathname === '/api/push/test' && method === 'POST') {
    err('Push-ilmoitukset eivät ole käytössä paikallisessa tilassa')
  }
  if (pathname.startsWith('/api/push')) {
    return ok({ ok: true, publicKey: null, subscribed: false })
  }

  err(`Paikallinen tila: reittiä ei tueta (${method} ${pathname})`)
  return ok({})
}

function hydrateSwap(db: Db, s: SwapOffer) {
  const p = db.pihavuorot.find((x) => x.id === s.pihavuoroId)
  return {
    id: s.id,
    pihavuoroId: s.pihavuoroId,
    weekStart: p?.weekStart || '',
    weekEnd: p ? addDays(p.weekStart, 6) : '',
    pihavuoroStatus: p?.status || null,
    fromUserId: s.fromUserId,
    fromUserName: db.users.find((u) => u.id === s.fromUserId)?.name || '—',
    toUserId: s.toUserId ?? null,
    toUserName: s.toUserId ? db.users.find((u) => u.id === s.toUserId)?.name || '—' : null,
    role: s.role,
    message: s.message ?? null,
    status: s.status,
    createdAt: s.createdAt,
    resolvedAt: s.resolvedAt ?? null,
    acceptedByUserId: s.acceptedByUserId ?? null,
    acceptedByUserName: s.acceptedByUserId
      ? db.users.find((u) => u.id === s.acceptedByUserId)?.name || '—'
      : null,
  }
}

function hydrateHub(h: HubInspection, db?: Db) {
  return {
    id: h.id,
    templateId: h.templateId,
    year: h.year,
    title: h.title,
    cadenceLabel: h.cadenceLabel,
    windowStart: h.windowStart,
    windowEnd: h.windowEnd,
    intro: h.intro ?? null,
    status: h.status,
    notes: h.notes ?? null,
    photoUrl: h.photoDataUrl || null,
    completedByUserId: h.completedByUserId ?? null,
    completedByName: h.completedByUserId
      ? db?.users.find((u) => u.id === h.completedByUserId)?.name || null
      : null,
    completedAt: h.completedAt ?? null,
    createdAt: h.createdAt,
    activatedAt: h.activatedAt ?? null,
    activated: Boolean(h.activatedAt),
    items: h.items,
    doneCount: h.items.filter((i) => i.status !== 'open').length,
    issueCount: h.items.filter((i) => i.status === 'issue').length,
    itemCount: h.items.length,
    protocol: HUB_ISSUE_PROTOCOL,
  }
}

function hydrateExtra(
  db: Db,
  t: Db['extraTasks'][number],
  me: string,
) {
  const signups = Array.isArray(t.signups) ? t.signups : []
  return {
    id: t.id,
    title: t.title,
    description: t.description ?? null,
    minRequired: t.minRequired,
    status: t.status,
    createdByUserId: t.createdByUserId,
    createdByName: db.users.find((u) => u.id === t.createdByUserId)?.name || '—',
    createdAt: t.createdAt,
    signups: signups.map((s) => ({
      id: s.id,
      userId: s.userId,
      userName: db.users.find((u) => u.id === s.userId)?.name || '—',
      signedUpAt: s.signedUpAt,
    })),
    signupCount: signups.length,
    spotsLeft: Math.max(0, t.minRequired - signups.length),
    iSignedUp: signups.some((s) => s.userId === me),
  }
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Kuvan luku epäonnistui'))
    reader.readAsDataURL(file)
  })
}
