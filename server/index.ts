import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import multer from 'multer'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'
import { randomBytes } from 'node:crypto'
import { startOfWeek, format, parseISO, addDays } from 'date-fns'
import {
  CONSTRAINT_LABELS,
  TASK_CATALOG_V1,
} from './catalog.ts'
import { db, initDb, publicUser, parseConstraints } from './db.ts'
import { vapidKeys } from './vapid.ts'
import { getWeather } from './weather.ts'
import { getCapWarnings } from './capWarnings.ts'
import {
  notifyUsers,
  runWeatherAlertCheck,
  sendWebPush,
  startWeatherAlertScheduler,
} from './weatherAlerts.ts'
import {
  getHubInspection,
  hubOpenSummary,
  listActivatedHubInspections,
  listHubInspections,
  seedHubYear,
  setHubActivated,
  updateHubInspection,
  updateHubItem,
} from './hub.ts'
import { dataDir, root, uploadsDir } from './paths.ts'
import { isCadenceKey, isSeasonKey, publicTaskCard, type TaskCard } from './taskCards.ts'
import {
  SEASON_LABELS,
  seasonForWeekStart,
  type SeasonKey,
} from '../src/shared/seasons.ts'
import { ensureLeadGuideTable, getLeadGuide, saveLeadGuide } from './leadGuide.ts'
import { ensureAppSettings, getAppSettings, saveAppSettings } from './appSettings.ts'
import { formatWeekRangeFi } from '../src/shared/datetime.ts'
import {
  MAX_HELPERS,
  MIN_HELPERS,
  normalizeTravelGroup,
  pickLeadAndHelpers,
  resolveHelperCount,
} from '../src/shared/travelGroup.ts'
import {
  assertCanDeleteUser,
  assertCanInviteAdmin,
  assertCanManageAdminRole,
  deleteUserRecord,
  isOwnerUser,
} from './userAdmin.ts'
import {
  cleanupBackupWorkDir,
  createBackupArchive,
  RESTORE_CONFIRM_WORD,
  restoreFromArchive,
} from './backup.ts'

const PORT = Number(process.env.PORT || 8787)

/** Chat kuuluu FAB-merkkiin + lukitusnäytön pushiin — ei Ilmo-listaan. */
const NOTIF_EXCLUDE_CHAT = `AND IFNULL(kind, 'general') NOT IN ('chat', 'swap')`

function loadJwtSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET
  const secretPath = path.join(dataDir, 'jwt-secret.txt')
  if (fs.existsSync(secretPath)) {
    const existing = fs.readFileSync(secretPath, 'utf8').trim()
    if (existing) return existing
  }
  const generated = crypto.randomUUID() + crypto.randomUUID()
  fs.mkdirSync(path.dirname(secretPath), { recursive: true })
  fs.writeFileSync(secretPath, generated, { mode: 0o600 })
  console.warn('JWT_SECRET puuttui — luotiin jwt-secret.txt DATA_DIR:iin (aseta JWT_SECRET tuotannossa)')
  return generated
}

const EFFECTIVE_JWT = loadJwtSecret()

initDb()
ensureLeadGuideTable()
ensureAppSettings()

const app = express()
app.set('trust proxy', 1)
app.use(cors({ origin: true, credentials: true }))
app.use(express.json({ limit: '2mb' }))
app.use(cookieParser())
app.use('/uploads', express.static(uploadsDir))

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || '.jpg'
      cb(null, `${Date.now()}-${crypto.randomUUID()}${ext}`)
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
})

const backupUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, path.join(os.tmpdir())),
    filename: (_req, _file, cb) => cb(null, `siisti-restore-${Date.now()}-${crypto.randomUUID()}.tar.gz`),
  }),
  limits: { fileSize: 200 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const name = file.originalname.toLowerCase()
    if (name.endsWith('.tar.gz') || name.endsWith('.tgz')) {
      cb(null, true)
      return
    }
    cb(new Error('Valitse .tar.gz-varmuuskopio'))
  },
})

type AuthUser = {
  id: string
  name: string
  email: string
  role: 'admin' | 'member'
  constraints: string[]
}

function signToken(user: AuthUser) {
  return jwt.sign(
    { sub: user.id, role: user.role, name: user.name, email: user.email },
    EFFECTIVE_JWT,
    { expiresIn: '30d' },
  )
}

function authMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  const header = req.headers.authorization
  const token = header?.startsWith('Bearer ') ? header.slice(7) : req.cookies?.token
  if (!token) return res.status(401).json({ error: 'Kirjaudu sisään' })
  try {
    const payload = jwt.verify(token, EFFECTIVE_JWT) as { sub: string }
    const row = db.prepare('SELECT * FROM users WHERE id = ? AND active = 1').get(payload.sub) as
      | Record<string, unknown>
      | undefined
    if (!row) return res.status(401).json({ error: 'Käyttäjää ei löydy' })
    ;(req as express.Request & { user: AuthUser }).user = {
      id: String(row.id),
      name: String(row.name),
      email: String(row.email),
      role: row.role as 'admin' | 'member',
      constraints: parseConstraints(String(row.constraints_json)),
    }
    next()
  } catch {
    return res.status(401).json({ error: 'Istunto vanhentunut' })
  }
}

function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const user = (req as express.Request & { user: AuthUser }).user
  if (user.role !== 'admin') return res.status(403).json({ error: 'Vain ylläpitäjälle' })
  next()
}

function mondayOf(dateStr?: string) {
  const d = dateStr ? parseISO(dateStr) : new Date()
  return format(startOfWeek(d, { weekStartsOn: 1 }), 'yyyy-MM-dd')
}

function seasonForDate(weekStart: string): SeasonKey {
  return seasonForWeekStart(weekStart)
}

function getAssignments(pihavuoroId: string) {
  return db
    .prepare(
      `SELECT a.*, u.name AS user_name, u.constraints_json, u.constraint_note
       FROM assignments a JOIN users u ON u.id = a.user_id
       WHERE a.pihavuoro_id = ?
       ORDER BY CASE a.role WHEN 'lead' THEN 0 ELSE 1 END, u.name`,
    )
    .all(pihavuoroId)
    .map((row) => {
      const r = row as Record<string, unknown>
      return {
        id: r.id,
        userId: r.user_id,
        role: r.role,
        userName: r.user_name,
        constraints: parseConstraints(String(r.constraints_json)),
        constraintNote: r.constraint_note ?? null,
        constraintLabels: parseConstraints(String(r.constraints_json)).map(
          (c) => CONSTRAINT_LABELS[c] || c,
        ),
      }
    })
}

function getTasks(pihavuoroId: string) {
  return db
    .prepare(
      `SELECT t.*, u.name AS assignee_name, d.name AS done_by_name
       FROM shift_tasks t
       LEFT JOIN users u ON u.id = t.assignee_user_id
       LEFT JOIN users d ON d.id = t.done_by_user_id
       WHERE t.pihavuoro_id = ?
       ORDER BY t.sort_order, t.title`,
    )
    .all(pihavuoroId)
    .map((row) => {
      const r = row as Record<string, unknown>
      return {
        id: r.id,
        templateId: r.template_id,
        title: r.title,
        instructions: r.instructions,
        effort: r.effort,
        assigneeUserId: r.assignee_user_id,
        assigneeName: r.assignee_name ?? null,
        status: r.status,
        skipReason: r.skip_reason,
        doneByUserId: r.done_by_user_id,
        doneByName: r.done_by_name ?? null,
        doneAt: r.done_at,
        sortOrder: r.sort_order,
      }
    })
}

function hydratePihavuoro(row: Record<string, unknown>) {
  const id = String(row.id)
  const season = isSeasonKey(row.season) ? row.season : seasonForWeekStart(String(row.week_start))
  return {
    id,
    weekStart: row.week_start,
    weekEnd: format(addDays(parseISO(String(row.week_start)), 6), 'yyyy-MM-dd'),
    status: row.status,
    season,
    seasonLabel: SEASON_LABELS[season],
    notes: row.notes,
    createdAt: row.created_at,
    assignments: getAssignments(id),
    tasks: getTasks(id),
  }
}

function defaultTemplateIdsForSeason(season: SeasonKey): string[] {
  return (
    db
      .prepare(
        `SELECT id FROM task_cards WHERE active = 1 AND season = ? AND cadence = 'weekly'
         ORDER BY sort_order ASC, title ASC`,
      )
      .all(season) as { id: string }[]
  ).map((r) => r.id)
}

function resolveTemplatesForSeason(
  season: SeasonKey,
  templateIds?: string[] | null,
): TaskCard[] {
  const rows = db
    .prepare(
      `SELECT * FROM task_cards WHERE active = 1 AND season = ? ORDER BY sort_order ASC, title ASC`,
    )
    .all(season) as Record<string, unknown>[]
  const seasonTemplates = rows.map(publicTaskCard)
  if (!templateIds || templateIds.length === 0) {
    return seasonTemplates.filter((t) => t.cadence === 'weekly')
  }
  const wanted = new Set(templateIds)
  return seasonTemplates.filter((t) => wanted.has(t.id))
}

function createTasksForPihavuoro(
  pihavuoroId: string,
  season: SeasonKey,
  _assignments: { userId: string; role: string }[],
  templateIds?: string[] | null,
) {
  const templates = resolveTemplatesForSeason(season, templateIds)
  const insert = db.prepare(
    `INSERT INTO shift_tasks (id, pihavuoro_id, template_id, title, instructions, effort, assignee_user_id, status, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, NULL, 'open', ?)`,
  )

  // Tehtävät ovat koko vuoron yhteisiä — ei henkilökohtaista nimeämistä
  for (const t of templates) {
    insert.run(
      crypto.randomUUID(),
      pihavuoroId,
      t.id,
      t.title,
      t.instructions,
      t.effort,
      t.sortOrder,
    )
  }
}

function lastShiftAt(userId: string): string | null {
  const row = db
    .prepare(
      `SELECT p.week_start FROM assignments a
       JOIN pihavuorot p ON p.id = a.pihavuoro_id
       WHERE a.user_id = ? AND p.status IN ('published','done')
       ORDER BY p.week_start DESC LIMIT 1`,
    )
    .get(userId) as { week_start: string } | undefined
  return row?.week_start ?? null
}

function upcomingMondays(count = 10): string[] {
  const start = mondayOf()
  return Array.from({ length: count }, (_, i) =>
    format(addDays(parseISO(start), i * 7), 'yyyy-MM-dd'),
  )
}

function blockedUserIdsForWeek(weekStart: string): Set<string> {
  return new Set(
    (
      db.prepare(`SELECT user_id FROM week_blocks WHERE week_start = ?`).all(weekStart) as {
        user_id: string
      }[]
    ).map((r) => r.user_id),
  )
}

function recommend(weekStart: string, helperCount = 4, opts: { ignoreCurrentWeek?: boolean } = {}) {
  const today = format(new Date(), 'yyyy-MM-dd')
  const blocked = blockedUserIdsForWeek(weekStart)
  const users = (
    db.prepare(`SELECT * FROM users WHERE active = 1 AND role IN ('admin','member')`).all() as Record<
      string,
      unknown
    >[]
  )
    .map(publicUser)
    .filter((u) => !u.snoozeUntil || String(u.snoozeUntil) <= today)
    .filter((u) => !blocked.has(u.id))

  const already = new Set(
    opts.ignoreCurrentWeek
      ? []
      : (
          db
            .prepare(
              `SELECT a.user_id FROM assignments a
           JOIN pihavuorot p ON p.id = a.pihavuoro_id
           WHERE p.week_start = ?`,
            )
            .all(weekStart) as { user_id: string }[]
        ).map((r) => r.user_id),
  )

  const ranked = users
    .filter((u) => !already.has(u.id))
    .map((u) => ({ ...u, last: lastShiftAt(u.id) }))
    .sort((a, b) => {
      if (!a.last && !b.last) return a.name.localeCompare(b.name, 'fi')
      if (!a.last) return -1
      if (!b.last) return 1
      return a.last.localeCompare(b.last) || a.name.localeCompare(b.name, 'fi')
    })

  const { lead, helpers } = pickLeadAndHelpers(ranked, helperCount)

  return {
    lead,
    helpers,
    ranked,
    blockedCount: blocked.size,
    availableCount: ranked.length,
  }
}

