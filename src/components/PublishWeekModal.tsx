import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { api, type TaskCard, type User } from '../api'
import { formatWeekRangeFi } from '../shared/datetime'
import { SEASON_LABELS, type SeasonKey } from '../shared/seasons'
import {
  DEFAULT_TOTAL_PEOPLE,
  MAX_TOTAL_PEOPLE,
  MIN_TOTAL_PEOPLE,
} from '../shared/travelGroup'

type RankedUser = User & {
  last?: string | null
  shiftCount?: number
  sparseRotation?: boolean
  publishedWeeksSinceLast?: number
}

type DraftTemplate = TaskCard & { selected?: boolean }

type WeekDraft = {
  weekStart: string
  weekEnd: string
  season: SeasonKey
  seasonLabel?: string
  lead: RankedUser | null
  helpers: RankedUser[]
  ranked: RankedUser[]
  sparseDeferred?: RankedUser[]
  blockedCount?: number
  availableCount?: number
  helperCount: number
  totalPeople: number
  templates: DraftTemplate[]
}

type Props = {
  open: boolean
  mode: 'publish' | 'draft'
  initialTotalPeople?: number
  onClose: () => void
  onCreated: (pihavuoroId: string) => void
}

export function PublishWeekModal({
  open,
  mode,
  initialTotalPeople = DEFAULT_TOTAL_PEOPLE,
  onClose,
  onCreated,
}: Props) {
  const [totalPeople, setTotalPeople] = useState(initialTotalPeople)
  const [draft, setDraft] = useState<WeekDraft | null>(null)
  const [leadId, setLeadId] = useState('')
  const [helperIds, setHelperIds] = useState<string[]>([])
  const [templateIds, setTemplateIds] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const sizeOptions = useMemo(
    () =>
      Array.from(
        { length: MAX_TOTAL_PEOPLE - MIN_TOTAL_PEOPLE + 1 },
        (_, i) => MIN_TOTAL_PEOPLE + i,
      ),
    [],
  )

  async function loadDraft(people: number) {
    setLoading(true)
    setError('')
    try {
      const data = await api<WeekDraft>(
        `/api/pihavuorot/meta/week-draft?totalPeople=${people}`,
      )
      setDraft(data)
      setLeadId(data.lead?.id || '')
      setHelperIds(data.helpers.map((h) => h.id).filter((id) => id !== data.lead?.id))
      setTemplateIds(data.templates.filter((t) => t.selected).map((t) => t.id))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Suosituksen lataus epäonnistui')
      setDraft(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!open) return
    setTotalPeople(initialTotalPeople)
    void loadDraft(initialTotalPeople)
  }, [open, initialTotalPeople])

  function toggleHelper(uid: string) {
    setHelperIds((prev) => {
      if (prev.includes(uid)) return prev.filter((x) => x !== uid)
      const maxHelpers = totalPeople - 1
      if (prev.length >= maxHelpers) return prev
      return [...prev, uid]
    })
  }

  function toggleTemplate(id: string) {
    setTemplateIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  async function submit() {
    if (!draft) return
    if (!leadId) {
      setError('Valitse vastuuhenkilö')
      return
    }
    if (helperIds.length < 1 || helperIds.length > 5) {
      setError('Valitse 1–5 avustajaa')
      return
    }
    if (helperIds.includes(leadId)) {
      setError('Vastuuhenkilö ei voi olla samalla avustaja')
      return
    }
    if (templateIds.length === 0) {
      setError('Valitse ainakin yksi huoltotehtävä')
      return
    }
    setSaving(true)
    setError('')
    try {
      const created = await api<{ pihavuoro: { id: string } }>('/api/pihavuorot', {
        method: 'POST',
        json: {
          weekStart: draft.weekStart,
          season: draft.season,
          recommend: false,
          leadUserId: leadId,
          helperUserIds: helperIds,
          templateIds,
          totalPeople,
        },
      })
      let id = created.pihavuoro.id
      if (mode === 'publish') {
        const pub = await api<{ pihavuoro: { id: string } }>(`/api/pihavuorot/${id}/publish`, {
          method: 'POST',
        })
        id = pub.pihavuoro.id
      }
      onCreated(id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Luonti epäonnistui')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  const candidates = draft?.ranked ?? []
  const deferred = draft?.sparseDeferred ?? []
  const seasonLabel = draft
    ? draft.seasonLabel || SEASON_LABELS[draft.season] || draft.season
    : ''

  return createPortal(
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose()
      }}
    >
      <div
        className="modal user-rights-modal publish-week-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="publish-week-title"
      >
        <header className="modal-head">
          <div>
            <h2 id="publish-week-title">
              {mode === 'publish' ? 'Luo ja julkaise viikko' : 'Luo luonnos'}
            </h2>
            <p className="muted" style={{ margin: '0.25rem 0 0' }}>
              {draft
                ? `${formatWeekRangeFi(draft.weekStart, draft.weekEnd)} · ${seasonLabel}`
                : 'Ladataan suositusta…'}
            </p>
          </div>
          <button className="btn ghost small" type="button" disabled={saving} onClick={onClose}>
            Sulje
          </button>
        </header>

        <div className="modal-scroll stack">
          {error && <p className="error">{error}</p>}
          {loading && !draft && <p className="muted">Haetaan suosituksia…</p>}

          {draft && (
            <>
              <label>
                Henkilöitä vuorolla
                <select
                  value={totalPeople}
                  disabled={loading || saving}
                  onChange={(e) => {
                    const n = Number(e.target.value)
                    setTotalPeople(n)
                    void loadDraft(n)
                  }}
                >
                  {sizeOptions.map((n) => (
                    <option key={n} value={n}>
                      {n} henkilöä (1 vastuuveli + {n - 1} avustajaa)
                    </option>
                  ))}
                </select>
              </label>

              {(draft.blockedCount || deferred.length > 0) && (
                <p className="hint">
                  {draft.blockedCount
                    ? `Esteviikko ohittaa ${draft.blockedCount} jäsentä. `
                    : ''}
                  {deferred.length > 0
                    ? `Harvemmin-käyttö siirtää tältä kierrokselta: ${deferred
                        .map((u) => u.name)
                        .join(', ')}.`
                    : ''}
                </p>
              )}

              <label>
                Vastuuveli (suositus)
                <select
                  value={leadId}
                  disabled={saving}
                  onChange={(e) => {
                    const next = e.target.value
                    setLeadId(next)
                    setHelperIds((prev) => prev.filter((id) => id !== next))
                  }}
                >
                  <option value="">— Valitse —</option>
                  {candidates.map((u) => (
                    <option key={u.id} value={u.id} disabled={u.constraints.includes('no_lead')}>
                      {u.name}
                      {u.sparseRotation ? ' · harvemmin' : ''}
                      {u.constraints.includes('no_lead') ? ' — ei vastuuhenkilöksi' : ''}
                    </option>
                  ))}
                </select>
              </label>

              <fieldset className="checks">
                <legend>Avustajat (suositus)</legend>
                <ul className="publish-pick-list">
                  {candidates
                    .filter((u) => u.id !== leadId)
                    .map((u) => {
                      const checked = helperIds.includes(u.id)
                      return (
                        <li key={u.id}>
                          <label className="check">
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={saving || (!checked && helperIds.length >= totalPeople - 1)}
                              onChange={() => toggleHelper(u.id)}
                            />
                            <span>
                              {u.name}
                              {u.sparseRotation ? (
                                <span className="muted"> · harvemmin</span>
                              ) : null}
                              {u.last ? (
                                <span className="muted">
                                  {' '}
                                  · viimeksi {u.last}
                                </span>
                              ) : (
                                <span className="muted"> · ei vielä vuoroa</span>
                              )}
                            </span>
                          </label>
                        </li>
                      )
                    })}
                </ul>
                <p className="hint">
                  Valittu {helperIds.length}/{totalPeople - 1}. Kierto suosii pisimpään ilman vuoroa
                  olleita.
                </p>
              </fieldset>

              <fieldset className="checks">
                <legend>Huoltotehtävät ({seasonLabel})</legend>
                <ul className="publish-pick-list">
                  {(draft.templates || []).map((t) => {
                    const checked = templateIds.includes(t.id)
                    return (
                      <li key={t.id}>
                        <label className="check">
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={saving}
                            onChange={() => toggleTemplate(t.id)}
                          />
                          <span>
                            {t.title}
                            <span className="muted">
                              {' '}
                              · {t.effort === 'heavy' ? 'raskas' : 'kevyt'}
                            </span>
                          </span>
                        </label>
                      </li>
                    )
                  })}
                </ul>
              </fieldset>
            </>
          )}
        </div>

        <div className="modal-actions">
          <div className="row-actions">
            <button
              className="btn primary"
              type="button"
              disabled={saving || loading || !draft}
              onClick={() => void submit()}
            >
              {saving
                ? mode === 'publish'
                  ? 'Julkaistaan…'
                  : 'Luodaan…'
                : mode === 'publish'
                  ? 'Julkaise'
                  : 'Luo luonnos'}
            </button>
            <button className="btn" type="button" disabled={saving} onClick={onClose}>
              Peruuta
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
