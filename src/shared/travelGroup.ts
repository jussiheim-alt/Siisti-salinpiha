/** Normalize free-text travel/family group label. Empty → null. */
export function normalizeTravelGroup(raw: unknown): string | null {
  if (raw == null) return null
  const s = String(raw).trim().replace(/\s+/g, ' ')
  return s.length ? s.slice(0, 80) : null
}

/** Case-insensitive key for grouping (Finnish locale). */
export function travelGroupKey(group: string | null | undefined): string | null {
  if (!group) return null
  const n = normalizeTravelGroup(group)
  return n ? n.toLocaleLowerCase('fi') : null
}

/** Viikkovuoro: 1 vastuuveli + 1–5 avustajaa (yhteensä 2–6). */
export const MIN_HELPERS = 1
export const MAX_HELPERS = 5
export const MIN_TOTAL_PEOPLE = MIN_HELPERS + 1
export const MAX_TOTAL_PEOPLE = MAX_HELPERS + 1
export const DEFAULT_TOTAL_PEOPLE = 5

export function clampHelperCount(n: number): number {
  if (!Number.isFinite(n)) return Math.min(MAX_HELPERS, Math.max(MIN_HELPERS, 4))
  return Math.min(MAX_HELPERS, Math.max(MIN_HELPERS, Math.floor(n)))
}

export function clampTotalPeople(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_TOTAL_PEOPLE
  return Math.min(MAX_TOTAL_PEOPLE, Math.max(MIN_TOTAL_PEOPLE, Math.floor(n)))
}

/** Resolve helper count from totalPeople and/or helperCount body/query fields. */
export function resolveHelperCount(opts: {
  totalPeople?: unknown
  helperCount?: unknown
  fallbackHelpers?: number
}): number {
  if (opts.totalPeople != null && opts.totalPeople !== '') {
    const total = Number(opts.totalPeople)
    if (Number.isFinite(total)) return clampHelperCount(clampTotalPeople(total) - 1)
  }
  if (opts.helperCount != null && opts.helperCount !== '') {
    return clampHelperCount(Number(opts.helperCount))
  }
  return clampHelperCount(opts.fallbackHelpers ?? 4)
}

export type RankedPerson = {
  id: string
  name: string
  constraints: string[]
  travelGroup?: string | null
  last?: string | null
}

/**
 * Pick 1 lead + N helpers from fairness-ranked users.
 * Same travelGroup (matkaseura / perhe) stays on the same week when possible.
 */
export function pickLeadAndHelpers<T extends RankedPerson>(
  ranked: T[],
  helperCount: number,
): { lead: T | null; helpers: T[] } {
  const take = clampHelperCount(helperCount)
  const lead = ranked.find((u) => !u.constraints.includes('no_lead')) || null
  if (!lead) return { lead: null, helpers: [] }

  const used = new Set<string>([lead.id])
  const helpers: T[] = []

  const matesOf = (seed: T): T[] => {
    const key = travelGroupKey(seed.travelGroup)
    if (!key) {
      return used.has(seed.id) || seed.id === lead.id ? [] : [seed]
    }
    return ranked.filter(
      (u) =>
        u.id !== lead.id &&
        !used.has(u.id) &&
        travelGroupKey(u.travelGroup) === key,
    )
  }

  const absorb = (seed: T, slots: number) => {
    if (slots <= 0) return
    for (const mate of matesOf(seed).slice(0, slots)) {
      helpers.push(mate)
      used.add(mate.id)
    }
  }

  // Lead's household first, then fill by fairness order (pulling whole groups).
  absorb(lead, take)
  for (const u of ranked) {
    if (helpers.length >= take) break
    if (u.id === lead.id || used.has(u.id)) continue
    absorb(u, take - helpers.length)
  }

  return { lead, helpers }
}