// ——— Auth ———
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string }
  if (!email || !password) return res.status(400).json({ error: 'Anna sähköposti ja salasana' })
  const row = db.prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE').get(email.trim()) as
    | Record<string, unknown>
    | undefined
  if (!row || !row.active) return res.status(401).json({ error: 'Virheellinen tunnus tai salasana' })
  if (!bcrypt.compareSync(password, String(row.password_hash))) {
    return res.status(401).json({ error: 'Virheellinen tunnus tai salasana' })
  }
  const user = publicUser(row) as AuthUser & Record<string, unknown>
  const token = signToken(user as AuthUser)
  const secure = req.secure || req.headers['x-forwarded-proto'] === 'https'
  res.cookie('token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    maxAge: 30 * 24 * 3600 * 1000,
  })
  res.json({ token, user })
})

app.post('/api/auth/logout', (req, res) => {
  const secure = req.secure || req.headers['x-forwarded-proto'] === 'https'
  res.clearCookie('token', { sameSite: 'lax', secure, httpOnly: true })
  res.json({ ok: true })
})

app.get('/api/auth/me', authMiddleware, (req, res) => {
  const auth = (req as express.Request & { user: AuthUser }).user
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(auth.id) as Record<string, unknown>
  res.json({ user: publicUser(row) })
})

function publicAppUrl(req: express.Request) {
  const fromEnv = process.env.APP_PUBLIC_URL?.trim().replace(/\/$/, '')
  if (fromEnv) return fromEnv
  const proto = String(req.headers['x-forwarded-proto'] || req.protocol || 'https').split(',')[0]
  const host = req.get('host')
  return `${proto}://${host}`
}

function activeAdminCount() {
  return (
    db.prepare(`SELECT COUNT(*) AS c FROM users WHERE role = 'admin' AND active = 1`).get() as {
      c: number
    }
  ).c
}

function publicInvite(row: Record<string, unknown>, inviteUrl?: string) {
  const expired = new Date(String(row.expires_at)) < new Date()
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    constraints: parseConstraints(String(row.constraints_json ?? '[]')),
    travelGroup: row.travel_group ? String(row.travel_group) : null,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    acceptedAt: row.accepted_at ?? null,
    revokedAt: row.revoked_at ?? null,
    inviteUrl: inviteUrl ?? null,
    status: row.revoked_at
      ? 'revoked'
      : row.accepted_at
        ? 'accepted'
        : expired
          ? 'expired'
          : 'pending',
  }
}

// ——— Users ———
app.get('/api/users', authMiddleware, requireAdmin, (_req, res) => {
  const rows = db.prepare('SELECT * FROM users ORDER BY name').all() as Record<string, unknown>[]
  res.json({ users: rows.map(publicUser) })
})

app.get('/api/directory', authMiddleware, (_req, res) => {
  const rows = db
    .prepare(`SELECT id, name FROM users WHERE active = 1 ORDER BY name`)
    .all() as { id: string; name: string }[]
  res.json({ users: rows })
})

app.post('/api/users', authMiddleware, requireAdmin, (req, res) => {
  const actor = (req as express.Request & { user: AuthUser }).user
  const { name, email, password, role, constraints, constraintNote, snoozeUntil, travelGroup } =
    req.body as {
      name?: string
      email?: string
      password?: string
      role?: 'admin' | 'member'
      constraints?: string[]
      constraintNote?: string
      snoozeUntil?: string | null
      travelGroup?: string | null
    }
  if (!name?.trim() || !email?.trim() || !password) {
    return res.status(400).json({ error: 'Nimi, sähköposti ja salasana vaaditaan' })
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Salasanan oltava vähintään 8 merkkiä' })
  }
  const nextRole = role === 'admin' ? 'admin' : 'member'
  try {
    assertCanInviteAdmin(actor, nextRole)
  } catch (e) {
    return res.status(403).json({ error: e instanceof Error ? e.message : 'Ei oikeuksia' })
  }
  const id = crypto.randomUUID()
  try {
    db.prepare(
      `INSERT INTO users (id, name, email, password_hash, role, active, constraints_json, constraint_note, snooze_until, travel_group, created_at)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      name.trim(),
      email.trim().toLowerCase(),
      bcrypt.hashSync(password, 10),
      nextRole,
      JSON.stringify(constraints ?? []),
      constraintNote ?? null,
      snoozeUntil || null,
      normalizeTravelGroup(travelGroup),
      new Date().toISOString(),
    )
  } catch {
    return res.status(400).json({ error: 'Sähköposti on jo käytössä' })
  }
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as Record<string, unknown>
  res.status(201).json({ user: publicUser(row) })
})

app.patch('/api/users/:id', authMiddleware, requireAdmin, (req, res) => {
  const actor = (req as express.Request & { user: AuthUser }).user
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id) as
    | Record<string, unknown>
    | undefined
  if (!row) return res.status(404).json({ error: 'Ei löydy' })
  const body = req.body as Record<string, unknown>
  const name = body.name != null ? String(body.name) : String(row.name)
  const email = body.email != null ? String(body.email).toLowerCase() : String(row.email)
  const role = body.role === 'admin' || body.role === 'member' ? body.role : String(row.role)
  const active = body.active != null ? (body.active ? 1 : 0) : row.active
  const wasAdmin = row.role === 'admin' && Number(row.active) === 1
  const staysAdmin = role === 'admin' && Number(active) === 1
  try {
    assertCanManageAdminRole(
      actor,
      { email: String(row.email), role: String(row.role) },
      staysAdmin ? 'admin' : 'member',
    )
  } catch (e) {
    return res.status(403).json({ error: e instanceof Error ? e.message : 'Ei oikeuksia' })
  }
  if (wasAdmin && !staysAdmin && activeAdminCount() <= 1) {
    return res.status(400).json({ error: 'Viimeistä ylläpitäjää ei voi poistaa tai alentaa' })
  }
  if (isOwnerUser({ email: String(row.email) }) && !isOwnerUser(actor)) {
    return res.status(403).json({ error: 'Pääkäyttäjän tietoja voi muokata vain hän itse' })
  }
  const constraints = body.constraints != null ? JSON.stringify(body.constraints) : row.constraints_json
  const constraintNote =
    body.constraintNote !== undefined ? (body.constraintNote as string | null) : row.constraint_note
  const snoozeUntil =
    body.snoozeUntil !== undefined ? (body.snoozeUntil as string | null) : row.snooze_until
  const travelGroup =
    body.travelGroup !== undefined
      ? normalizeTravelGroup(body.travelGroup)
      : row.travel_group
        ? String(row.travel_group)
        : null
  db.prepare(
    `UPDATE users SET name=?, email=?, role=?, active=?, constraints_json=?, constraint_note=?, snooze_until=?, travel_group=? WHERE id=?`,
  ).run(
    name,
    email,
    role,
    active,
    constraints,
    constraintNote,
    snoozeUntil || null,
    travelGroup,
    req.params.id,
  )
  if (body.password) {
    if (String(body.password).length < 8) {
      return res.status(400).json({ error: 'Salasanan oltava vähintään 8 merkkiä' })
    }
    db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(
      bcrypt.hashSync(String(body.password), 10),
      req.params.id,
    )
  }
  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id) as Record<
    string,
    unknown
  >
  res.json({ user: publicUser(updated) })
})

app.delete('/api/users/:id', authMiddleware, requireAdmin, (req, res) => {
  const actor = (req as express.Request & { user: AuthUser }).user
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id) as
    | Record<string, unknown>
    | undefined
  if (!row) return res.status(404).json({ error: 'Ei löydy' })
  try {
    assertCanDeleteUser(
      actor,
      {
        id: String(row.id),
        email: String(row.email),
        role: String(row.role),
        active: Number(row.active),
      },
      activeAdminCount(),
    )
    deleteUserRecord(db, String(row.id))
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Poisto epäonnistui'
    const status =
      msg.includes('Vain pääkäyttäjä') || msg.includes('Pääkäyttäjää') || msg.includes('omaa tiliä')
        ? 403
        : 400
    return res.status(status).json({ error: msg })
  }
  res.json({ ok: true })
})

// ——— Invites ———
app.get('/api/invites', authMiddleware, requireAdmin, (req, res) => {
  const rows = db
    .prepare(
      `SELECT * FROM invites WHERE accepted_at IS NULL AND revoked_at IS NULL ORDER BY created_at DESC`,
    )
    .all() as Record<string, unknown>[]
  const base = publicAppUrl(req)
  res.json({
    invites: rows.map((r) => publicInvite(r, `${base}/kutsu/${r.token}`)),
  })
})

app.post('/api/invites', authMiddleware, requireAdmin, (req, res) => {
  const user = (req as express.Request & { user: AuthUser }).user
  const { name, email, role, constraints, travelGroup } = req.body as {
    name?: string
    email?: string
    role?: 'admin' | 'member'
    constraints?: string[]
    travelGroup?: string | null
  }
  if (!name?.trim() || !email?.trim()) {
    return res.status(400).json({ error: 'Nimi ja sähköposti vaaditaan' })
  }
  const nextRole = role === 'admin' ? 'admin' : 'member'
  try {
    assertCanInviteAdmin(user, nextRole)
  } catch (e) {
    return res.status(403).json({ error: e instanceof Error ? e.message : 'Ei oikeuksia' })
  }
  const normalizedEmail = email.trim().toLowerCase()
  const existingUser = db
    .prepare('SELECT id FROM users WHERE email = ? COLLATE NOCASE')
    .get(normalizedEmail)
  if (existingUser) return res.status(400).json({ error: 'Käyttäjä on jo olemassa tällä sähköpostilla' })

  const pending = db
    .prepare(
      `SELECT id FROM invites
       WHERE email = ? COLLATE NOCASE AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > ?`,
    )
    .get(normalizedEmail, new Date().toISOString())
  if (pending) return res.status(400).json({ error: 'Tälle sähköpostille on jo avoin kutsu' })

  const id = crypto.randomUUID()
  const token = randomBytes(24).toString('hex')
  const now = new Date()
  const expires = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
  const group = normalizeTravelGroup(travelGroup)
  db.prepare(
    `INSERT INTO invites (id, token, name, email, role, constraints_json, travel_group, created_by_user_id, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    token,
    name.trim(),
    normalizedEmail,
    nextRole,
    JSON.stringify(Array.isArray(constraints) ? constraints : []),
    group,
    user.id,
    now.toISOString(),
    expires.toISOString(),
  )
  const row = db.prepare('SELECT * FROM invites WHERE id = ?').get(id) as Record<string, unknown>
  const inviteUrl = `${publicAppUrl(req)}/kutsu/${token}`
  res.status(201).json({ invite: publicInvite(row, inviteUrl) })
})

app.delete('/api/invites/:id', authMiddleware, requireAdmin, (req, res) => {
  const row = db.prepare('SELECT * FROM invites WHERE id = ?').get(req.params.id) as
    | Record<string, unknown>
    | undefined
  if (!row) return res.status(404).json({ error: 'Kutsua ei löydy' })
  db.prepare(`UPDATE invites SET revoked_at = ? WHERE id = ?`).run(
    new Date().toISOString(),
    req.params.id,
  )
  res.json({ ok: true })
})

app.get('/api/invites/token/:token', (req, res) => {
  const row = db.prepare('SELECT * FROM invites WHERE token = ?').get(req.params.token) as
    | Record<string, unknown>
    | undefined
  if (!row || row.revoked_at) return res.status(404).json({ error: 'Kutsu ei ole voimassa' })
  if (row.accepted_at) return res.status(400).json({ error: 'Kutsu on jo käytetty' })
  if (new Date(String(row.expires_at)) < new Date()) {
    return res.status(400).json({ error: 'Kutsu on vanhentunut' })
  }
  res.json({
    invite: {
      name: row.name,
      email: row.email,
      role: row.role,
      constraints: parseConstraints(String(row.constraints_json ?? '[]')),
      expiresAt: row.expires_at,
    },
  })
})

app.post('/api/invites/token/:token/accept', (req, res) => {
  const row = db.prepare('SELECT * FROM invites WHERE token = ?').get(req.params.token) as
    | Record<string, unknown>
    | undefined
  if (!row || row.revoked_at) return res.status(404).json({ error: 'Kutsu ei ole voimassa' })
  if (row.accepted_at) return res.status(400).json({ error: 'Kutsu on jo käytetty' })
  if (new Date(String(row.expires_at)) < new Date()) {
    return res.status(400).json({ error: 'Kutsu on vanhentunut' })
  }
  const { password } = req.body as { password?: string }
  if (!password || password.length < 8) {
    return res.status(400).json({ error: 'Salasanan oltava vähintään 8 merkkiä' })
  }
  const email = String(row.email).toLowerCase()
  const existing = db.prepare('SELECT id FROM users WHERE email = ? COLLATE NOCASE').get(email)
  if (existing) return res.status(400).json({ error: 'Käyttäjä on jo olemassa' })

  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  db.prepare(
    `INSERT INTO users (id, name, email, password_hash, role, active, constraints_json, travel_group, created_at)
     VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)`,
  ).run(
    id,
    String(row.name),
    email,
    bcrypt.hashSync(password, 10),
    row.role === 'admin' ? 'admin' : 'member',
    String(row.constraints_json ?? '[]'),
    row.travel_group ? String(row.travel_group) : null,
    now,
  )
  db.prepare(`UPDATE invites SET accepted_at = ? WHERE id = ?`).run(now, row.id)

  const userRow = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as Record<string, unknown>
  const user = publicUser(userRow) as AuthUser & Record<string, unknown>
  const jwt = signToken(user as AuthUser)
  const secure = req.secure || req.headers['x-forwarded-proto'] === 'https'
  res.cookie('token', jwt, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    maxAge: 30 * 24 * 60 * 60 * 1000,
  })
  res.status(201).json({ token: jwt, user })
})

app.get('/api/catalog', authMiddleware, (_req, res) => {
  res.json({ templates: TASK_CATALOG_V1, constraintLabels: CONSTRAINT_LABELS })
})

// ——— Vastuuveljen ohjeet ———
app.get('/api/lead-guide', authMiddleware, (_req, res) => {
  res.json({ guide: getLeadGuide() })
})

app.put('/api/lead-guide', authMiddleware, requireAdmin, (req, res) => {
  const guide = saveLeadGuide(req.body?.guide ?? req.body)
  res.json({ guide })
})

// ——— Sovelluksen asetukset ———
app.get('/api/app-settings', authMiddleware, (_req, res) => {
  res.json({ settings: getAppSettings() })
})

app.put('/api/app-settings', authMiddleware, requireAdmin, (req, res) => {
  const settings = saveAppSettings(req.body?.settings ?? req.body)
  res.json({ settings })
})

// ——— Varmuuskopio (admin) ———
app.get('/api/admin/backup', authMiddleware, requireAdmin, async (_req, res) => {
  let workDir: string | null = null
  try {
    const created = await createBackupArchive()
    workDir = created.workDir
    res.setHeader('Content-Type', 'application/gzip')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${created.filename}"; filename*=UTF-8''${encodeURIComponent(created.filename)}`,
    )
    res.setHeader('Cache-Control', 'no-store')
    const stream = fs.createReadStream(created.archivePath)
    const cleanup = () => {
      if (workDir) cleanupBackupWorkDir(workDir)
      workDir = null
    }
    stream.on('error', (err) => {
      cleanup()
      if (!res.headersSent) {
        res.status(500).json({ error: 'Varmuuskopion lukeminen epäonnistui' })
      } else {
        res.destroy(err)
      }
    })
    res.on('close', cleanup)
    stream.pipe(res)
  } catch (err) {
    if (workDir) cleanupBackupWorkDir(workDir)
    console.error('backup failed', err)
    if (!res.headersSent) {
      res.status(500).json({ error: 'Varmuuskopion luonti epäonnistui' })
    }
  }
})

