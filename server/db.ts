import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import { TASK_CATALOG_V1 } from './catalog.ts'
import { ensureFoundingAdmins } from './foundingAdmins.ts'
import { dataDir } from './paths.ts'
import { seedTaskCardsFromCatalog, type TaskCard } from './taskCards.ts'
import { seasonForWeekStart } from '../src/shared/seasons.ts'

export const dbPath = path.join(dataDir, 'siisti-piha.sqlite')

function openDatabase() {
  const instance = new Database(dbPath)
  instance.pragma('journal_mode = WAL')
  instance.pragma('foreign_keys = ON')
  return instance
}

let dbInstance = openDatabase()

/** Stable export: always forwards to the current open connection (supports restore). */
export const db = new Proxy({} as Database.Database, {
  get(_target, prop, _receiver) {
    const value = Reflect.get(dbInstance, prop, dbInstance) as unknown
    if (typeof value === 'function') {
      return (value as (...args: unknown[]) => unknown).bind(dbInstance)
    }
    return value
  },
  set(_target, prop, value) {
    Reflect.set(dbInstance, prop, value)
    return true
  },
})

/** Replace live SQLite file from a validated backup copy, then reopen. */
export function replaceDatabaseFromFile(sourceSqlitePath: string) {
  if (!fs.existsSync(sourceSqlitePath)) {
    throw new Error('Varmuuskopion tietokantaa ei löydy')
  }
  dbInstance.close()
  fs.copyFileSync(sourceSqlitePath, dbPath)
  for (const suffix of ['-wal', '-shm']) {
    try {
      fs.rmSync(dbPath + suffix, { force: true })
    } catch {
      /* ignore */
    }
  }
  dbInstance = openDatabase()
}

