import { db } from './db.ts'
import { HUB_CATALOG, HUB_ISSUE_PROTOCOL, type HubInspectionTemplate } from './hubCatalog.ts'

function helsinkiYear(d = new Date()) {
  return Number(
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Helsinki', year: 'numeric' }).format(d),
  )
}

function windowDates(year: number, tmpl: HubInspectionTemplate) {
  return {
    windowStart: `${year}-${tmpl.windowStartMd}`,
    windowEnd: `${year}-${tmpl.windowEndMd}`,
  }
}

export function seedHubYear(year = helsinkiYear()) {
  const now = new Date().toISOString()
  const insertInsp = db.prepare(
    `INSERT OR IGNORE INTO hub_inspections
      (id, template_id, year, title, cadence_label, window_start, window_end, intro, status, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', NULL, ?)`,
  )
  const insertItem = db.prepare(
    `INSERT INTO hub_inspection_items
      (id, inspection_id, template_item_id, label, sort_order, status)
     VALUES (?, ?, ?, ?, ?, 'open')`,
  )

  const tx = db.transaction(() => {
    for (const tmpl of HUB_CATALOG) {
      const existing = db
        .prepare(`SELECT id FROM hub_inspections WHERE template_id = ? AND year = ?`)
        .get(tmpl.id, year) as { id: string } | undefined
      if (existing) continue

      const id = crypto.randomUUID()
      const { windowStart, windowEnd } = windowDates(year, tmpl)
      insertInsp.run(
        id,
        tmpl.id,
        year,
        tmpl.title,
        tmpl.cadenceLabel,
        windowStart,
        windowEnd,
        tmpl.intro ?? null,
        now,
      )
      tmpl.items.forEach((item, idx) => {
        insertItem.run(crypto.randomUUID(), id, item.id, item.label, (idx + 1) * 10)
      })
    }
  })
  tx()
  return listHubInspections(year)
}

export function ensureHubYear(year = helsinkiYear()) {
  const count = (
    db.prepare(`SELECT COUNT(*) AS c FROM hub_inspections WHERE year = ?`).get(year) as {
      c: number
    }
  ).c
  if (count < HUB_CATALOG.length) seedHubYear(year)
}

function hydrateInspection(row: Record<string, unknown>) {
  const id = String(row.id)
  const items = (
    db
      .prepare(
        `SELECT * FROM hub_inspection_items WHERE inspection_id = ? ORDER BY sort_order, label`,
      )
      .all(id) as Record<string, unknown>[]
  ).map((r) => ({
    id: r.id,
    templateItemId: r.template_item_id,
    label: r.label,
    sortOrder: r.sort_order,
    status: r.status,
    note: r.note ?? null,
  }))

  const doneCount = items.filter((i) => i.status === 'ok' || i.status === 'issue').length
  const issueCount = items.filter((i) => i.status === 'issue').length

  let completedByName: string | null = null
  if (row.completed_by_user_id) {
    const u = db
      .prepare(`SELECT name FROM users WHERE id = ?`)
      .get(row.completed_by_user_id) as { name: string } | undefined
    completedByName = u?.name ?? null
  }

  return {
    id,
    templateId: row.template_id,
    year: row.year,
    title: row.title,
    cadenceLabel: row.cadence_label,
    windowStart: row.window_start,
    windowEnd: row.window_end,
    intro: row.intro ?? null,
    status: row.status,
    notes: row.notes ?? null,
    photoUrl: row.photo_path ? `/uploads/${row.photo_path}` : null,
    completedByUserId: row.completed_by_user_id ?? null,
    completedByName,
    completedAt: row.completed_at ?? null,
    createdAt: row.created_at,
    items,
    doneCount,
    issueCount,
    itemCount: items.length,
    protocol: HUB_ISSUE_PROTOCOL,
  }
}