app.post(
  '/api/admin/backup/restore',
  authMiddleware,
  requireAdmin,
  (req, res, next) => {
    backupUpload.single('backup')(req, res, (err: unknown) => {
      if (err) {
        const msg = err instanceof Error ? err.message : 'Tiedoston vastaanotto epäonnistui'
        return res.status(400).json({ error: msg })
      }
      next()
    })
  },
  async (req, res) => {
    const confirm = String(req.body?.confirm || '').trim().toUpperCase()
    if (confirm !== RESTORE_CONFIRM_WORD) {
      if (req.file?.path) fs.rmSync(req.file.path, { force: true })
      return res.status(400).json({
        error: `Vahvista palautus kirjoittamalla ${RESTORE_CONFIRM_WORD}`,
      })
    }
    if (!req.file?.path) {
      return res.status(400).json({ error: 'Valitse varmuuskopiotiedosto (.tar.gz)' })
    }
    const archivePath = req.file.path
    try {
      const result = await restoreFromArchive(archivePath)
      res.json({
        ok: true,
        message: 'Varmuuskopio palautettu. Nykyinen data korvattiin.',
        users: result.users,
      })
    } catch (err) {
      console.error('restore failed', err)
      const msg = err instanceof Error ? err.message : 'Palautus epäonnistui'
      res.status(400).json({ error: msg })
    } finally {
      try {
        fs.rmSync(archivePath, { force: true })
      } catch {
        /* ignore */
      }
    }
  },
)

// ——— Tehtäväkortit (admin) ———
app.get('/api/task-cards', authMiddleware, requireAdmin, (_req, res) => {
  const rows = db
    .prepare(`SELECT * FROM task_cards ORDER BY sort_order ASC, title ASC`)
    .all() as Record<string, unknown>[]
  res.json({ cards: rows.map(publicTaskCard) })
})

app.post('/api/task-cards', authMiddleware, requireAdmin, (req, res) => {
  const title = String(req.body.title || '').trim()
  if (!title) return res.status(400).json({ error: 'Anna otsikko' })
  const instructions = String(req.body.instructions || '').trim()
  const effort = req.body.effort === 'heavy' ? 'heavy' : 'light'
  const season = isSeasonKey(req.body.season) ? req.body.season : 'kesa'
  const cadence = isCadenceKey(req.body.cadence) ? req.body.cadence : 'weekly'
  const defaultAssignee =
    req.body.defaultAssignee === 'lead' || req.body.defaultAssignee === 'all'
      ? req.body.defaultAssignee
      : 'helpers'
  const maxOrder = (
    db.prepare(`SELECT COALESCE(MAX(sort_order), 0) AS m FROM task_cards`).get() as { m: number }
  ).m
  const id = crypto.randomUUID()
  db.prepare(
    `INSERT INTO task_cards (id, title, instructions, effort, season, cadence, default_assignee, active, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
  ).run(id, title, instructions, effort, season, cadence, defaultAssignee, maxOrder + 10)
  const row = db.prepare('SELECT * FROM task_cards WHERE id = ?').get(id) as Record<string, unknown>
  res.status(201).json({ card: publicTaskCard(row) })
})

app.patch('/api/task-cards/:id', authMiddleware, requireAdmin, (req, res) => {
  const row = db.prepare('SELECT * FROM task_cards WHERE id = ?').get(req.params.id) as
    | Record<string, unknown>
    | undefined
  if (!row) return res.status(404).json({ error: 'Korttia ei löydy' })
  const current = publicTaskCard(row)
  const title =
    req.body.title !== undefined ? String(req.body.title).trim() || current.title : current.title
  const instructions =
    req.body.instructions !== undefined
      ? String(req.body.instructions || '')
      : current.instructions
  const effort =
    req.body.effort === 'light' || req.body.effort === 'heavy' ? req.body.effort : current.effort
  const season = isSeasonKey(req.body.season) ? req.body.season : current.season
  const cadence = isCadenceKey(req.body.cadence) ? req.body.cadence : current.cadence
  const defaultAssignee =
    req.body.defaultAssignee === 'lead' ||
    req.body.defaultAssignee === 'helpers' ||
    req.body.defaultAssignee === 'all'
      ? req.body.defaultAssignee
      : current.defaultAssignee
  const active = typeof req.body.active === 'boolean' ? req.body.active : current.active
  const sortOrder =
    typeof req.body.sortOrder === 'number' ? req.body.sortOrder : current.sortOrder
  db.prepare(
    `UPDATE task_cards
     SET title=?, instructions=?, effort=?, season=?, cadence=?, default_assignee=?, active=?, sort_order=?
     WHERE id=?`,
  ).run(
    title,
    instructions,
    effort,
    season,
    cadence,
    defaultAssignee,
    active ? 1 : 0,
    sortOrder,
    req.params.id,
  )
  const next = db.prepare('SELECT * FROM task_cards WHERE id = ?').get(req.params.id) as Record<
    string,
    unknown
  >
  res.json({ card: publicTaskCard(next) })
})

app.delete('/api/task-cards/:id', authMiddleware, requireAdmin, (req, res) => {
  const info = db.prepare('DELETE FROM task_cards WHERE id = ?').run(req.params.id)
  if (info.changes === 0) return res.status(404).json({ error: 'Korttia ei löydy' })
  res.json({ ok: true })
})

/** Julkinen build-tieto — varmista että Render deploy on uusin (ei välimuistia). */
app.get('/api/meta/app', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store')
  const commit =
    process.env.RENDER_GIT_COMMIT ||
    process.env.GIT_COMMIT ||
    process.env.SOURCE_VERSION ||
    null
  res.json({
    commit: commit ? String(commit).slice(0, 7) : null,
    commitFull: commit ? String(commit) : null,
    uiVersion: 'apukutsut-push-ilmo-2026-10-04',
  })
})

// ——— Käytettävyys (esteviikot) ———
/** Poista menneet esteviikot — lista rullaa aina nykyisestä maanantaista eteenpäin. */
function prunePastWeekBlocks(userId?: string) {
  const start = mondayOf()
  if (userId) {
    db.prepare(`DELETE FROM week_blocks WHERE user_id = ? AND week_start < ?`).run(userId, start)
  } else {
    db.prepare(`DELETE FROM week_blocks WHERE week_start < ?`).run(start)
  }
}

app.get('/api/availability', authMiddleware, (req, res) => {
  const user = (req as express.Request & { user: AuthUser }).user
  const count = Math.min(16, Math.max(4, Number(req.query.weeks) || 10))
  const weeks = upcomingMondays(count)
  const targetId =
    user.role === 'admin' && req.query.userId ? String(req.query.userId) : user.id
  prunePastWeekBlocks(targetId)

  const blocked = new Set(
    (
      db
        .prepare(
          `SELECT week_start FROM week_blocks
           WHERE user_id = ? AND week_start >= ? AND week_start <= ?`,
        )
        .all(targetId, weeks[0], weeks[weeks.length - 1]!) as { week_start: string }[]
    ).map((r) => r.week_start),
  )

  const published = new Set(
    (
      db
        .prepare(
          `SELECT week_start FROM pihavuorot
           WHERE status IN ('published','done') AND week_start >= ? AND week_start <= ?`,
        )
        .all(weeks[0], weeks[weeks.length - 1]!) as { week_start: string }[]
    ).map((r) => r.week_start),
  )

  const myAssignments = new Map(
    (
      db
        .prepare(
          `SELECT p.week_start, a.role FROM assignments a
           JOIN pihavuorot p ON p.id = a.pihavuoro_id
           WHERE a.user_id = ? AND p.week_start >= ? AND p.week_start <= ?`,
        )
        .all(targetId, weeks[0], weeks[weeks.length - 1]!) as {
        week_start: string
        role: string
      }[]
    ).map((r) => [r.week_start, r.role]),
  )

  res.json({
    userId: targetId,
    weeksAhead: count,
    windowStart: weeks[0],
    windowEnd: weeks[weeks.length - 1],
    weeks: weeks.map((weekStart) => ({
      weekStart,
      weekEnd: format(addDays(parseISO(weekStart), 6), 'yyyy-MM-dd'),
      blocked: blocked.has(weekStart),
      published: published.has(weekStart),
      myRole: myAssignments.get(weekStart) || null,
    })),
  })
})

app.put('/api/availability', authMiddleware, (req, res) => {
  const user = (req as express.Request & { user: AuthUser }).user
  const count = Math.min(16, Math.max(4, Number(req.body?.weeks) || 10))
  const window = upcomingMondays(count)
  const windowSet = new Set(window)
  const blockedWeeks = Array.isArray(req.body?.blockedWeeks)
    ? (req.body.blockedWeeks as unknown[]).map(String).filter((w) => windowSet.has(w))
    : []
  prunePastWeekBlocks(user.id)

  const del = db.prepare(
    `DELETE FROM week_blocks WHERE user_id = ? AND week_start >= ? AND week_start <= ?`,
  )
  const insert = db.prepare(
    `INSERT INTO week_blocks (id, user_id, week_start, note, created_at) VALUES (?, ?, ?, NULL, ?)`,
  )
  const now = new Date().toISOString()
  const tx = db.transaction(() => {
    del.run(user.id, window[0], window[window.length - 1]!)
    for (const weekStart of blockedWeeks) {
      // Don't block a week you're already assigned to as published — admin should reassign first
      const assigned = db
        .prepare(
          `SELECT a.id FROM assignments a
           JOIN pihavuorot p ON p.id = a.pihavuoro_id
           WHERE a.user_id = ? AND p.week_start = ? AND p.status = 'published'`,
        )
        .get(user.id, weekStart)
      if (assigned) continue
      insert.run(crypto.randomUUID(), user.id, weekStart, now)
    }
  })
  tx()

  const saved = (
    db
      .prepare(
        `SELECT week_start FROM week_blocks
         WHERE user_id = ? AND week_start >= ? AND week_start <= ?
         ORDER BY week_start`,
      )
      .all(user.id, window[0], window[window.length - 1]!) as { week_start: string }[]
  ).map((r) => r.week_start)

  res.json({ ok: true, blockedWeeks: saved })
})

app.get('/api/availability/summary', authMiddleware, requireAdmin, (req, res) => {
  const count = Math.min(16, Math.max(4, Number(req.query.weeks) || 10))
  const weeks = upcomingMondays(count)
  const users = (
    db.prepare(`SELECT id, name FROM users WHERE active = 1 ORDER BY name`).all() as {
      id: string
      name: string
    }[]
  )
  const blocks = db
    .prepare(
      `SELECT user_id, week_start FROM week_blocks
       WHERE week_start >= ? AND week_start <= ?`,
    )
    .all(weeks[0], weeks[weeks.length - 1]!) as { user_id: string; week_start: string }[]

  const byWeek = weeks.map((weekStart) => {
    const blockedUsers = blocks
      .filter((b) => b.week_start === weekStart)
      .map((b) => {
        const u = users.find((x) => x.id === b.user_id)
        return { id: b.user_id, name: u?.name || '—' }
      })
    const activeCount = users.length - blockedUsers.length
    return {
      weekStart,
      weekEnd: format(addDays(parseISO(weekStart), 6), 'yyyy-MM-dd'),
      blockedUsers,
      availableCount: activeCount,
      tight: activeCount < 5,
    }
  })

  res.json({ weeks: byWeek, userCount: users.length })
})

// ——— Pihavuorot ———
app.get('/api/pihavuorot', authMiddleware, (req, res) => {
  const user = (req as express.Request & { user: AuthUser }).user
  const rows = db
    .prepare('SELECT * FROM pihavuorot ORDER BY week_start DESC')
    .all() as Record<string, unknown>[]
  const list = rows
    .map(hydratePihavuoro)
    .filter((p) => user.role === 'admin' || p.status !== 'draft')
  res.json({ pihavuorot: list })
})

app.get('/api/pihavuorot/meta/recommend', authMiddleware, requireAdmin, (req, res) => {
  const weekStart = mondayOf(String(req.query.weekStart || ''))
  const helperCount = resolveHelperCount({
    totalPeople: req.query.totalPeople,
    helperCount: req.query.helperCount,
  })
  const ignoreCurrentWeek = String(req.query.fresh || '') === '1'
  res.json({
    weekStart,
    ...recommend(weekStart, helperCount, { ignoreCurrentWeek }),
    helperCount,
    totalPeople: helperCount + 1,
    season: seasonForDate(weekStart),
  })
})

app.get('/api/pihavuorot/:id', authMiddleware, (req, res) => {
  const user = (req as express.Request & { user: AuthUser }).user
  const row = db.prepare('SELECT * FROM pihavuorot WHERE id = ?').get(req.params.id) as
    | Record<string, unknown>
    | undefined
  if (!row) return res.status(404).json({ error: 'Ei löydy' })
  const p = hydratePihavuoro(row)
  if (p.status === 'draft' && user.role !== 'admin') {
    return res.status(403).json({ error: 'Luonnos vain ylläpitäjälle' })
  }
  res.json({ pihavuoro: p })
})

app.post('/api/pihavuorot', authMiddleware, requireAdmin, (req, res) => {
  let weekStart = mondayOf(req.body.weekStart)
  // Jos viikko on jo olemassa tai weekStart ei annettu, etsi seuraava vapaa maanantai
  if (!req.body.weekStart) {
    for (let i = 0; i < 52; i++) {
      const candidate = format(addDays(parseISO(weekStart), i * 7), 'yyyy-MM-dd')
      const exists = db.prepare('SELECT id FROM pihavuorot WHERE week_start = ?').get(candidate)
      if (!exists) {
        weekStart = candidate
        break
      }
    }
  }
  const season = isSeasonKey(req.body.season) ? req.body.season : seasonForDate(weekStart)
  const helperCount = resolveHelperCount({
    totalPeople: req.body.totalPeople,
    helperCount: req.body.helperCount,
  })
  const useRecommend = req.body.recommend !== false
  const id = crypto.randomUUID()

  const existing = db.prepare('SELECT id FROM pihavuorot WHERE week_start = ?').get(weekStart)
  if (existing) return res.status(400).json({ error: 'Viikolle on jo Pihavuoro' })

  let leadId = req.body.leadUserId as string | undefined
  let helperIds = (req.body.helperUserIds as string[] | undefined) ?? []

  if (useRecommend && !leadId) {
    const rec = recommend(weekStart, helperCount)
    leadId = rec.lead?.id
    helperIds = rec.helpers.map((h) => h.id)
  }

  if (!leadId) {
    return res.status(400).json({
      error:
        'Vastuuhenkilöä ei löytynyt — liian monta esteviikkoa tai rajoitetta tälle viikolle',
    })
  }
  if (helperIds.length < MIN_HELPERS || helperIds.length > MAX_HELPERS) {
    return res.status(400).json({
      error:
        helperIds.length < MIN_HELPERS
          ? `Vain ${helperIds.length} saatavilla olevaa jäsentä tälle viikolle (tarvitaan ${MIN_HELPERS}–${MAX_HELPERS} avustajaa). Tarkista esteviikot.`
          : `Avustajia tarvitaan ${MIN_HELPERS}–${MAX_HELPERS}`,
    })
  }

  const now = new Date().toISOString()
  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO pihavuorot (id, week_start, status, season, notes, created_at) VALUES (?, ?, 'draft', ?, ?, ?)`,
    ).run(id, weekStart, season, req.body.notes ?? null, now)
    db.prepare(
      `INSERT INTO assignments (id, pihavuoro_id, user_id, role) VALUES (?, ?, ?, 'lead')`,
    ).run(crypto.randomUUID(), id, leadId)
    for (const hid of helperIds) {
      db.prepare(
        `INSERT INTO assignments (id, pihavuoro_id, user_id, role) VALUES (?, ?, ?, 'helper')`,
      ).run(crypto.randomUUID(), id, hid)
    }
    const assignments = [
      { userId: leadId!, role: 'lead' },
      ...helperIds.map((userId) => ({ userId, role: 'helper' })),
    ]
    const templateIds = Array.isArray(req.body.templateIds)
      ? (req.body.templateIds as unknown[]).map(String)
      : defaultTemplateIdsForSeason(season)
    createTasksForPihavuoro(id, season, assignments, templateIds)
  })
  tx()

  const row = db.prepare('SELECT * FROM pihavuorot WHERE id = ?').get(id) as Record<string, unknown>
  res.status(201).json({ pihavuoro: hydratePihavuoro(row) })
})

