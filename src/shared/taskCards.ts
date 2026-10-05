import { TASK_CATALOG_V1 } from './catalog'
import {
  mapLegacySeason,
  type SeasonKey,
  type TaskCadence,
} from './seasons'

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

/** Legacy catalog has no "as needed" cadence; those tasks are checked weekly too. */
function mapCadence(_cadence: string): TaskCadence {
  return 'weekly'
}

/** Seed task cards from locked catalog; sulankausi → kesä, lehtityöt → syksy. */
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
      cadence: mapCadence(t.cadence as string),
      defaultAssignee: 'all' as const,
      active: true,
      sortOrder: t.sortOrder,
    }
  })
}