export function listHubInspections(year = helsinkiYear()) {
  ensureHubYear(year)
  return (
    db
      .prepare(`SELECT * FROM hub_inspections WHERE year = ? ORDER BY window_start, title`)
      .all(year) as Record<string, unknown>[]
  ).map(hydrateInspection)
}

export function getHubInspection(id: string) {
  const row = db.prepare(`SELECT * FROM hub_inspections WHERE id = ?`).get(id) as
    | Record<string, unknown>
    | undefined
  return row ? hydrateInspection(row) : null
}

export function updateHubItem(
  inspectionId: string,
  itemId: string,
  patch: {
    status?: 'open' | 'ok' | 'issue'
    note?: string | null
    label?: string
    sortOrder?: number
  },
) {
  const item = db
    .prepare(`SELECT * FROM hub_inspection_items WHERE id = ? AND inspection_id = ?`)
    .get(itemId, inspectionId) as Record<string, unknown> | undefined
  if (!item) return null

  const status = patch.status ?? String(item.status)
  const note = patch.note !== undefined ? patch.note : (item.note as string | null)
  const label =
    patch.label !== undefined ? String(patch.label).trim() : String(item.label)
  if (!label) return null
  const sortOrder =
    patch.sortOrder !== undefined ? Number(patch.sortOrder) : Number(item.sort_order)

  db.prepare(
    `UPDATE hub_inspection_items SET status = ?, note = ?, label = ?, sort_order = ? WHERE id = ?`,
  ).run(status, note, label, sortOrder, itemId)

  const insp = db.prepare(`SELECT status FROM hub_inspections WHERE id = ?`).get(inspectionId) as {
    status: string
  }
  if (insp.status === 'open' && patch.status && patch.status !== 'open') {
    db.prepare(`UPDATE hub_inspections SET status = 'in_progress' WHERE id = ?`).run(inspectionId)
  }

  return getHubInspection(inspectionId)
}

export function addHubItem(inspectionId: string, label: string) {
  const insp = db.prepare(`SELECT id FROM hub_inspections WHERE id = ?`).get(inspectionId) as
    | { id: string }
    | undefined
  if (!insp) return null
  const text = label.trim()
  if (!text) return null

  const maxRow = db
    .prepare(
      `SELECT COALESCE(MAX(sort_order), 0) AS m FROM hub_inspection_items WHERE inspection_id = ?`,
    )
    .get(inspectionId) as { m: number }
  const id = crypto.randomUUID()
  db.prepare(
    `INSERT INTO hub_inspection_items
      (id, inspection_id, template_item_id, label, sort_order, status)
     VALUES (?, ?, ?, ?, ?, 'open')`,
  ).run(id, inspectionId, `custom-${id}`, text, Number(maxRow.m) + 10)

  return getHubInspection(inspectionId)
}

export function deleteHubItem(inspectionId: string, itemId: string) {
  const item = db
    .prepare(`SELECT id FROM hub_inspection_items WHERE id = ? AND inspection_id = ?`)
    .get(itemId, inspectionId) as { id: string } | undefined
  if (!item) return null
  db.prepare(`DELETE FROM hub_inspection_items WHERE id = ?`).run(itemId)
  return getHubInspection(inspectionId)
}

