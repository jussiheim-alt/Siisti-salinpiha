export type SeasonKey = 'kevat' | 'kesa' | 'syksy' | 'talvi'

export const SEASON_LABELS: Record<SeasonKey, string> = {
  kevat: 'Kevät',
  kesa: 'Kesä',
  syksy: 'Syksy',
  talvi: 'Talvi',
}

export const SEASON_ORDER: SeasonKey[] = ['kevat', 'kesa', 'syksy', 'talvi']

/** Legacy catalog seasons → new keys */
export function mapLegacySeason(season: string): SeasonKey | 'all' {
  if (season === 'talvi') return 'talvi'
  if (season === 'sulankausi') return 'kesa'
  if (season === 'kevat' || season === 'kesa' || season === 'syksy') return season
  if (season === 'all') return 'all'
  return 'kesa'
}

export function seasonForWeekStart(weekStart: string): SeasonKey {
  const m = new Date(`${weekStart}T12:00:00`).getMonth() + 1
  if (m >= 3 && m <= 5) return 'kevat'
  if (m >= 6 && m <= 8) return 'kesa'
  if (m >= 9 && m <= 11) return 'syksy'
  return 'talvi'
}

export type TaskCadence = 'weekly' | 'biweekly' | 'triweekly' | 'monthly' | 'yearly'

export const SEASON_KEYS: SeasonKey[] = ['kevat', 'kesa', 'syksy', 'talvi']
export const CADENCE_KEYS: TaskCadence[] = [
  'weekly',
  'biweekly',
  'triweekly',
  'monthly',
  'yearly',
]

export function isSeasonKey(value: unknown): value is SeasonKey {
  return typeof value === 'string' && (SEASON_KEYS as string[]).includes(value)
}

export function isCadenceKey(value: unknown): value is TaskCadence {
  return typeof value === 'string' && (CADENCE_KEYS as string[]).includes(value)
}

export const CADENCE_LABELS: Record<TaskCadence, string> = {
  weekly: 'Viikoittain',
  biweekly: '2 viikon välein',
  triweekly: '3 viikon välein',
  monthly: 'Kuukausittain',
  yearly: 'Kerran vuodessa',
}

/** Week index within season year (0-based Mondays from season start-ish). */
export function weekIndexInYear(weekStart: string): number {
  const d = new Date(`${weekStart}T12:00:00`)
  const start = new Date(Date.UTC(d.getFullYear(), 0, 1))
  const diff = Math.floor((d.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000))
  return Math.max(0, diff)
}

export function shouldIncludeByCadence(
  cadence: TaskCadence,
  weekStart: string,
  opts?: { yearlyDone?: boolean },
): boolean {
  if (cadence === 'yearly') return !opts?.yearlyDone
  if (cadence === 'weekly') return true
  const idx = weekIndexInYear(weekStart)
  if (cadence === 'biweekly') return idx % 2 === 0
  if (cadence === 'triweekly') return idx % 3 === 0
  if (cadence === 'monthly') {
    const day = new Date(`${weekStart}T12:00:00`).getDate()
    return day <= 7
  }
  return true
}
