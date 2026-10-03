import { TASK_CATALOG_V1 } from './catalog.ts'

export type SeasonKey = 'kevat' | 'kesa' | 'syksy' | 'talvi'
export type TaskCadence = 'weekly' | 'biweekly' | 'triweekly' | 'monthly' | 'yearly'

export const SEASON_KEYS: SeasonKey[] = ['kevat', 'kesa', 'syksy', 'talvi']
export const CADENCE_KEYS: TaskCadence[] = [
  'weekly',
  'biweekly',
  'triweekly',
  'monthly',
  'yearly',
]

export type TaskCard = {
  id: string
  title: string
  instructions: string
  effort: 'light' | 'heavy'
  season: SeasonKey
  cadence: TaskCadence
  defaultAssignee: 'lead' | 'helpers' | 'all'
  active: boolean
  sortOrder: number
}

export function isSeasonKey(value: unknown): value is SeasonKey {
  return typeof value === 'string' && (SEASON_KEYS as string[]).includes(value)
}

export function isCadenceKey(value: unknown): value is TaskCadence {
  return typeof value === 'string' && (CADENCE_KEYS as string[]).includes(value)
}

/** Legacy catalog seasons → new keys */
export function mapLegacySeason(season: string): SeasonKey | 'all' {
  if (season === 'talvi') return 'talvi'
  if (season === 'sulankausi') return 'kesa'
  if (season === 'kevat' || season === 'kesa' || season === 'syksy') return season
  if (season === 'all') return 'all'
  return 'kesa'
}

/** Seed task cards from the locked catalog; sulankausi → kesä, lehtityöt → syksy. */
export function seedTaskCardsFromCatalog(): TaskCard[] {
  return TASK_CATALOG_V1.map((t) => {
    let season = mapLegacySeason(t.season)
    if (season === 'all') season = 'kesa'
    if (t.id === 'K2') season = 'syksy'
    if (t.id === 'K3' || t.id === 'K4') season = 'kevat'
    return {
      id: t.id,
      title: t.title,
      instructions: t.instructions,
      effort: t.effort,
      season,
      cadence: 'weekly' as TaskCadence,
      defaultAssignee: t.defaultAssignee,
      active: true,
      sortOrder: t.sortOrder,
    }
  })
}

export function publicTaskCard(row: Record<string, unknown>): TaskCard {
  return {
    id: String(row.id),
    title: String(row.title),
    instructions: String(row.instructions ?? ''),
    effort: row.effort === 'heavy' ? 'heavy' : 'light',
    season: isSeasonKey(row.season) ? row.season : 'kesa',
    cadence: isCadenceKey(row.cadence) ? row.cadence : 'weekly',
    defaultAssignee:
      row.default_assignee === 'lead' || row.default_assignee === 'all'
        ? row.default_assignee
        : 'helpers',
    active: Boolean(row.active),
    sortOrder: Number(row.sort_order ?? 0),
  }
}