/** Upgrade legacy talvi/sulankausi → kevät/kesä/syksy/talvi (recomputed from week_start). */
function migratePihavuoroSeasons() {
  const row = db
    .prepare(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'pihavuorot'`)
    .get() as { sql?: string } | undefined
  const sql = row?.sql || ''
  if (!sql || sql.includes("'kevat'")) return

  const existing = db.prepare(`SELECT * FROM pihavuorot`).all() as Record<string, unknown>[]
  db.pragma('foreign_keys = OFF')
  db.exec(`
    CREATE TABLE pihavuorot_v2 (
      id TEXT PRIMARY KEY,
      week_start TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL CHECK(status IN ('draft','published','done')),
      season TEXT NOT NULL CHECK(season IN ('kevat','kesa','syksy','talvi')),
      notes TEXT,
      created_at TEXT NOT NULL
    );
  `)
  const insert = db.prepare(
    `INSERT INTO pihavuorot_v2 (id, week_start, status, season, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
  for (const p of existing) {
    const weekStart = String(p.week_start)
    insert.run(
      String(p.id),
      weekStart,
      String(p.status),
      seasonForWeekStart(weekStart),
      p.notes ?? null,
      String(p.created_at),
    )
  }
  db.exec(`DROP TABLE pihavuorot`)
  db.exec(`ALTER TABLE pihavuorot_v2 RENAME TO pihavuorot`)
  db.pragma('foreign_keys = ON')
}

export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin','member')),
      active INTEGER NOT NULL DEFAULT 1,
      constraints_json TEXT NOT NULL DEFAULT '[]',
      constraint_note TEXT,
      snooze_until TEXT,
      travel_group TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS pihavuorot (
      id TEXT PRIMARY KEY,
      week_start TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL CHECK(status IN ('draft','published','done')),
      season TEXT NOT NULL CHECK(season IN ('kevat','kesa','syksy','talvi')),
      notes TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS assignments (
      id TEXT PRIMARY KEY,
      pihavuoro_id TEXT NOT NULL REFERENCES pihavuorot(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id),
      role TEXT NOT NULL CHECK(role IN ('lead','helper')),
      UNIQUE(pihavuoro_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS shift_tasks (
      id TEXT PRIMARY KEY,
      pihavuoro_id TEXT NOT NULL REFERENCES pihavuorot(id) ON DELETE CASCADE,
      template_id TEXT,
      title TEXT NOT NULL,
      instructions TEXT NOT NULL,
      effort TEXT NOT NULL CHECK(effort IN ('light','heavy')),
      assignee_user_id TEXT REFERENCES users(id),
      status TEXT NOT NULL CHECK(status IN ('open','done','skipped')),
      skip_reason TEXT,
      done_by_user_id TEXT REFERENCES users(id),
      done_at TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS notices (
      id TEXT PRIMARY KEY,
      author_user_id TEXT NOT NULL REFERENCES users(id),
      body TEXT NOT NULL,
      photo_path TEXT,
      status TEXT NOT NULL CHECK(status IN ('open','in_progress','resolved')),
      created_at TEXT NOT NULL,
      resolved_at TEXT
    );

    CREATE TABLE IF NOT EXISTS notice_replies (
      id TEXT PRIMARY KEY,
      notice_id TEXT NOT NULL REFERENCES notices(id) ON DELETE CASCADE,
      author_user_id TEXT NOT NULL REFERENCES users(id),
      body TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS extra_tasks (
      id TEXT PRIMARY KEY,
      created_by_user_id TEXT NOT NULL REFERENCES users(id),
      title TEXT NOT NULL,
      description TEXT,
      min_required INTEGER NOT NULL CHECK(min_required >= 1),
      status TEXT NOT NULL CHECK(status IN ('open','ready','in_progress','done','cancelled')),
      related_pihavuoro_id TEXT REFERENCES pihavuorot(id),
      created_at TEXT NOT NULL,
      started_at TEXT,
      done_at TEXT
    );

    CREATE TABLE IF NOT EXISTS extra_task_signups (
      id TEXT PRIMARY KEY,
      extra_task_id TEXT NOT NULL REFERENCES extra_tasks(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id),
      signed_up_at TEXT NOT NULL,
      UNIQUE(extra_task_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      link TEXT,
      read_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      endpoint TEXT NOT NULL UNIQUE,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS weather_alert_log (
      id TEXT PRIMARY KEY,
      alert_key TEXT NOT NULL,
      day TEXT NOT NULL,
      pihavuoro_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(alert_key, day, pihavuoro_id)
    );

    CREATE TABLE IF NOT EXISTS hub_inspections (
      id TEXT PRIMARY KEY,
      template_id TEXT NOT NULL,
      year INTEGER NOT NULL,
      title TEXT NOT NULL,
      cadence_label TEXT NOT NULL,
      window_start TEXT NOT NULL,
      window_end TEXT NOT NULL,
      intro TEXT,
      status TEXT NOT NULL CHECK(status IN ('open','in_progress','done')),
      notes TEXT,
      photo_path TEXT,
      completed_by_user_id TEXT REFERENCES users(id),
      completed_at TEXT,
      created_at TEXT NOT NULL,
      UNIQUE(template_id, year)
    );

    CREATE TABLE IF NOT EXISTS hub_inspection_items (
      id TEXT PRIMARY KEY,
      inspection_id TEXT NOT NULL REFERENCES hub_inspections(id) ON DELETE CASCADE,
      template_item_id TEXT NOT NULL,
      label TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL CHECK(status IN ('open','ok','issue')) DEFAULT 'open',
      note TEXT
    );

    CREATE TABLE IF NOT EXISTS week_blocks (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      week_start TEXT NOT NULL,
      note TEXT,
      created_at TEXT NOT NULL,
      UNIQUE(user_id, week_start)
    );

    CREATE TABLE IF NOT EXISTS swap_offers (
      id TEXT PRIMARY KEY,
      pihavuoro_id TEXT NOT NULL REFERENCES pihavuorot(id) ON DELETE CASCADE,
      from_user_id TEXT NOT NULL REFERENCES users(id),
      to_user_id TEXT REFERENCES users(id),
      role TEXT NOT NULL CHECK(role IN ('lead','helper')),
      message TEXT,
      status TEXT NOT NULL CHECK(status IN ('open','accepted','cancelled')) DEFAULT 'open',
      created_at TEXT NOT NULL,
      resolved_at TEXT,
      accepted_by_user_id TEXT REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS shift_messages (
      id TEXT PRIMARY KEY,
      pihavuoro_id TEXT NOT NULL REFERENCES pihavuorot(id) ON DELETE CASCADE,
      author_user_id TEXT NOT NULL REFERENCES users(id),
      body TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS invites (
      id TEXT PRIMARY KEY,
      token TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin','member')),
      constraints_json TEXT NOT NULL DEFAULT '[]',
      travel_group TEXT,
      created_by_user_id TEXT REFERENCES users(id),
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      accepted_at TEXT,
      revoked_at TEXT
    );

    CREATE TABLE IF NOT EXISTS task_cards (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      instructions TEXT NOT NULL DEFAULT '',
      effort TEXT NOT NULL CHECK(effort IN ('light','heavy')) DEFAULT 'light',
      season TEXT NOT NULL CHECK(season IN ('kevat','kesa','syksy','talvi')),
      cadence TEXT NOT NULL CHECK(cadence IN ('weekly','biweekly','triweekly','monthly','yearly')),
      default_assignee TEXT NOT NULL CHECK(default_assignee IN ('lead','helpers','all')),
      active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0
    );
  `)

  migratePihavuoroSeasons()

  const notifCols = db.prepare(`PRAGMA table_info(notifications)`).all() as { name: string }[]
  if (!notifCols.some((c) => c.name === 'kind')) {
    db.exec(`ALTER TABLE notifications ADD COLUMN kind TEXT NOT NULL DEFAULT 'general'`)
  }
  // Chat-viestit eivät kuulu Ilmo-listaan (FAB-merkki + lukitusnäytön push)
  db.prepare(`DELETE FROM notifications WHERE kind = 'chat'`).run()

  const noticeCols = db.prepare(`PRAGMA table_info(notices)`).all() as { name: string }[]
  if (!noticeCols.some((c) => c.name === 'audience')) {
    db.exec(`ALTER TABLE notices ADD COLUMN audience TEXT NOT NULL DEFAULT 'all'`)
  }
  if (!noticeCols.some((c) => c.name === 'acknowledged_at')) {
    db.exec(`ALTER TABLE notices ADD COLUMN acknowledged_at TEXT`)
  }
  if (!noticeCols.some((c) => c.name === 'acknowledged_by_user_id')) {
    db.exec(`ALTER TABLE notices ADD COLUMN acknowledged_by_user_id TEXT`)
  }

  const hubCols = db.prepare(`PRAGMA table_info(hub_inspections)`).all() as { name: string }[]
  if (!hubCols.some((c) => c.name === 'activated_at')) {
    db.exec(`ALTER TABLE hub_inspections ADD COLUMN activated_at TEXT`)
  }
  if (!hubCols.some((c) => c.name === 'activated_by_user_id')) {
    db.exec(`ALTER TABLE hub_inspections ADD COLUMN activated_by_user_id TEXT`)
  }

  const userCols = db.prepare(`PRAGMA table_info(users)`).all() as { name: string }[]
  if (!userCols.some((c) => c.name === 'travel_group')) {
    db.exec(`ALTER TABLE users ADD COLUMN travel_group TEXT`)
  }
  if (!userCols.some((c) => c.name === 'sparse_rotation')) {
    db.exec(`ALTER TABLE users ADD COLUMN sparse_rotation INTEGER NOT NULL DEFAULT 0`)
  }
  if (!userCols.some((c) => c.name === 'privacy_accepted_version')) {
    db.exec(`ALTER TABLE users ADD COLUMN privacy_accepted_version TEXT`)
  }
  if (!userCols.some((c) => c.name === 'privacy_accepted_at')) {
    db.exec(`ALTER TABLE users ADD COLUMN privacy_accepted_at TEXT`)
  }

  const inviteCols = db.prepare(`PRAGMA table_info(invites)`).all() as { name: string }[]
  if (!inviteCols.some((c) => c.name === 'travel_group')) {
    db.exec(`ALTER TABLE invites ADD COLUMN travel_group TEXT`)
  }

  seedTaskCards()
  // Vastuuveli-ohjeet eivät ole tehtäväkortti — poista vanha T5-kortti jos löytyy.
  db.prepare(
    `DELETE FROM task_cards WHERE id = 'T5' OR title LIKE 'Vastuuveli: viikon tilanne%'`,
  ).run()
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `)

  ensureFoundingAdmins(db)

  const userCount = db.prepare('SELECT COUNT(*) AS c FROM users').get() as { c: number }
  if (userCount.c === 0) {
    console.warn(
      'Tietokanta tyhjä — aseta ADMIN_PASSWORD (ja tarvittaessa JONI_EMAIL + JONI_PASSWORD)',
    )
  }
}

/** First boot: fill the admin-editable task cards from the locked catalog. */
function seedTaskCards() {
  const count = (db.prepare('SELECT COUNT(*) AS c FROM task_cards').get() as { c: number }).c
  if (count > 0) return
  const insert = db.prepare(
    `INSERT INTO task_cards (id, title, instructions, effort, season, cadence, default_assignee, active, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
  )
  const seed = db.transaction((cards: TaskCard[]) => {
    for (const c of cards) {
      insert.run(
        c.id,
        c.title,
        c.instructions,
        c.effort,
        c.season,
        c.cadence,
        c.defaultAssignee,
        c.sortOrder,
      )
    }
  })
  seed(seedTaskCardsFromCatalog())
}

export function parseConstraints(json: string): string[] {
  try {
    const v = JSON.parse(json)
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

export function publicUser(row: Record<string, unknown>) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    active: Boolean(row.active),
    constraints: parseConstraints(String(row.constraints_json ?? '[]')),
    constraintNote: row.constraint_note ?? null,
    snoozeUntil: row.snooze_until ?? null,
    travelGroup: row.travel_group ? String(row.travel_group) : null,
    /** Käytä harvemmin — suositus noin joka toiseen kierrokseen */
    sparseRotation: Boolean(row.sparse_rotation),
    privacyAcceptedVersion: row.privacy_accepted_version
      ? String(row.privacy_accepted_version)
      : null,
    privacyAcceptedAt: row.privacy_accepted_at ? String(row.privacy_accepted_at) : null,
    createdAt: row.created_at,
  }
}

export { TASK_CATALOG_V1 }
