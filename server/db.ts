import Database from 'better-sqlite3'
import bcrypt from 'bcryptjs'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { TASK_CATALOG_V1 } from './catalog.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const dataDir = path.join(root, 'data')
const dbPath = path.join(dataDir, 'siisti-piha.sqlite')

fs.mkdirSync(dataDir, { recursive: true })
fs.mkdirSync(path.join(root, 'uploads'), { recursive: true })

export const db = new Database(dbPath)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

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
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS pihavuorot (
      id TEXT PRIMARY KEY,
      week_start TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL CHECK(status IN ('draft','published','done')),
      season TEXT NOT NULL CHECK(season IN ('talvi','sulankausi')),
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
  `)

  const notifCols = db.prepare(`PRAGMA table_info(notifications)`).all() as { name: string }[]
  if (!notifCols.some((c) => c.name === 'kind')) {
    db.exec(`ALTER TABLE notifications ADD COLUMN kind TEXT NOT NULL DEFAULT 'general'`)
  }

  const userCount = db.prepare('SELECT COUNT(*) AS c FROM users').get() as { c: number }
  const allowDemoSeed =
    process.env.SEED_DEMO === '1' ||
    (process.env.SEED_DEMO !== '0' && process.env.NODE_ENV !== 'production')
  if (userCount.c === 0 && allowDemoSeed) {
    const now = new Date().toISOString()
    const hash = bcrypt.hashSync('admin123', 10)
    db.prepare(
      `INSERT INTO users (id, name, email, password_hash, role, active, constraints_json, created_at)
       VALUES (?, ?, ?, ?, 'admin', 1, '[]', ?)`,
    ).run(crypto.randomUUID(), 'Ylläpitäjä', 'admin@siistipiha.local', hash, now)

    const hash2 = bcrypt.hashSync('demo123', 10)
    const demos = [
      ['Aino Virtanen', 'aino@siistipiha.local', '[]'],
      ['Matti Korhonen', 'matti@siistipiha.local', '["no_heavy"]'],
      ['Liisa Nieminen', 'liisa@siistipiha.local', '[]'],
      ['Juhani Heikkilä', 'juhani@siistipiha.local', '["no_lead"]'],
      ['Sari Laine', 'sari@siistipiha.local', '[]'],
    ] as const
    for (const [name, email, constraints] of demos) {
      db.prepare(
        `INSERT INTO users (id, name, email, password_hash, role, active, constraints_json, created_at)
         VALUES (?, ?, ?, ?, 'member', 1, ?, ?)`,
      ).run(crypto.randomUUID(), name, email, hash2, constraints, now)
    }
    console.log('Seedattu: admin@siistipiha.local / admin123  sekä demo-käyttäjiä (demo123)')
  } else if (userCount.c === 0) {
    console.warn('Tietokanta tyhjä — luo ensimmäinen ylläpitäjä manuaalisesti (SEED_DEMO=1 kehityksessä)')
  }
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
    createdAt: row.created_at,
  }
}

export { TASK_CATALOG_V1 }
