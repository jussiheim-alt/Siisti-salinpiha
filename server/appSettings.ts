import {
  DEFAULT_APP_SETTINGS,
  normalizeAppSettings,
  type AppSettings,
} from '../src/shared/appSettings.ts'
import { db } from './db.ts'

const KEY = 'app_config'

export function ensureAppSettings() {
  const row = db.prepare(`SELECT value FROM app_settings WHERE key = ?`).get(KEY) as
    | { value: string }
    | undefined
  if (!row) {
    db.prepare(`INSERT INTO app_settings (key, value) VALUES (?, ?)`).run(
      KEY,
      JSON.stringify(DEFAULT_APP_SETTINGS),
    )
  }
}

export function getAppSettings(): AppSettings {
  ensureAppSettings()
  const row = db.prepare(`SELECT value FROM app_settings WHERE key = ?`).get(KEY) as
    | { value: string }
    | undefined
  if (!row) return { ...DEFAULT_APP_SETTINGS }
  try {
    return normalizeAppSettings(JSON.parse(row.value))
  } catch {
    return { ...DEFAULT_APP_SETTINGS }
  }
}

export function saveAppSettings(input: unknown): AppSettings {
  ensureAppSettings()
  const settings = normalizeAppSettings(input)
  db.prepare(
    `INSERT INTO app_settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  ).run(KEY, JSON.stringify(settings))
  return settings
}