app.patch('/api/pihavuorot/:id', authMiddleware, requireAdmin, (req, res) => {
  const row = db.prepare('SELECT * FROM pihavuorot WHERE id = ?').get(req.params.id) as
    | Record<string, unknown>
    | undefined
  if (!row) return res.status(404).json({ error: 'Ei löydy' })
  const status = req.body.status ?? row.status
  const season: SeasonKey = isSeasonKey(req.body.season)
    ? req.body.season
    : isSeasonKey(row.season)
      ? row.season
      : seasonForDate(String(row.week_start))
  const notes = req.body.notes !== undefined ? req.body.notes : row.notes
  db.prepare('UPDATE pihavuorot SET status=?, season=?, notes=? WHERE id=?').run(
    status,
    season,
    notes,
    req.params.id,
  )

  if (req.body.leadUserId || req.body.helperUserIds) {
    const leadId = req.body.leadUserId as string
    const helperIds = req.body.helperUserIds as string[]
    if (
      !leadId ||
      !helperIds ||
      helperIds.length < MIN_HELPERS ||
      helperIds.length > MAX_HELPERS
    ) {
      return res.status(400).json({
        error: `Kokoonpano: 1 vastuu + ${MIN_HELPERS}–${MAX_HELPERS} avustajaa`,
      })
    }
    const existingTemplateIds = (
      db
        .prepare(
          `SELECT DISTINCT template_id FROM shift_tasks
           WHERE pihavuoro_id = ? AND template_id IS NOT NULL`,
        )
        .all(req.params.id) as { template_id: string }[]
    )
      .map((r) => r.template_id)
      .filter(Boolean)
    const customTasks = db
      .prepare(
        `SELECT id, title, instructions, effort, status, skip_reason, done_by_user_id, done_at, sort_order
         FROM shift_tasks WHERE pihavuoro_id = ? AND template_id IS NULL`,
      )
      .all(req.params.id) as {
      id: string
      title: string
      instructions: string
      effort: string
      status: string
      skip_reason: string | null
      done_by_user_id: string | null
      done_at: string | null
      sort_order: number
    }[]
    const templateIds = Array.isArray(req.body.templateIds)
      ? (req.body.templateIds as unknown[]).map(String)
      : existingTemplateIds.length
        ? existingTemplateIds
        : defaultTemplateIdsForSeason(season)
    const tx = db.transaction(() => {
      db.prepare('DELETE FROM assignments WHERE pihavuoro_id = ?').run(req.params.id)
      db.prepare('DELETE FROM shift_tasks WHERE pihavuoro_id = ?').run(req.params.id)
      db.prepare(
        `INSERT INTO assignments (id, pihavuoro_id, user_id, role) VALUES (?, ?, ?, 'lead')`,
      ).run(crypto.randomUUID(), req.params.id, leadId)
      for (const hid of helperIds) {
        db.prepare(
          `INSERT INTO assignments (id, pihavuoro_id, user_id, role) VALUES (?, ?, ?, 'helper')`,
        ).run(crypto.randomUUID(), req.params.id, hid)
      }
      createTasksForPihavuoro(
        String(req.params.id),
        season,
        [
          { userId: leadId, role: 'lead' },
          ...helperIds.map((userId) => ({ userId, role: 'helper' })),
        ],
        templateIds,
      )
      // Säilytä kertaluonteiset lisätehtävät kokoonpanon päivityksen jälkeen
      const reinsert = db.prepare(
        `INSERT INTO shift_tasks
         (id, pihavuoro_id, template_id, title, instructions, effort, assignee_user_id, status, sort_order, skip_reason, done_by_user_id, done_at)
         VALUES (?, ?, NULL, ?, ?, ?, NULL, ?, ?, ?, ?, ?)`,
      )
      for (const c of customTasks) {
        reinsert.run(
          c.id,
          req.params.id,
          c.title,
          c.instructions,
          c.effort,
          c.status,
          c.sort_order,
          c.skip_reason,
          c.done_by_user_id,
          c.done_at,
        )
      }
    })
    tx()
  }

  const updated = db.prepare('SELECT * FROM pihavuorot WHERE id = ?').get(req.params.id) as Record<
    string,
    unknown
  >
  res.json({ pihavuoro: hydratePihavuoro(updated) })
})

