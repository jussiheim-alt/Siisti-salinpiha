/** Fairness helpers for Pihavuoro roster recommendations. */

export type FairnessPerson = {
  id: string
  name: string
  constraints: string[]
  travelGroup?: string | null
  last?: string | null
  shiftCount?: number
  sparseRotation?: boolean
}

/** Published weeks needed for one full pass through the active roster. */
export function rotationCycleWeeks(activeMemberCount: number, rosterSize: number): number {
  const roster = Math.max(1, Math.floor(rosterSize))
  const members = Math.max(1, Math.floor(activeMemberCount))
  return Math.max(1, Math.ceil(members / roster))
}

/**
 * Min published weeks between shifts for "harvemmin" (~every other rotation).
 * Roughly doubles the usual turn interval when the pool is large enough.
 */
export function sparseMinPublishedWeeks(activeMemberCount: number, rosterSize: number): number {
  return rotationCycleWeeks(activeMemberCount, rosterSize) * 2
}

/** Oldest last shift first, then fewer lifetime shifts, then name. */
export function compareFairness(a: FairnessPerson, b: FairnessPerson): number {
  if (!a.last && !b.last) {
    const ca = a.shiftCount ?? 0
    const cb = b.shiftCount ?? 0
    if (ca !== cb) return ca - cb
    return a.name.localeCompare(b.name, 'fi')
  }
  if (!a.last) return -1
  if (!b.last) return 1
  const lastCmp = a.last.localeCompare(b.last)
  if (lastCmp !== 0) return lastCmp
  const ca = a.shiftCount ?? 0
  const cb = b.shiftCount ?? 0
  if (ca !== cb) return ca - cb
  return a.name.localeCompare(b.name, 'fi')
}

export function shouldDeferSparse(
  person: { last?: string | null; sparseRotation?: boolean },
  publishedWeeksSinceLast: number,
  minPublishedWeeks: number,
): boolean {
  if (!person.sparseRotation || !person.last) return false
  return publishedWeeksSinceLast < minPublishedWeeks
}

export type RankForRosterOptions = {
  /** From sparseMinPublishedWeeks(activeCount, rosterSize). */
  sparseMinPublishedWeeks: number
}

/**
 * Prefer non-deferred people; if the pool is too small for the roster,
 * fold deferred sparse people back in (still fairness-sorted).
 */
export function rankForRoster<T extends FairnessPerson & { publishedWeeksSinceLast?: number }>(
  people: T[],
  needed: number,
  opts: RankForRosterOptions,
): { ranked: T[]; sparseDeferred: T[] } {
  const minGap = opts.sparseMinPublishedWeeks
  const deferred: T[] = []
  const ready: T[] = []
  for (const p of people) {
    if (shouldDeferSparse(p, p.publishedWeeksSinceLast ?? 0, minGap)) deferred.push(p)
    else ready.push(p)
  }
  ready.sort(compareFairness)
  deferred.sort(compareFairness)
  if (ready.length >= needed) {
    return { ranked: ready, sparseDeferred: deferred }
  }
  return { ranked: [...ready, ...deferred], sparseDeferred: [] }
}