export function createHubInspection(input: {
  title: string
  cadenceLabel?: string
  windowStart: string
  windowEnd: string
  intro?: string | null
  year?: number
  items?: string[]
}) {
  const title = input.title.trim()
  if (!title) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.windowStart) || !/^\d{4}-\d{2}-\d{2}$/.test(input.windowEnd)) {
    return null
  }
  const year = input.year || Number(input.windowStart.slice(0, 4)) || helsinkiYear()
  const id = crypto.randomUUID()
  const templateId = `custom-${id}`
  const now = new Date().toISOString()
  const cadenceLabel = (input.cadenceLabel || 'Tarpeen mukaan').trim() || 'Tarpeen mukaan'
  const intro = input.intro?.trim() || null

  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO hub_inspections
        (id, template_id, year, title, cadence_label, window_start, window_end, intro, status, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', NULL, ?)`,
    ).run(id, templateId, year, title, cadenceLabel, input.windowStart, input.windowEnd, intro, now)

    const labels = (input.items || []).map((l) => l.trim()).filter(Boolean)
    labels.forEach((label, idx) => {
      const itemId = crypto.randomUUID()
      db.prepare(
        `INSERT INTO hub_inspection_items
          (id, inspection_id, template_item_id, label, sort_order, status)
         VALUES (?, ?, ?, ?, ?, 'open')`,
      ).run(itemId, id, `custom-${itemId}`, label, (idx + 1) * 10)
    })
  })
  tx()
  return getHubInspection(id)
}

export function deleteHubInspection(id: string) {
  const row = db.prepare(`SELECT id FROM hub_inspections WHERE id = ?`).get(id) as
    | { id: string }
    | undefined
  if (!row) return false
  db.prepare(`DELETE FROM hub_inspection_items WHERE inspection_id = ?`).run(id)
  db.prepare(`DELETE FROM hub_inspections WHERE id = ?`).run(id)
  return true
}

export function updateHubInspection(
  id: string,
  patch: {
    notes?: string | null
    photoPath?: string | null
    status?: 'open' | 'in_progress' | 'done'
    completedByUserId?: string | null
    title?: string
    cadenceLabel?: string
    windowStart?: string
    windowEnd?: string
    intro?: string | null
  },
) {
  const row = db.prepare(`SELECT * FROM hub_inspections WHERE id = ?`).get(id) as
    | Record<string, unknown>
    | undefined
  if (!row) return null

  const notes = patch.notes !== undefined ? patch.notes : row.notes
  const photoPath = patch.photoPath !== undefined ? patch.photoPath : row.photo_path
  const title =
    patch.title !== undefined ? String(patch.title).trim() || String(row.title) : String(row.title)
  const cadenceLabel =
    patch.cadenceLabel !== undefined
      ? String(patch.cadenceLabel).trim() || String(row.cadence_label)
      : String(row.cadence_label)
  const windowStart =
    patch.windowStart !== undefined ? String(patch.windowStart) : String(row.window_start)
  const windowEnd =
    patch.windowEnd !== undefined ? String(patch.windowEnd) : String(row.window_end)
  const intro = patch.intro !== undefined ? patch.intro : row.intro
  let status = patch.status ?? String(row.status)
  let completedBy = row.completed_by_user_id
  let completedAt = row.completed_at

  if (status === 'done') {
    completedBy = patch.completedByUserId ?? row.completed_by_user_id
    completedAt = new Date().toISOString()
  }
  if (status !== 'done' && patch.status) {
    completedBy = null
    completedAt = null
  }

  db.prepare(
    `UPDATE hub_inspections
     SET notes = ?, photo_path = ?, status = ?, completed_by_user_id = ?, completed_at = ?,
         title = ?, cadence_label = ?, window_start = ?, window_end = ?, intro = ?
     WHERE id = ?`,
  ).run(
    notes,
    photoPath,
    status,
    completedBy,
    completedAt,
    title,
    cadenceLabel,
    windowStart,
    windowEnd,
    intro,
    id,
  )

  return getHubInspection(id)
}

export function hubOpenSummary(year = helsinkiYear()) {
  ensureHubYear(year)
  const rows = listHubInspections(year)
  const open = rows.filter((r) => r.status !== 'done')
  const dueSoon = open.filter((r) => {
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Helsinki' }).format(
      new Date(),
    )
    return String(r.windowStart) <= today && String(r.windowEnd) >= today
  })
  return {
    year,
    openCount: open.length,
    dueCount: dueSoon.length,
    issueCount: open.reduce((sum, r) => sum + r.issueCount, 0),
  }
}