/** Admin: sync which catalog tasks belong to this week (preserves done/skipped when possible). */
app.put('/api/pihavuorot/:id/tasks', authMiddleware, requireAdmin, (req, res) => {
  const row = db.prepare('SELECT * FROM pihavuorot WHERE id = ?').get(req.params.id) as
    | Record<string, unknown>
    | undefined
  if (!row) return res.status(404).json({ error: 'Ei löydy' })
  if (!Array.isArray(req.body.templateIds)) {
    return res.status(400).json({ error: 'templateIds vaaditaan' })
  }
  const season = isSeasonKey(row.season)
    ? row.season
    : seasonForDate(String(row.week_start))
  const templateIds = (req.body.templateIds as unknown[]).map(String)
  const templates = resolveTemplatesForSeason(season, templateIds)
  if (!templates.length) {
    return res.status(400).json({ error: 'Valitse ainakin yksi huoltotehtävä' })
  }

  const existing = db
    .prepare(
      `SELECT id, template_id, status, skip_reason, done_by_user_id, done_at, assignee_user_id
       FROM shift_tasks WHERE pihavuoro_id = ?`,
    )
    .all(req.params.id) as {
    id: string
    template_id: string | null
    status: string
    skip_reason: string | null
    done_by_user_id: string | null
    done_at: string | null
    assignee_user_id: string | null
  }[]

  const keepByTemplate = new Map(
    existing.filter((t) => t.template_id).map((t) => [t.template_id as string, t]),
  )
  const wanted = new Set(templates.map((t) => t.id))

  const insert = db.prepare(
    `INSERT INTO shift_tasks (id, pihavuoro_id, template_id, title, instructions, effort, assignee_user_id, status, sort_order, skip_reason, done_by_user_id, done_at)
     VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?)`,
  )

  const tx = db.transaction(() => {
    for (const old of existing) {
      // Kertaluonteiset (ei template_id) säilyvät katalogin synkronoinnissa
      if (!old.template_id) continue
      if (!wanted.has(old.template_id)) {
        db.prepare('DELETE FROM shift_tasks WHERE id = ?').run(old.id)
      }
    }

    for (const t of templates) {
      const prev = keepByTemplate.get(t.id)
      if (prev) {
        db.prepare(
          'UPDATE shift_tasks SET title=?, instructions=?, effort=?, sort_order=?, assignee_user_id=NULL WHERE id=?',
        ).run(t.title, t.instructions, t.effort, t.sortOrder, prev.id)
        continue
      }

      insert.run(
        crypto.randomUUID(),
        req.params.id,
        t.id,
        t.title,
        t.instructions,
        t.effort,
        'open',
        t.sortOrder,
        null,
        null,
        null,
      )
    }
  })
  tx()

  const updated = db.prepare('SELECT * FROM pihavuorot WHERE id = ?').get(req.params.id) as Record<
    string,
    unknown
  >
  res.json({ pihavuoro: hydratePihavuoro(updated) })
})

/** Admin: lisää kertaluonteinen lisätehtävä tälle viikolle (ei katalogikortti). */
app.post('/api/pihavuorot/:id/tasks/custom', authMiddleware, requireAdmin, (req, res) => {
  const row = db.prepare('SELECT * FROM pihavuorot WHERE id = ?').get(req.params.id) as
    | Record<string, unknown>
    | undefined
  if (!row) return res.status(404).json({ error: 'Ei löydy' })

  const title = String(req.body?.title || '').trim().slice(0, 120)
  if (!title) return res.status(400).json({ error: 'Anna tehtävän nimi' })
  const instructions = String(req.body?.instructions || '').trim().slice(0, 600) || title
  const effort = req.body?.effort === 'heavy' ? 'heavy' : 'light'

  const maxSort = (
    db
      .prepare(`SELECT COALESCE(MAX(sort_order), 0) AS m FROM shift_tasks WHERE pihavuoro_id = ?`)
      .get(req.params.id) as { m: number }
  ).m

  const id = crypto.randomUUID()
  db.prepare(
    `INSERT INTO shift_tasks
     (id, pihavuoro_id, template_id, title, instructions, effort, assignee_user_id, status, sort_order)
     VALUES (?, ?, NULL, ?, ?, ?, NULL, 'open', ?)`,
  ).run(id, req.params.id, title, instructions, effort, maxSort + 10)

  const updated = db.prepare('SELECT * FROM pihavuorot WHERE id = ?').get(req.params.id) as Record<
    string,
    unknown
  >
  res.status(201).json({ pihavuoro: hydratePihavuoro(updated) })
})

/** Admin: poista kertaluonteinen lisätehtävä. */
app.delete('/api/tasks/:id', authMiddleware, requireAdmin, (req, res) => {
  const task = db.prepare('SELECT * FROM shift_tasks WHERE id = ?').get(req.params.id) as
    | Record<string, unknown>
    | undefined
  if (!task) return res.status(404).json({ error: 'Tehtävää ei löydy' })
  if (task.template_id) {
    return res.status(400).json({
      error: 'Katalogitehtävä poistetaan viikon tehtävävalinnasta, ei tästä',
    })
  }
  const pihavuoroId = String(task.pihavuoro_id)
  db.prepare('DELETE FROM shift_tasks WHERE id = ?').run(req.params.id)
  const updated = db.prepare('SELECT * FROM pihavuorot WHERE id = ?').get(pihavuoroId) as Record<
    string,
    unknown
  >
  res.json({ pihavuoro: hydratePihavuoro(updated) })
})

app.post('/api/pihavuorot/:id/publish', authMiddleware, requireAdmin, (req, res) => {
  const row = db.prepare('SELECT * FROM pihavuorot WHERE id = ?').get(req.params.id) as
    | Record<string, unknown>
    | undefined
  if (!row) return res.status(404).json({ error: 'Ei löydy' })
  db.prepare(`UPDATE pihavuorot SET status='published' WHERE id=?`).run(req.params.id)
  const updated = db.prepare('SELECT * FROM pihavuorot WHERE id = ?').get(req.params.id) as Record<
    string,
    unknown
  >
  const hydrated = hydratePihavuoro(updated)
  const assigneeIds = hydrated.assignments.map((a) => String(a.userId))
  if (assigneeIds.length) {
    notifyUsers(
      assigneeIds,
      'Pihavuoro julkaistu',
      `${formatWeekRangeFi(hydrated.weekStart, hydrated.weekEnd)}: vuorosi on valmis katsottavaksi.`,
      `/pihavuoro/${hydrated.id}`,
      'shift',
    )
  }
  res.json({ pihavuoro: hydrated })
})

