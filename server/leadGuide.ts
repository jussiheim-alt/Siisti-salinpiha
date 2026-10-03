import { DEFAULT_LEAD_GUIDE, normalizeLeadGuide, type LeadGuide } from '../src/shared/leadGuide.ts'
import { db } from './db.ts'

export function ensureLeadGuideTable() {
  const row = db.prepare(`SELECT value FROM app_settings WHERE key = 'lead_guide'`).get() as
    | { value: string }
    | undefined
  if (!row) {
    db.prepare(`INSERT INTO app_settings (key, value) VALUES ('lead_guide', ?)`).run(
      JSON.stringify(DEFAULT_LEAD_GUIDE),
    )
  }
}

export function getLeadGuide(): LeadGuide {
  ensureLeadGuideTable()
  const row = db.prepare(`SELECT value FROM app_settings WHERE key = 'lead_guide'`).get() as
    | { value: string }
    | undefined
  if (!row) return structuredClone(DEFAULT_LEAD_GUIDE)
  try {
    return normalizeLeadGuide(JSON.parse(row.value))
  } catch {
    return structuredClone(DEFAULT_LEAD_GUIDE)
  }
}

export function saveLeadGuide(input: unknown): LeadGuide {
  ensureLeadGuideTable()
  const guide = normalizeLeadGuide(input)
  db.prepare(
    `INSERT INTO app_settings (key, value) VALUES ('lead_guide', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  ).run(JSON.stringify(guide))
  return guide
}