app.delete('/api/pihavuorot/:id', authMiddleware, requireAdmin, (req, res) => {
  const row = db.prepare('SELECT * FROM pihavuorot WHERE id = ?').get(req.params.id) as
    | Record<string, unknown>
    | undefined
  if (!row) return res.status(404).json({ error: 'Ei löydy' })
  const id = String(req.params.id)
  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE extra_tasks SET related_pihavuoro_id = NULL WHERE related_pihavuoro_id = ?`,
    ).run(id)
    db.prepare(`DELETE FROM weather_alert_log WHERE pihavuoro_id = ?`).run(id)
    db.prepare(`DELETE FROM pihavuorot WHERE id = ?`).run(id)
  })
  tx()
  res.json({
    ok: true,
    message: 'Pihavuoro poistettu',
    weekStart: row.week_start,
  })
})

// ——— Task completion ———
app.post('/api/tasks/:id/complete', authMiddleware, (req, res) => {
  const user = (req as express.Request & { user: AuthUser }).user
  const task = db.prepare('SELECT * FROM shift_tasks WHERE id = ?').get(req.params.id) as
    | Record<string, unknown>
    | undefined
  if (!task) return res.status(404).json({ error: 'Tehtävää ei löydy' })

  const assignment = db
    .prepare('SELECT * FROM assignments WHERE pihavuoro_id = ? AND user_id = ?')
    .get(task.pihavuoro_id, user.id) as Record<string, unknown> | undefined
  const isLead = assignment?.role === 'lead'
  if (!isLead && user.role !== 'admin') {
    return res.status(403).json({ error: 'Vain vastuuveli voi kuitata viikon tehtävät' })
  }

  const status = req.body.status === 'skipped' ? 'skipped' : 'done'
  db.prepare(
    `UPDATE shift_tasks SET status=?, skip_reason=?, done_by_user_id=?, done_at=? WHERE id=?`,
  ).run(
    status,
    status === 'skipped' ? req.body.skipReason || 'Ei tarvetta' : null,
    user.id,
    new Date().toISOString(),
    req.params.id,
  )

  const piha = db.prepare('SELECT * FROM pihavuorot WHERE id = ?').get(task.pihavuoro_id) as Record<
    string,
    unknown
  >
  res.json({ pihavuoro: hydratePihavuoro(piha) })
})

app.patch('/api/tasks/:id', authMiddleware, (req, res) => {
  const user = (req as express.Request & { user: AuthUser }).user
  const task = db.prepare('SELECT * FROM shift_tasks WHERE id = ?').get(req.params.id) as
    | Record<string, unknown>
    | undefined
  if (!task) return res.status(404).json({ error: 'Ei löydy' })
  const assignment = db
    .prepare('SELECT * FROM assignments WHERE pihavuoro_id = ? AND user_id = ?')
    .get(task.pihavuoro_id, user.id) as Record<string, unknown> | undefined
  if (user.role !== 'admin' && assignment?.role !== 'lead') {
    return res.status(403).json({ error: 'Vain vastuuhenkilö tai admin' })
  }
  const assigneeUserId =
    req.body.assigneeUserId !== undefined ? req.body.assigneeUserId : task.assignee_user_id
  if (assigneeUserId) {
    const u = db.prepare('SELECT constraints_json FROM users WHERE id = ?').get(assigneeUserId) as
      | { constraints_json: string }
      | undefined
    const c = parseConstraints(u?.constraints_json ?? '[]')
    if (task.effort === 'heavy' && c.includes('no_heavy')) {
      return res.status(400).json({ error: 'Henkilöllä on rajoitus: ei raskaisiin töihin' })
    }
  }
  db.prepare('UPDATE shift_tasks SET assignee_user_id=? WHERE id=?').run(
    assigneeUserId || null,
    req.params.id,
  )
  const piha = db.prepare('SELECT * FROM pihavuorot WHERE id = ?').get(task.pihavuoro_id) as Record<
    string,
    unknown
  >
  res.json({ pihavuoro: hydratePihavuoro(piha) })
})

function isAssignedTo(pihavuoroId: string, userId: string) {
  return Boolean(
    db
      .prepare('SELECT id FROM assignments WHERE pihavuoro_id = ? AND user_id = ?')
      .get(pihavuoroId, userId),
  )
}

// ——— Viikkokeskustelu (vain vuorossa oleville) ———
function requireShiftMember(pihavuoroId: string, userId: string) {
  return isAssignedTo(pihavuoroId, userId)
}

function hydrateMessage(row: Record<string, unknown>) {
  const authorName = (
    db.prepare('SELECT name FROM users WHERE id = ?').get(row.author_user_id) as
      | { name: string }
      | undefined
  )?.name
  return {
    id: row.id,
    pihavuoroId: row.pihavuoro_id,
    authorUserId: row.author_user_id,
    authorName: authorName || '—',
    body: row.body,
    createdAt: row.created_at,
  }
}

app.get('/api/pihavuorot/:id/messages', authMiddleware, (req, res) => {
  const user = (req as express.Request & { user: AuthUser }).user
  const piha = db.prepare('SELECT id FROM pihavuorot WHERE id = ?').get(req.params.id)
  if (!piha) return res.status(404).json({ error: 'Pihavuoroa ei löydy' })
  if (!requireShiftMember(String(req.params.id), user.id)) {
    return res.status(403).json({ error: 'Viestit näkyvät vain tämän viikon vuorossa oleville' })
  }
  const messages = (
    db
      .prepare(
        `SELECT * FROM shift_messages WHERE pihavuoro_id = ? ORDER BY created_at ASC LIMIT 200`,
      )
      .all(req.params.id) as Record<string, unknown>[]
  ).map(hydrateMessage)
  res.json({ messages })
})

app.post('/api/pihavuorot/:id/messages', authMiddleware, (req, res) => {
  const user = (req as express.Request & { user: AuthUser }).user
  const piha = db.prepare('SELECT * FROM pihavuorot WHERE id = ?').get(req.params.id) as
    | Record<string, unknown>
    | undefined
  if (!piha) return res.status(404).json({ error: 'Pihavuoroa ei löydy' })
  if (!requireShiftMember(String(req.params.id), user.id)) {
    return res.status(403).json({ error: 'Vain vuorossa olevat voivat lähettää viestejä' })
  }
  if (piha.status === 'draft') {
    return res.status(400).json({ error: 'Keskustelu aukeaa kun vuoro on julkaistu' })
  }
  const body = String(req.body.body || '').trim()
  if (!body) return res.status(400).json({ error: 'Kirjoita viesti' })
  if (body.length > 2000) return res.status(400).json({ error: 'Viesti on liian pitkä' })

  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  db.prepare(
    `INSERT INTO shift_messages (id, pihavuoro_id, author_user_id, body, created_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(id, req.params.id, user.id, body, now)

  const recipients = (
    db
      .prepare(
        `SELECT user_id FROM assignments WHERE pihavuoro_id = ? AND user_id != ?`,
      )
      .all(req.params.id, user.id) as { user_id: string }[]
  ).map((r) => r.user_id)
  const weekStart = String(piha.week_start)
  const weekEnd = format(addDays(parseISO(weekStart), 6), 'yyyy-MM-dd')
  const weekLabel = formatWeekRangeFi(weekStart, weekEnd)
  if (recipients.length) {
    try {
      // Vain lukitusnäytön push — ei Ilmo-välilehden riviä (lukemattomat → chat-kuvake)
      void sendWebPush(
        recipients,
        'Uusi viesti vuorokeskustelussa',
        `${user.name} (${weekLabel}): ${body.length > 80 ? `${body.slice(0, 77)}…` : body}`,
        `/pihavuoro/${req.params.id}?chat=1`,
        'chat',
      )
    } catch (err) {
      console.warn('Chat push failed', err)
    }
  }

  res.status(201).json({
    message: hydrateMessage(
      db.prepare('SELECT * FROM shift_messages WHERE id = ?').get(id) as Record<string, unknown>,
    ),
    weekLabel,
  })
})

app.get('/api/chat/current', authMiddleware, (req, res) => {
  const user = (req as express.Request & { user: AuthUser }).user
  const today = format(new Date(), 'yyyy-MM-dd')
  const row = db
    .prepare(
      `SELECT p.* FROM pihavuorot p
       JOIN assignments a ON a.pihavuoro_id = p.id
       WHERE a.user_id = ?
         AND p.status = 'published'
         AND date(p.week_start, '+6 days') >= ?
       ORDER BY p.week_start ASC
       LIMIT 1`,
    )
    .get(user.id, today) as Record<string, unknown> | undefined

  if (!row) {
    return res.json({ chat: null })
  }

  const pihavuoroId = String(row.id)
  const weekStart = String(row.week_start)
  const weekEnd = format(addDays(parseISO(weekStart), 6), 'yyyy-MM-dd')
  const messageCount = (
    db
      .prepare(`SELECT COUNT(*) AS c FROM shift_messages WHERE pihavuoro_id = ?`)
      .get(pihavuoroId) as { c: number }
  ).c
  const last = db
    .prepare(
      `SELECT created_at FROM shift_messages WHERE pihavuoro_id = ? ORDER BY created_at DESC LIMIT 1`,
    )
    .get(pihavuoroId) as { created_at: string } | undefined
  const assignment = db
    .prepare(`SELECT role FROM assignments WHERE pihavuoro_id = ? AND user_id = ?`)
    .get(pihavuoroId, user.id) as { role: string } | undefined

  res.json({
    chat: {
      pihavuoroId,
      weekStart,
      weekEnd,
      messageCount,
      lastMessageAt: last?.created_at ?? null,
      myRole: assignment?.role || null,
    },
  })
})

function currentPublishedWeekLeadIds(): string[] {
  const today = format(new Date(), 'yyyy-MM-dd')
  const covering = db
    .prepare(
      `SELECT p.id FROM pihavuorot p
       WHERE p.status = 'published'
         AND p.week_start <= ?
         AND date(p.week_start, '+6 days') >= ?
       ORDER BY p.week_start DESC`,
    )
    .all(today, today) as { id: string }[]
  let weekIds = covering.map((r) => r.id)
  if (weekIds.length === 0) {
    const next = db
      .prepare(
        `SELECT id FROM pihavuorot
         WHERE status = 'published' AND week_start >= ?
         ORDER BY week_start ASC LIMIT 1`,
      )
      .get(mondayOf()) as { id: string } | undefined
    if (next) weekIds = [next.id]
  }
  if (weekIds.length === 0) return []
  const placeholders = weekIds.map(() => '?').join(',')
  return (
    db
      .prepare(
        `SELECT DISTINCT user_id FROM assignments
         WHERE role = 'lead' AND pihavuoro_id IN (${placeholders})`,
      )
      .all(...weekIds) as { user_id: string }[]
  ).map((r) => r.user_id)
}

function noticeVisibleToUser(
  notice: { audience?: unknown; author_user_id: unknown },
  user: AuthUser,
): boolean {
  if (user.role === 'admin' || String(notice.author_user_id) === user.id) return true
  const audience = notice.audience === 'leads' ? 'leads' : 'all'
  if (audience === 'all') return true
  const isLead = Boolean(
    db
      .prepare(
        `SELECT 1 FROM assignments a
         JOIN pihavuorot p ON p.id = a.pihavuoro_id
         WHERE a.user_id = ? AND a.role = 'lead' AND p.status = 'published'
         LIMIT 1`,
      )
      .get(user.id),
  )
  return isLead
}

function hydrateNoticeRow(r: Record<string, unknown>) {
  const replies = db
    .prepare(
      `SELECT r.*, u.name AS author_name FROM notice_replies r
       JOIN users u ON u.id = r.author_user_id
       WHERE r.notice_id = ? ORDER BY r.created_at`,
    )
    .all(r.id)
    .map((rr) => {
      const x = rr as Record<string, unknown>
      return {
        id: x.id,
        body: x.body,
        authorName: x.author_name,
        authorUserId: x.author_user_id,
        createdAt: x.created_at,
      }
    })
  const ackName = r.acknowledged_by_user_id
    ? (
        db
          .prepare('SELECT name FROM users WHERE id = ?')
          .get(r.acknowledged_by_user_id) as { name: string } | undefined
      )?.name ?? null
    : null
  return {
    id: r.id,
    body: r.body,
    photoUrl: r.photo_path ? `/uploads/${path.basename(String(r.photo_path))}` : null,
    status: r.status,
    audience: r.audience === 'leads' ? 'leads' : 'all',
    acknowledgedAt: r.acknowledged_at ?? null,
    acknowledgedByName: ackName,
    authorName: r.author_name,
    authorUserId: r.author_user_id,
    createdAt: r.created_at,
    resolvedAt: r.resolved_at,
    replies,
  }
}

// ——— Notices ———
app.get('/api/notices', authMiddleware, (req, res) => {
  const user = (req as express.Request & { user: AuthUser }).user
  const notices = (
    db
      .prepare(
        `SELECT n.*, u.name AS author_name FROM notices n
         JOIN users u ON u.id = n.author_user_id
         ORDER BY n.created_at DESC`,
      )
      .all() as Record<string, unknown>[]
  )
    .filter((r) => noticeVisibleToUser(r, user))
    .map(hydrateNoticeRow)
  res.json({ notices })
})

app.post('/api/notices', authMiddleware, upload.single('photo'), (req, res) => {
  const user = (req as express.Request & { user: AuthUser }).user
  const body = String(req.body.body || '').trim()
  if (!body) return res.status(400).json({ error: 'Kirjoita viesti' })
  const audience = String(req.body.audience || 'all') === 'leads' ? 'leads' : 'all'
  const id = crypto.randomUUID()
  const photoPath = req.file ? req.file.path : null
  db.prepare(
    `INSERT INTO notices (id, author_user_id, body, photo_path, status, audience, created_at)
     VALUES (?, ?, ?, ?, 'open', ?, ?)`,
  ).run(id, user.id, body, photoPath, audience, new Date().toISOString())

  let recipients: string[]
  if (audience === 'all') {
    recipients = (
      db.prepare(`SELECT id FROM users WHERE active = 1 AND id != ?`).all(user.id) as {
        id: string
      }[]
    ).map((u) => u.id)
  } else {
    const adminIds = (
      db
        .prepare(`SELECT id FROM users WHERE active = 1 AND role = 'admin'`)
        .all() as { id: string }[]
    ).map((u) => u.id)
    recipients = [...new Set([...adminIds, ...currentPublishedWeekLeadIds()])].filter(
      (id) => id !== user.id,
    )
  }
  notifyUsers(
    recipients,
    'Uusi huomio',
    body.length > 120 ? `${body.slice(0, 117)}…` : body,
    '/huomiot',
    'notice',
  )

  res.status(201).json({ id })
})

app.post('/api/notices/:id/ack', authMiddleware, requireAdmin, (req, res) => {
  const user = (req as express.Request & { user: AuthUser }).user
  const notice = db.prepare('SELECT * FROM notices WHERE id = ?').get(req.params.id) as
    | Record<string, unknown>
    | undefined
  if (!notice) return res.status(404).json({ error: 'Ei löydy' })
  const now = new Date().toISOString()
  db.prepare(
    `UPDATE notices
     SET acknowledged_at = ?, acknowledged_by_user_id = ?,
         status = CASE WHEN status = 'open' THEN 'in_progress' ELSE status END
     WHERE id = ?`,
  ).run(now, user.id, req.params.id)
  const authorId = String(notice.author_user_id)
  if (authorId && authorId !== user.id) {
    notifyUsers(
      [authorId],
      'Huomio kuitattu',
      `${user.name} kuitasi huomiosi.`,
      '/huomiot',
      'notice',
    )
  }
  const row = db
    .prepare(
      `SELECT n.*, u.name AS author_name FROM notices n
       JOIN users u ON u.id = n.author_user_id WHERE n.id = ?`,
    )
    .get(req.params.id) as Record<string, unknown>
  res.json({ notice: hydrateNoticeRow(row) })
})

app.post('/api/notices/:id/replies', authMiddleware, requireAdmin, (req, res) => {
  const user = (req as express.Request & { user: AuthUser }).user
  const notice = db.prepare('SELECT * FROM notices WHERE id = ?').get(req.params.id) as
    | Record<string, unknown>
    | undefined
  if (!notice) return res.status(404).json({ error: 'Ei löydy' })
  const body = String(req.body.body || '').trim()
  if (!body) return res.status(400).json({ error: 'Kirjoita vastaus' })
  db.prepare(
    `INSERT INTO notice_replies (id, notice_id, author_user_id, body, created_at) VALUES (?, ?, ?, ?, ?)`,
  ).run(crypto.randomUUID(), req.params.id, user.id, body, new Date().toISOString())
  if (req.body.status) {
    db.prepare('UPDATE notices SET status=?, resolved_at=? WHERE id=?').run(
      req.body.status,
      req.body.status === 'resolved' ? new Date().toISOString() : null,
      req.params.id,
    )
  } else if (notice.status === 'open') {
    db.prepare(`UPDATE notices SET status = 'in_progress' WHERE id = ?`).run(req.params.id)
  }
  const authorId = String(notice.author_user_id)
  if (authorId && authorId !== user.id) {
    notifyUsers(
      [authorId],
      'Vastaus huomioosi',
      body.length > 120 ? `${body.slice(0, 117)}…` : body,
      '/huomiot',
      'notice',
    )
  }
  res.json({ ok: true })
})

app.patch('/api/notices/:id', authMiddleware, requireAdmin, (req, res) => {
  const status = req.body.status as string
  if (!['open', 'in_progress', 'resolved'].includes(status)) {
    return res.status(400).json({ error: 'Virheellinen tila' })
  }
  db.prepare('UPDATE notices SET status=?, resolved_at=? WHERE id=?').run(
    status,
    status === 'resolved' ? new Date().toISOString() : null,
    req.params.id,
  )
  res.json({ ok: true })
})

app.delete('/api/notices/:id', authMiddleware, requireAdmin, (req, res) => {
  const info = db.prepare('DELETE FROM notices WHERE id = ?').run(req.params.id)
  if (info.changes === 0) return res.status(404).json({ error: 'Ei löydy' })
  res.json({ ok: true })
})

// ——— Home summary ———
app.get('/api/home', authMiddleware, async (req, res) => {
  const user = (req as express.Request & { user: AuthUser }).user
  const weekStart = mondayOf()
  const row = db
    .prepare(
      `SELECT p.* FROM pihavuorot p
       JOIN assignments a ON a.pihavuoro_id = p.id
       WHERE a.user_id = ? AND p.status = 'published' AND p.week_start >= ?
       ORDER BY p.week_start ASC LIMIT 1`,
    )
    .get(user.id, weekStart) as Record<string, unknown> | undefined

  const openNotices = (
    db
      .prepare(
        `SELECT n.*, u.name AS author_name FROM notices n
         JOIN users u ON u.id = n.author_user_id
         WHERE n.status != 'resolved'`,
      )
      .all() as Record<string, unknown>[]
  ).filter((r) => noticeVisibleToUser(r, user)).length

  const openExtras = (
    db
      .prepare(
        `SELECT COUNT(*) AS c FROM extra_tasks WHERE status IN ('open','ready','in_progress')`,
      )
      .get() as { c: number }
  ).c

  let weather = null
  try {
    const [forecast, warnings] = await Promise.all([
      getWeather(getAppSettings().weatherPlace),
      getCapWarnings(),
    ])
    weather = { ...forecast, warnings }
  } catch (err) {
    console.warn('Weather fetch failed', err)
  }

  // Poista vanhat vuoronvaihto-ilmoitukset (ominaisuus poistettu)
  db.prepare(`DELETE FROM notifications WHERE kind = 'swap'`).run()

  const unreadNotifications = (
    db
      .prepare(
        `SELECT COUNT(*) AS c FROM notifications
         WHERE user_id = ? AND read_at IS NULL ${NOTIF_EXCLUDE_CHAT}`,
      )
      .get(user.id) as { c: number }
  ).c

  // Etusivulla vain lukemattomat — luetut näkyvät Ilmo-välilehdellä
  const recentNotifications = db
    .prepare(
      `SELECT id, title, body, link, kind, read_at, created_at
       FROM notifications
       WHERE user_id = ? AND read_at IS NULL ${NOTIF_EXCLUDE_CHAT}
       ORDER BY created_at DESC LIMIT 5`,
    )
    .all(user.id)
    .map((r) => {
      const row = r as Record<string, unknown>
      return {
        id: row.id,
        title: row.title,
        body: row.body,
        link: row.link,
        kind: row.kind || 'general',
        readAt: row.read_at ?? null,
        createdAt: row.created_at,
      }
    })

  const availabilityWindow = upcomingMondays(10)
  const myBlockedCount = (
    db
      .prepare(
        `SELECT COUNT(*) AS c FROM week_blocks
         WHERE user_id = ? AND week_start >= ? AND week_start <= ?`,
      )
      .get(user.id, availabilityWindow[0], availabilityWindow[availabilityWindow.length - 1]!) as {
      c: number
    }
  ).c

  const nextId = row ? String(row.id) : null
  const chatMessageCount = nextId
    ? (
        db
          .prepare(`SELECT COUNT(*) AS c FROM shift_messages WHERE pihavuoro_id = ?`)
          .get(nextId) as { c: number }
      ).c
    : 0

  res.json({
    nextPihavuoro: row ? hydratePihavuoro(row) : null,
    openNotices,
    openExtraTasks: openExtras,
    canCreateExtraTask: user.role === 'admin' || isCurrentWeekLead(user.id),
    constraintLabels: CONSTRAINT_LABELS,
    weather,
    unreadNotifications,
    recentNotifications,
    hub: hubOpenSummary(),
    availability: {
      weeksAhead: 10,
      blockedCount: myBlockedCount,
    },
    chat: nextId
      ? {
          pihavuoroId: nextId,
          messageCount: chatMessageCount,
        }
      : null,
  })
})

app.get('/api/weather', authMiddleware, async (_req, res) => {
  try {
    const [forecast, warnings] = await Promise.all([
      getWeather(getAppSettings().weatherPlace),
      getCapWarnings(),
    ])
    res.json({ ...forecast, warnings })
  } catch (err) {
    console.warn('Weather fetch failed', err)
    res.status(502).json({ error: 'Säätietoja ei saatu juuri nyt' })
  }
})

app.post('/api/weather/alerts/run', authMiddleware, requireAdmin, async (_req, res) => {
  try {
    res.json(await runWeatherAlertCheck())
  } catch (err) {
    console.warn('Weather alert run failed', err)
    res.status(502).json({ error: 'Säähälytysten ajo epäonnistui' })
  }
})

app.get('/api/notifications', authMiddleware, (req, res) => {
  const user = (req as express.Request & { user: AuthUser }).user
  // Siivoa vanhat chat-rivit (chat → vain FAB + push)
  db.prepare(`DELETE FROM notifications WHERE user_id = ? AND kind = 'chat'`).run(user.id)
  const rows = db
    .prepare(
      `SELECT id, title, body, link, kind, read_at, created_at
       FROM notifications WHERE user_id = ? ${NOTIF_EXCLUDE_CHAT}
       ORDER BY created_at DESC LIMIT 40`,
    )
    .all(user.id) as Record<string, unknown>[]
  const unreadCount = (
    db
      .prepare(
        `SELECT COUNT(*) AS c FROM notifications
         WHERE user_id = ? AND read_at IS NULL ${NOTIF_EXCLUDE_CHAT}`,
      )
      .get(user.id) as { c: number }
  ).c
  res.json({
    unreadCount,
    items: rows.map((r) => ({
      id: r.id,
      title: r.title,
      body: r.body,
      link: r.link,
      kind: r.kind || 'general',
      readAt: r.read_at ?? null,
      createdAt: r.created_at,
    })),
  })
})

app.post('/api/notifications/read-all', authMiddleware, (req, res) => {
  const user = (req as express.Request & { user: AuthUser }).user
  db.prepare(
    `UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL`,
  ).run(new Date().toISOString(), user.id)
  res.json({ ok: true })
})

app.post('/api/notifications/:id/read', authMiddleware, (req, res) => {
  const user = (req as express.Request & { user: AuthUser }).user
  db.prepare(
    `UPDATE notifications SET read_at = ? WHERE id = ? AND user_id = ? AND read_at IS NULL`,
  ).run(new Date().toISOString(), req.params.id, user.id)
  res.json({ ok: true })
})

app.delete('/api/notifications', authMiddleware, requireAdmin, (_req, res) => {
  db.prepare(`DELETE FROM notifications`).run()
  res.json({ ok: true })
})

// ——— Extra tasks (apukutsut) ———
function isCurrentWeekLead(userId: string) {
  const weekStart = mondayOf()
  const row = db
    .prepare(
      `SELECT a.id FROM assignments a
       JOIN pihavuorot p ON p.id = a.pihavuoro_id
       WHERE a.user_id = ? AND a.role = 'lead' AND p.status = 'published' AND p.week_start = ?`,
    )
    .get(userId, weekStart)
  return Boolean(row)
}

function isOnCurrentWeekShift(userId: string) {
  const weekStart = mondayOf()
  const row = db
    .prepare(
      `SELECT a.id FROM assignments a
       JOIN pihavuorot p ON p.id = a.pihavuoro_id
       WHERE a.user_id = ? AND p.status = 'published' AND p.week_start = ?`,
    )
    .get(userId, weekStart)
  return Boolean(row)
}

function canViewHub(user: AuthUser, insp: { activated?: boolean }) {
  if (user.role === 'admin') return true
  return Boolean(insp.activated) && isOnCurrentWeekShift(user.id)
}

function canEditHubTasks(user: AuthUser, insp: { activated?: boolean }) {
  if (user.role === 'admin') return true
  return Boolean(insp.activated) && isCurrentWeekLead(user.id)
}

function canCreateExtra(user: AuthUser) {
  return user.role === 'admin' || isCurrentWeekLead(user.id)
}

function notifyAllActive(title: string, body: string, link: string) {
  const users = db.prepare(`SELECT id FROM users WHERE active = 1`).all() as { id: string }[]
  notifyUsers(
    users.map((u) => u.id),
    title,
    body,
    link,
    'extra',
  )
}

app.get('/api/push/vapid-public-key', authMiddleware, (_req, res) => {
  res.json({ publicKey: vapidKeys.publicKey })
})

app.get('/api/push/status', authMiddleware, (req, res) => {
  const user = (req as express.Request & { user: AuthUser }).user
  const count = (
    db.prepare(`SELECT COUNT(*) AS c FROM push_subscriptions WHERE user_id = ?`).get(user.id) as {
      c: number
    }
  ).c
  res.json({ subscribed: count > 0 })
})

app.post('/api/push/subscribe', authMiddleware, (req, res) => {
  const user = (req as express.Request & { user: AuthUser }).user
  const sub = req.body?.subscription as
    | { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
    | undefined
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
    return res.status(400).json({ error: 'Virheellinen tilaus' })
  }
  const existing = db.prepare(`SELECT id FROM push_subscriptions WHERE endpoint = ?`).get(sub.endpoint) as
    | { id: string }
    | undefined
  if (existing) {
    db.prepare(
      `UPDATE push_subscriptions SET user_id=?, p256dh=?, auth=? WHERE id=?`,
    ).run(user.id, sub.keys.p256dh, sub.keys.auth, existing.id)
  } else {
    db.prepare(
      `INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      crypto.randomUUID(),
      user.id,
      sub.endpoint,
      sub.keys.p256dh,
      sub.keys.auth,
      new Date().toISOString(),
    )
  }
  res.json({ ok: true })
})

app.delete('/api/push/subscribe', authMiddleware, (req, res) => {
  const user = (req as express.Request & { user: AuthUser }).user
  const endpoint = String(req.body?.endpoint || '')
  if (endpoint) {
    db.prepare(`DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?`).run(
      user.id,
      endpoint,
    )
  } else {
    db.prepare(`DELETE FROM push_subscriptions WHERE user_id = ?`).run(user.id)
  }
  res.json({ ok: true })
})

function hydrateExtraTask(row: Record<string, unknown>, viewerId?: string) {
  const id = String(row.id)
  const signups = db
    .prepare(
      `SELECT s.*, u.name AS user_name FROM extra_task_signups s
       JOIN users u ON u.id = s.user_id
       WHERE s.extra_task_id = ?
       ORDER BY s.signed_up_at`,
    )
    .all(id)
    .map((s) => {
      const x = s as Record<string, unknown>
      return {
        id: x.id,
        userId: x.user_id,
        userName: x.user_name,
        signedUpAt: x.signed_up_at,
      }
    })
  const minRequired = Number(row.min_required)
  const signupCount = signups.length
  const creator = db.prepare('SELECT name FROM users WHERE id = ?').get(row.created_by_user_id) as
    | { name: string }
    | undefined
  return {
    id,
    title: row.title,
    description: row.description,
    minRequired,
    status: row.status,
    createdByUserId: row.created_by_user_id,
    createdByName: creator?.name ?? '',
    relatedPihavuoroId: row.related_pihavuoro_id,
    createdAt: row.created_at,
    startedAt: row.started_at,
    doneAt: row.done_at,
    signups,
    signupCount,
    spotsLeft: Math.max(0, minRequired - signupCount),
    iSignedUp: viewerId ? signups.some((s) => s.userId === viewerId) : false,
  }
}

function refreshExtraStatus(taskId: string) {
  const row = db.prepare('SELECT * FROM extra_tasks WHERE id = ?').get(taskId) as
    | Record<string, unknown>
    | undefined
  if (!row) return
  if (row.status !== 'open' && row.status !== 'ready') return
  const count = (
    db.prepare(`SELECT COUNT(*) AS c FROM extra_task_signups WHERE extra_task_id = ?`).get(taskId) as {
      c: number
    }
  ).c
  const next = count >= Number(row.min_required) ? 'ready' : 'open'
  if (next !== row.status) {
    db.prepare(`UPDATE extra_tasks SET status = ? WHERE id = ?`).run(next, taskId)
    if (next === 'ready') {
      notifyAllActive(
        'Apukutsu valmis aloitettavaksi',
        String(row.title),
        `/apukutsut`,
      )
    }
  }
}

app.get('/api/extra-tasks', authMiddleware, (req, res) => {
  const user = (req as express.Request & { user: AuthUser }).user
  const rows = db
    .prepare(`SELECT * FROM extra_tasks ORDER BY created_at DESC`)
    .all() as Record<string, unknown>[]
  res.json({
    tasks: rows.map((r) => hydrateExtraTask(r, user.id)),
    canCreate: canCreateExtra(user),
  })
})

app.post('/api/extra-tasks', authMiddleware, (req, res) => {
  const user = (req as express.Request & { user: AuthUser }).user
  if (!canCreateExtra(user)) {
    return res.status(403).json({ error: 'Vain ylläpitäjä tai viikon vastuuhenkilö voi luoda apukutsun' })
  }
  const title = String(req.body.title || '').trim()
  const description = String(req.body.description || '').trim()
  const minRequired = Math.max(1, Number(req.body.minRequired || 1))
  if (!title) return res.status(400).json({ error: 'Anna otsikko' })
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const weekStart = mondayOf()
  const current = db
    .prepare(`SELECT id FROM pihavuorot WHERE week_start = ? AND status = 'published'`)
    .get(weekStart) as { id: string } | undefined
  db.prepare(
    `INSERT INTO extra_tasks (id, created_by_user_id, title, description, min_required, status, related_pihavuoro_id, created_at)
     VALUES (?, ?, ?, ?, ?, 'open', ?, ?)`,
  ).run(id, user.id, title, description || null, minRequired, current?.id ?? null, now)
  notifyAllActive('Uusi apukutsu', title, '/apukutsut')
  const row = db.prepare('SELECT * FROM extra_tasks WHERE id = ?').get(id) as Record<string, unknown>
  res.status(201).json({ task: hydrateExtraTask(row, user.id) })
})

app.delete('/api/extra-tasks', authMiddleware, requireAdmin, (_req, res) => {
  db.prepare(`DELETE FROM extra_task_signups`).run()
  db.prepare(`DELETE FROM extra_tasks`).run()
  res.json({ ok: true })
})

app.post('/api/extra-tasks/:id/signup', authMiddleware, (req, res) => {
  const user = (req as express.Request & { user: AuthUser }).user
  const row = db.prepare('SELECT * FROM extra_tasks WHERE id = ?').get(req.params.id) as
    | Record<string, unknown>
    | undefined
  if (!row) return res.status(404).json({ error: 'Ei löydy' })
  if (row.status !== 'open' && row.status !== 'ready') {
    return res.status(400).json({ error: 'Tehtävään ei voi enää ilmoittautua' })
  }
  try {
    db.prepare(
      `INSERT INTO extra_task_signups (id, extra_task_id, user_id, signed_up_at) VALUES (?, ?, ?, ?)`,
    ).run(crypto.randomUUID(), req.params.id, user.id, new Date().toISOString())
  } catch {
    return res.status(400).json({ error: 'Olet jo ilmoittautunut' })
  }
  refreshExtraStatus(String(req.params.id))
  const updated = db.prepare('SELECT * FROM extra_tasks WHERE id = ?').get(req.params.id) as Record<
    string,
    unknown
  >
  res.json({ task: hydrateExtraTask(updated, user.id) })
})

app.delete('/api/extra-tasks/:id/signup', authMiddleware, (req, res) => {
  const user = (req as express.Request & { user: AuthUser }).user
  const row = db.prepare('SELECT * FROM extra_tasks WHERE id = ?').get(req.params.id) as
    | Record<string, unknown>
    | undefined
  if (!row) return res.status(404).json({ error: 'Ei löydy' })
  if (row.status === 'in_progress' || row.status === 'done' || row.status === 'cancelled') {
    return res.status(400).json({ error: 'Ilmoittautumista ei voi perua tässä tilassa' })
  }
  db.prepare(`DELETE FROM extra_task_signups WHERE extra_task_id = ? AND user_id = ?`).run(
    req.params.id,
    user.id,
  )
  refreshExtraStatus(String(req.params.id))
  const updated = db.prepare('SELECT * FROM extra_tasks WHERE id = ?').get(req.params.id) as Record<
    string,
    unknown
  >
  res.json({ task: hydrateExtraTask(updated, user.id) })
})

app.post('/api/extra-tasks/:id/start', authMiddleware, (req, res) => {
  const user = (req as express.Request & { user: AuthUser }).user
  const row = db.prepare('SELECT * FROM extra_tasks WHERE id = ?').get(req.params.id) as
    | Record<string, unknown>
    | undefined
  if (!row) return res.status(404).json({ error: 'Ei löydy' })
  if (row.status !== 'ready') return res.status(400).json({ error: 'Tehtävä ei ole vielä valmis aloitettavaksi' })
  if (user.role !== 'admin' && row.created_by_user_id !== user.id) {
    return res.status(403).json({ error: 'Vain perustaja tai admin voi aloittaa' })
  }
  db.prepare(`UPDATE extra_tasks SET status='in_progress', started_at=? WHERE id=?`).run(
    new Date().toISOString(),
    req.params.id,
  )
  const updated = db.prepare('SELECT * FROM extra_tasks WHERE id = ?').get(req.params.id) as Record<
    string,
    unknown
  >
  res.json({ task: hydrateExtraTask(updated, user.id) })
})

app.post('/api/extra-tasks/:id/complete', authMiddleware, (req, res) => {
  const user = (req as express.Request & { user: AuthUser }).user
  const row = db.prepare('SELECT * FROM extra_tasks WHERE id = ?').get(req.params.id) as
    | Record<string, unknown>
    | undefined
  if (!row) return res.status(404).json({ error: 'Ei löydy' })
  if (row.status !== 'in_progress' && row.status !== 'ready') {
    return res.status(400).json({ error: 'Tehtävää ei voi merkitä valmiiksi' })
  }
  const signed = db
    .prepare(`SELECT id FROM extra_task_signups WHERE extra_task_id = ? AND user_id = ?`)
    .get(req.params.id, user.id)
  if (user.role !== 'admin' && row.created_by_user_id !== user.id && !signed) {
    return res.status(403).json({ error: 'Ei oikeutta' })
  }
  db.prepare(`UPDATE extra_tasks SET status='done', done_at=? WHERE id=?`).run(
    new Date().toISOString(),
    req.params.id,
  )
  const updated = db.prepare('SELECT * FROM extra_tasks WHERE id = ?').get(req.params.id) as Record<
    string,
    unknown
  >
  res.json({ task: hydrateExtraTask(updated, user.id) })
})

app.post('/api/extra-tasks/:id/cancel', authMiddleware, (req, res) => {
  const user = (req as express.Request & { user: AuthUser }).user
  const row = db.prepare('SELECT * FROM extra_tasks WHERE id = ?').get(req.params.id) as
    | Record<string, unknown>
    | undefined
  if (!row) return res.status(404).json({ error: 'Ei löydy' })
  if (user.role !== 'admin' && row.created_by_user_id !== user.id) {
    return res.status(403).json({ error: 'Ei oikeutta' })
  }
  if (row.status === 'done') return res.status(400).json({ error: 'Valmista tehtävää ei voi peruuttaa' })
  db.prepare(`UPDATE extra_tasks SET status='cancelled' WHERE id=?`).run(req.params.id)
  const updated = db.prepare('SELECT * FROM extra_tasks WHERE id = ?').get(req.params.id) as Record<
    string,
    unknown
  >
  res.json({ task: hydrateExtraTask(updated, user.id) })
})

// ——— Hub inspections (huoltokorttien tehtävät) ———
app.get('/api/hub', authMiddleware, (req, res) => {
  const user = (req as express.Request & { user: AuthUser }).user
  const year = Number(req.query.year) || undefined
  const activeOnly = String(req.query.activeOnly || '') === '1'
  if (user.role !== 'admin' && !activeOnly && !isOnCurrentWeekShift(user.id)) {
    return res.status(403).json({ error: 'Huoltokortit ovat ylläpitäjän hallinnassa' })
  }
  const all = listHubInspections(year)
  const inspections =
    user.role === 'admin' && !activeOnly
      ? all
      : all.filter((r) => r.activated && r.status !== 'done')
  res.json({
    summary: hubOpenSummary(year),
    inspections,
    canManage: user.role === 'admin',
  })
})

app.get('/api/hub/active', authMiddleware, (req, res) => {
  const user = (req as express.Request & { user: AuthUser }).user
  if (user.role !== 'admin' && !isOnCurrentWeekShift(user.id)) {
    return res.json({ inspections: [], canEdit: false })
  }
  const year = Number(req.query.year) || undefined
  res.json({
    inspections: listActivatedHubInspections(year),
    canEdit: user.role === 'admin' || isCurrentWeekLead(user.id),
  })
})

app.post('/api/hub/seed', authMiddleware, requireAdmin, (req, res) => {
  const year = Number(req.body?.year) || undefined
  res.json({ inspections: seedHubYear(year) })
})

app.get('/api/hub/:id', authMiddleware, (req, res) => {
  const user = (req as express.Request & { user: AuthUser }).user
  const insp = getHubInspection(String(req.params.id))
  if (!insp) return res.status(404).json({ error: 'Tarkastusta ei löydy' })
  if (!canViewHub(user, insp)) {
    return res.status(403).json({ error: 'Kortti ei ole aktivoitu viikkovuorolle' })
  }
  res.json({
    inspection: insp,
    canEdit: canEditHubTasks(user, insp),
    canManage: user.role === 'admin',
  })
})

app.post('/api/hub/:id/activate', authMiddleware, requireAdmin, (req, res) => {
  const user = (req as express.Request & { user: AuthUser }).user
  const insp = setHubActivated(String(req.params.id), true, user.id)
  if (!insp) return res.status(404).json({ error: 'Tarkastusta ei löydy' })

  const weekStart = mondayOf()
  const roster = db
    .prepare(
      `SELECT a.user_id AS id FROM assignments a
       JOIN pihavuorot p ON p.id = a.pihavuoro_id
       WHERE p.status = 'published' AND p.week_start = ?`,
    )
    .all(weekStart) as { id: string }[]
  if (roster.length) {
    notifyUsers(
      roster.map((r) => r.id),
      `Huoltokortti aktivoitu: ${insp.title}`,
      'Vastuuveli voi merkitä tarkastuskohdat tehdyiksi Pihavuorossa.',
      `/huolto/${insp.id}`,
      'hub',
    )
  }
  res.json({ inspection: insp })
})

app.post('/api/hub/:id/deactivate', authMiddleware, requireAdmin, (req, res) => {
  const insp = setHubActivated(String(req.params.id), false)
  if (!insp) return res.status(404).json({ error: 'Tarkastusta ei löydy' })
  res.json({ inspection: insp })
})

app.patch('/api/hub/:id/items/:itemId', authMiddleware, (req, res) => {
  const user = (req as express.Request & { user: AuthUser }).user
  const current = getHubInspection(String(req.params.id))
  if (!current) return res.status(404).json({ error: 'Tarkastusta ei löydy' })
  if (!canEditHubTasks(user, current)) {
    return res.status(403).json({ error: 'Vain ylläpitäjä tai viikon vastuuveli (aktivoitu kortti)' })
  }
  const status = req.body?.status as 'open' | 'ok' | 'issue' | undefined
  const note = req.body?.note as string | null | undefined
  if (status && !['open', 'ok', 'issue'].includes(status)) {
    return res.status(400).json({ error: 'Virheellinen tila' })
  }
  const insp = updateHubItem(String(req.params.id), String(req.params.itemId), { status, note })
  if (!insp) return res.status(404).json({ error: 'Kohtaa ei löydy' })

  if (status === 'issue') {
    const admins = db
      .prepare(`SELECT id FROM users WHERE role = 'admin' AND active = 1`)
      .all() as { id: string }[]
    notifyUsers(
      admins.map((a) => a.id),
      `Huoltokortti: huomio — ${insp.title}`,
      note?.trim() || 'Tarkastuksessa merkitty puute',
      `/huolto/${insp.id}`,
      'hub',
    )
  }

  res.json({ inspection: insp })
})

app.patch('/api/hub/:id', authMiddleware, (req, res) => {
  const user = (req as express.Request & { user: AuthUser }).user
  const current = getHubInspection(String(req.params.id))
  if (!current) return res.status(404).json({ error: 'Tarkastusta ei löydy' })
  if (!canEditHubTasks(user, current)) {
    return res.status(403).json({ error: 'Vain ylläpitäjä tai viikon vastuuveli (aktivoitu kortti)' })
  }
  const notes = req.body?.notes as string | null | undefined
  const status = req.body?.status as 'open' | 'in_progress' | 'done' | undefined
  if (status && !['open', 'in_progress', 'done'].includes(status)) {
    return res.status(400).json({ error: 'Virheellinen tila' })
  }
  const insp = updateHubInspection(String(req.params.id), {
    notes,
    status,
    completedByUserId: status === 'done' ? user.id : undefined,
  })
  if (!insp) return res.status(404).json({ error: 'Tarkastusta ei löydy' })
  res.json({ inspection: insp })
})

app.post('/api/hub/:id/photo', authMiddleware, upload.single('photo'), (req, res) => {
  const user = (req as express.Request & { user: AuthUser }).user
  const current = getHubInspection(String(req.params.id))
  if (!current) return res.status(404).json({ error: 'Tarkastusta ei löydy' })
  if (!canEditHubTasks(user, current)) {
    return res.status(403).json({ error: 'Vain ylläpitäjä tai viikon vastuuveli (aktivoitu kortti)' })
  }
  if (!req.file) return res.status(400).json({ error: 'Kuva puuttuu' })
  const insp = updateHubInspection(String(req.params.id), { photoPath: req.file.filename })
  if (!insp) return res.status(404).json({ error: 'Tarkastusta ei löydy' })
  res.json({ inspection: insp })
})

// Production static — hashed assets long-cache; SW/HTML always revalidate (PWA updates)
const dist = path.join(root, 'dist')
if (fs.existsSync(dist)) {
  app.use(
    express.static(dist, {
      setHeaders(res, filePath) {
        const base = path.basename(filePath)
        if (
          base === 'sw.js' ||
          base === 'index.html' ||
          base === 'manifest.webmanifest' ||
          base.endsWith('.webmanifest')
        ) {
          res.setHeader('Cache-Control', 'no-cache')
          return
        }
        if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
        }
      },
    }),
  )
  app.get(/^(?!\/api\/).*/, (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache')
    res.sendFile(path.join(dist, 'index.html'))
  })
}

app.listen(PORT, () => {
  console.log(`Siisti salin piha API http://localhost:${PORT}`)
  startWeatherAlertScheduler()
})
