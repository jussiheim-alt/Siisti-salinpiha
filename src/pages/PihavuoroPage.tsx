import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  api,
  type HubInspection,
  type Pihavuoro,
  type SwapOffer,
  type TaskCard,
  type User,
} from '../api'
import { useAuth } from '../auth'
import { formatWeekRangeFi } from '../shared/datetime'
import { CADENCE_LABELS, SEASON_LABELS } from '../shared/seasons'

export function PihavuoroPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [p, setP] = useState<Pihavuoro | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [catalog, setCatalog] = useState<TaskCard[]>([])
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([])
  const [editingTasks, setEditingTasks] = useState(false)
  const [savingTasks, setSavingTasks] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [editingRoster, setEditingRoster] = useState(false)
  const [leadId, setLeadId] = useState('')
  const [helperIds, setHelperIds] = useState<string[]>([])
  const [savingRoster, setSavingRoster] = useState(false)
  const [swaps, setSwaps] = useState<SwapOffer[]>([])
  const [swapMessage, setSwapMessage] = useState('')
  const [swapTarget, setSwapTarget] = useState('')
  const [activeHub, setActiveHub] = useState<HubInspection[]>([])
  const [canEditHub, setCanEditHub] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function load() {
    const data = await api<{ pihavuoro: Pihavuoro }>(`/api/pihavuorot/${id}`)
    setP(data.pihavuoro)
    const lead = data.pihavuoro.assignments.find((a) => a.role === 'lead')
    setLeadId(lead?.userId || '')
    setHelperIds(
      data.pihavuoro.assignments.filter((a) => a.role === 'helper').map((a) => a.userId),
    )
    setSelectedTemplateIds(
      data.pihavuoro.tasks.map((t) => t.templateId).filter((x): x is string => Boolean(x)),
    )
  }

  async function loadSwaps() {
    if (!id) return
    const data = await api<{ swaps: SwapOffer[] }>(`/api/pihavuorot/${id}/swaps`)
    setSwaps(data.swaps)
  }

  async function loadActiveHub() {
    try {
      const data = await api<{ inspections: HubInspection[]; canEdit: boolean }>('/api/hub/active')
      setActiveHub(Array.isArray(data.inspections) ? data.inspections : [])
      setCanEditHub(Boolean(data.canEdit))
    } catch {
      setActiveHub([])
      setCanEditHub(false)
    }
  }

  useEffect(() => {
    if (!id) return
    load().catch((e) => setError(e.message))
  }, [id])

  useEffect(() => {
    if (!id || !p) return
    if (p.status === 'published' || p.status === 'done') {
      loadSwaps().catch(() => undefined)
    }
  }, [id, p?.status, p?.id])

  useEffect(() => {
    if (!p || p.status !== 'published') {
      setActiveHub([])
      return
    }
    const onRoster = p.assignments.some((a) => a.userId === user?.id) || user?.role === 'admin'
    if (!onRoster) {
      setActiveHub([])
      return
    }
    loadActiveHub().catch(() => undefined)
  }, [p?.id, p?.status, p?.assignments, user?.id, user?.role])

  useEffect(() => {
    if (user?.role !== 'admin') return
    api<{ users: User[] }>('/api/users')
      .then((d) => setUsers(d.users.filter((u) => u.active)))
      .catch(() => undefined)
    api<{ cards: TaskCard[] }>('/api/task-cards')
      .then((d) => setCatalog(Array.isArray(d.cards) ? d.cards.filter((c) => c.active) : []))
      .catch(() => undefined)
  }, [user?.role])

  useEffect(() => {
    if (!user) return
    if (user.role === 'admin') return
    api<{ users: { id: string; name: string }[] }>('/api/directory')
      .then((d) =>
        setUsers(
          d.users.map((u) => ({
            id: u.id,
            name: u.name,
            email: '',
            role: 'member',
            active: true,
            constraints: [],
          })),
        ),
      )
      .catch(() => undefined)
  }, [user?.id, user?.role])

  const myAssignment = p?.assignments.find((a) => a.userId === user?.id)
  const isLead = myAssignment?.role === 'lead'
  const isAdmin = user?.role === 'admin'
  const onShift = Boolean(myAssignment)
  const myOpenSwap = swaps.find((s) => s.fromUserId === user?.id && s.status === 'open')
  const claimableSwaps = swaps.filter(
    (s) =>
      s.status === 'open' &&
      s.fromUserId !== user?.id &&
      (!s.toUserId || s.toUserId === user?.id) &&
      !onShift,
  )

  const candidateUsers = useMemo(() => {
    return users.slice().sort((a, b) => a.name.localeCompare(b.name, 'fi'))
  }, [users])

  const swapCandidates = useMemo(() => {
    if (!p) return []
    const assigned = new Set(p.assignments.map((a) => a.userId))
    return candidateUsers.filter((u) => u.id !== user?.id && !assigned.has(u.id))
  }, [candidateUsers, p, user?.id])

  async function complete(taskId: string, status: 'done' | 'skipped') {
    setBusyId(taskId)
    setError('')
    try {
      const data = await api<{ pihavuoro: Pihavuoro }>(`/api/tasks/${taskId}/complete`, {
        method: 'POST',
        json: { status, skipReason: status === 'skipped' ? 'Ei tarvetta' : undefined },
      })
      setP(data.pihavuoro)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kuittaus epäonnistui')
    } finally {
      setBusyId(null)
    }
  }

  async function publish() {
    if (!id) return
    try {
      const data = await api<{ pihavuoro: Pihavuoro }>(`/api/pihavuorot/${id}/publish`, {
        method: 'POST',
      })
      setP(data.pihavuoro)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Julkaisu epäonnistui')
    }
  }

  async function deleteWeek() {
    if (!id || !p) return
    const label = formatWeekRangeFi(p.weekStart, p.weekEnd)
    if (
      !window.confirm(
        `Poistetaanko Pihavuoro ${label}? Kokoonpano, tehtävät ja vuorokeskustelu poistuvat. Tätä ei voi perua.`,
      )
    ) {
      return
    }
    if (!window.confirm('Vahvista poisto vielä kerran.')) return
    setDeleting(true)
    setError('')
    try {
      await api(`/api/pihavuorot/${id}`, { method: 'DELETE' })
      navigate('/kalenteri', { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Poisto epäonnistui')
      setDeleting(false)
    }
  }

  const seasonCatalog = useMemo(() => {
    if (!p) return []
    return catalog
      .filter((t) => t.season === p.season)
      .sort((a, b) => a.sortOrder - b.sortOrder)
  }, [catalog, p])

  function toggleTemplate(templateId: string) {
    setSelectedTemplateIds((prev) => {
      if (prev.includes(templateId)) return prev.filter((x) => x !== templateId)
      return [...prev, templateId]
    })
  }

  async function saveWeekTasks() {
    if (!id || !p) return
    if (selectedTemplateIds.length === 0) {
      setError('Valitse ainakin yksi huoltotehtävä')
      return
    }
    setSavingTasks(true)
    setError('')
    setInfo('')
    try {
      const data = await api<{ pihavuoro: Pihavuoro }>(`/api/pihavuorot/${id}/tasks`, {
        method: 'PUT',
        json: { templateIds: selectedTemplateIds },
      })
      setP(data.pihavuoro)
      setSelectedTemplateIds(
        data.pihavuoro.tasks.map((t) => t.templateId).filter((x): x is string => Boolean(x)),
      )
      setEditingTasks(false)
      setInfo('Viikon huoltotehtävät tallennettu.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Tehtävien tallennus epäonnistui')
    } finally {
      setSavingTasks(false)
    }
  }

  function toggleHelper(uid: string) {
    setHelperIds((prev) => {
      if (prev.includes(uid)) return prev.filter((x) => x !== uid)
      if (prev.length >= 5) return prev
      return [...prev, uid]
    })
  }

  async function applyRecommend() {
    if (!p) return
    setError('')
    setInfo('')
    try {
      const data = await api<{
        lead: User | null
        helpers: User[]
        blockedCount?: number
        availableCount?: number
      }>(
        `/api/pihavuorot/meta/recommend?weekStart=${encodeURIComponent(p.weekStart)}&totalPeople=${Math.min(6, Math.max(2, (helperIds.length || 4) + 1))}&fresh=1`,
      )
      if (data.lead) setLeadId(data.lead.id)
      setHelperIds(data.helpers.map((h) => h.id).filter((id) => id !== data.lead?.id))
      if (data.blockedCount) {
        setInfo(
          `Suositus ohitti ${data.blockedCount} jäsentä esteviikon takia (${data.availableCount ?? 0} saatavilla).`,
        )
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Suositus epäonnistui')
    }
  }

  async function saveRoster() {
    if (!id || !p) return
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
    if (p.status === 'published') {
      const ok = window.confirm(
        'Kokoonpanon tallennus luo tehtävät uudelleen ja nollaa kuittaukset. Jatketaanko?',
      )
      if (!ok) return
    }
    setSavingRoster(true)
    setError('')
    try {
      const data = await api<{ pihavuoro: Pihavuoro }>(`/api/pihavuorot/${id}`, {
        method: 'PATCH',
        json: {
          leadUserId: leadId,
          helperUserIds: helperIds,
          season: p.season,
        },
      })
      setP(data.pihavuoro)
      setEditingRoster(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Tallennus epäonnistui')
    } finally {
      setSavingRoster(false)
    }
  }

  async function createSwap() {
    if (!id) return
    setError('')
    setInfo('')
    try {
      await api(`/api/pihavuorot/${id}/swaps`, {
        method: 'POST',
        json: {
          message: swapMessage.trim() || undefined,
          toUserId: swapTarget || undefined,
        },
      })
      setSwapMessage('')
      setSwapTarget('')
      setInfo('Vaihtotarjous julkaistu.')
      await loadSwaps()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Tarjouksen luonti epäonnistui')
    }
  }

  async function acceptSwap(swapId: string) {
    setBusyId(swapId)
    setError('')
    try {
      const data = await api<{ pihavuoro: Pihavuoro }>(`/api/swaps/${swapId}/accept`, {
        method: 'POST',
      })
      setP(data.pihavuoro)
      setInfo('Otit vuoron vastaan.')
      await loadSwaps()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Hyväksyntä epäonnistui')
    } finally {
      setBusyId(null)
    }
  }

  async function cancelSwap(swapId: string) {
    setBusyId(swapId)
    setError('')
    try {
      await api(`/api/swaps/${swapId}/cancel`, { method: 'POST' })
      await loadSwaps()
      setInfo('Tarjous peruttu.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Peruminen epäonnistui')
    } finally {
      setBusyId(null)
    }
  }

  if (!p) {
    return (
      <div className="page">
        {error ? <p className="error">{error}</p> : <p>Ladataan…</p>}
      </div>
    )
  }

  const openCount = p.tasks.filter((t) => t.status === 'open').length
  const doneCount = p.tasks.filter((t) => t.status !== 'open').length

  return (
    <div className="page">
      <Link className="back" to="/kalenteri">
        ← Kalenteri
      </Link>
      <header className="page-hero compact">
        <p className="brand-mark">Pihavuoro</p>
        <h1>
          {formatWeekRangeFi(p.weekStart, p.weekEnd)}
        </h1>
        <p className="lede">
          {p.seasonLabel || SEASON_LABELS[p.season] || p.season} ·{' '}
          {p.status === 'draft' ? 'Luonnos' : p.status === 'published' ? 'Julkaistu' : 'Valmis'}
          {' · '}
          {doneCount}/{p.tasks.length} hoidettu
        </p>
        {onShift && p.status !== 'draft' && (
          <p className="lede" style={{ marginTop: '0.35rem' }}>
            Vuorokeskustelu: chat-painike oikeassa alakulmassa.
          </p>
        )}
      </header>

      {error && <p className="error">{error}</p>}
      {info && <p className="ok-flash">{info}</p>}

      {isAdmin && (
        <div className="row-actions" style={{ marginBottom: '1rem' }}>
          {p.status === 'draft' && (
            <button className="btn primary" onClick={() => void publish()}>
              Julkaise vuoro
            </button>
          )}
          <button
            className="btn danger"
            type="button"
            disabled={deleting}
            onClick={() => void deleteWeek()}
          >
            {deleting ? 'Poistetaan…' : 'Poista viikkovuoro'}
          </button>
        </div>
      )}

      <section className="panel">
        <div className="week-card-top">
          <h2>Kokoonpano</h2>
          {isAdmin && (
            <button
              className="btn small"
              type="button"
              onClick={() => setEditingRoster((v) => !v)}
            >
              {editingRoster ? 'Sulje muokkaus' : 'Muokkaa'}
            </button>
          )}
        </div>

        {!editingRoster && (
          <ul className="roster">
            {p.assignments.map((a) => (
              <li key={a.id}>
                <div>
                  <strong>{a.userName}</strong>
                  <span className="muted">
                    {' '}
                    · {a.role === 'lead' ? 'Vastuuveli' : 'Avustaja'}
                  </span>
                </div>
                {isAdmin && a.constraintLabels.length > 0 && (
                  <div className="tags">
                    {a.constraintLabels.map((c) => (
                      <span key={c} className="tag">
                        {c}
                      </span>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {editingRoster && isAdmin && (
          <div className="roster-editor">
            <label>
              Vastuuhenkilö
              <select value={leadId} onChange={(e) => setLeadId(e.target.value)}>
                <option value="">Valitse…</option>
                {candidateUsers.map((u) => (
                  <option key={u.id} value={u.id} disabled={u.constraints.includes('no_lead')}>
                    {u.name}
                    {u.constraints.includes('no_lead') ? ' — ei vastuuhenkilöksi' : ''}
                    {u.constraints.includes('no_heavy') ? ' · ei raskaisiin' : ''}
                  </option>
                ))}
              </select>
            </label>

            <fieldset className="checks">
              <legend>Avustajat ({helperIds.length}/1–5)</legend>
              {candidateUsers
                .filter((u) => u.id !== leadId)
                .map((u) => (
                  <label key={u.id} className="check">
                    <input
                      type="checkbox"
                      checked={helperIds.includes(u.id)}
                      disabled={!helperIds.includes(u.id) && helperIds.length >= 5}
                      onChange={() => toggleHelper(u.id)}
                    />
                    <span>
                      {u.name}
                      {u.constraints.includes('no_heavy') ? ' · ei raskaisiin' : ''}
                    </span>
                  </label>
                ))}
            </fieldset>

            <p className="hint">
              Tallennus jakaa tehtävät uudelleen kokoonpanolle
              {p.status === 'published' ? ' ja nollaa kuittaukset' : ''}.
            </p>

            <div className="row-actions">
              <button className="btn" type="button" onClick={() => void applyRecommend()}>
                Käytä suositusta
              </button>
              <button
                className="btn primary"
                type="button"
                disabled={savingRoster}
                onClick={() => void saveRoster()}
              >
                {savingRoster ? 'Tallennetaan…' : 'Tallenna kokoonpano'}
              </button>
            </div>
          </div>
        )}

        {isAdmin && !editingRoster && (
          <p className="hint">
            Rajoitteet (esim. ei vastuuhenkilöksi) näkyvät vain ylläpitäjille. Raskaita tehtäviä ei
            voi antaa “ei raskaisiin” -henkilölle.
          </p>
        )}
        {isLead && !isAdmin && !editingRoster && (
          <p className="hint">Raskaita tehtäviä ei voi antaa “ei raskaisiin” -henkilölle.</p>
        )}
      </section>

      {p.status === 'published' && (
        <section className="panel">
          <h2>Vuoronvaihto</h2>
          {onShift && !myOpenSwap && (
            <div className="stack swap-form">
              <p className="hint">
                Jos et pääse paikalle, tarjoa paikkasi ({myAssignment?.role === 'lead' ? 'vastuu' : 'apu'})
                muille.
              </p>
              <label>
                Viesti (valinnainen)
                <textarea
                  rows={2}
                  value={swapMessage}
                  onChange={(e) => setSwapMessage(e.target.value)}
                  placeholder="Esim. matkustan pois viikonloppuna"
                />
              </label>
              <label>
                Kohdenna henkilölle (valinnainen)
                <select value={swapTarget} onChange={(e) => setSwapTarget(e.target.value)}>
                  <option value="">Avoin kaikille</option>
                  {swapCandidates.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </label>
              <button className="btn primary" type="button" onClick={() => void createSwap()}>
                Julkaise vaihtotarjous
              </button>
            </div>
          )}

          {myOpenSwap && (
            <div className="swap-card">
              <div>
                <strong>Oma tarjouksesi auki</strong>
                <p className="muted">
                  {myOpenSwap.toUserName
                    ? `Kohde: ${myOpenSwap.toUserName}`
                    : 'Avoin kaikille'}
                  {myOpenSwap.message ? ` · ${myOpenSwap.message}` : ''}
                </p>
              </div>
              <button
                className="btn small"
                type="button"
                disabled={busyId === myOpenSwap.id}
                onClick={() => void cancelSwap(myOpenSwap.id)}
              >
                Peru
              </button>
            </div>
          )}

          {claimableSwaps.length > 0 && (
            <ul className="swap-list">
              {claimableSwaps.map((s) => (
                <li key={s.id} className="swap-card">
                  <div>
                    <strong>{s.fromUserName}</strong>
                    <p className="muted">
                      {s.role === 'lead' ? 'vastuuhenkilö' : 'avustaja'}
                      {s.message ? ` · ${s.message}` : ''}
                    </p>
                  </div>
                  <button
                    className="btn primary small"
                    type="button"
                    disabled={busyId === s.id}
                    onClick={() => void acceptSwap(s.id)}
                  >
                    Ota vuoro
                  </button>
                </li>
              ))}
            </ul>
          )}

          {!onShift && claimableSwaps.length === 0 && !myOpenSwap && (
            <p className="muted">Ei avoimia vaihtotarjouksia tälle viikolle.</p>
          )}

          <p className="hint">
            <Link to="/vaihdot">Katso kaikki avoimet vaihdot</Link>
          </p>
        </section>
      )}

      {isAdmin && (
        <section className="panel week-task-picker">
          <div className="week-card-top">
            <h2>Huoltotehtävät tälle viikolle</h2>
            <button
              className="btn small"
              type="button"
              onClick={() => {
                if (editingTasks) {
                  setSelectedTemplateIds(
                    p.tasks.map((t) => t.templateId).filter((x): x is string => Boolean(x)),
                  )
                }
                setEditingTasks((v) => !v)
              }}
            >
              {editingTasks ? 'Peru' : 'Valitse'}
            </button>
          </div>
          {!editingTasks ? (
            <p className="hint" style={{ margin: 0 }}>
              Valitse katalogista vain ne tehtävät, jotka kuuluvat tälle viikolle. Jäsenet kuittaavat
              kortit tehdyksi tai ei tarvetta.
            </p>
          ) : (
            <>
              <p className="hint">
                Viikoittaiset on valmiiksi merkitty. Lisää tarvittaessa tilanteen mukaiset työt.
              </p>
              <ul className="template-pick-list">
                {seasonCatalog.map((t) => {
                  const checked = selectedTemplateIds.includes(t.id)
                  return (
                    <li key={t.id}>
                      <label className={`template-pick ${checked ? 'is-on' : ''}`}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleTemplate(t.id)}
                        />
                        <span className="template-pick-body">
                          <strong>{t.title}</strong>
                          <span>
                            {CADENCE_LABELS[t.cadence] || t.cadence}
                            {' · '}
                            {t.effort === 'heavy' ? 'raskas' : 'kevyt'}
                          </span>
                        </span>
                      </label>
                    </li>
                  )
                })}
              </ul>
              <div className="row-actions">
                <button
                  className="btn primary"
                  type="button"
                  disabled={savingTasks || selectedTemplateIds.length === 0}
                  onClick={() => void saveWeekTasks()}
                >
                  {savingTasks ? 'Tallennetaan…' : 'Tallenna viikon tehtävät'}
                </button>
              </div>
            </>
          )}
        </section>
      )}

      {activeHub.length > 0 && (
        <section className="panel">
          <h2>Huoltokorttien tehtävät</h2>
          <p className="hint">
            {canEditHub
              ? 'Ylläpitäjä on aktivoinut nämä kortit — merkitse tarkastuskohdat tehdyiksi.'
              : 'Aktivoitu huoltokortti tälle viikolle. Vastuuveli merkitsee kohdat tehdyiksi.'}
          </p>
          <div className="card-list">
            {activeHub.map((h) => (
              <Link key={h.id} className="hub-list-card" to={`/huolto/${h.id}`}>
                <div className="week-card-top">
                  <strong>{h.title}</strong>
                  <span className={`pill status-${h.status}`}>
                    {h.status === 'done' ? 'Valmis' : h.status === 'in_progress' ? 'Kesken' : 'Avoin'}
                  </span>
                </div>
                <p className="meta">
                  {h.doneCount}/{h.itemCount} merkitty
                  {h.issueCount ? ` · ${h.issueCount} puutetta` : ''}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="panel">
        <h2>Tehtävät ({openCount} auki)</h2>
        <div className="task-list">
          {p.tasks.map((t) => {
            const canAck = Boolean(myAssignment) || isAdmin
            return (
              <article key={t.id} className={`task task-card ${t.status}`}>
                <div className="task-head">
                  <h3>{t.title}</h3>
                  <span className={`pill status-${t.status === 'open' ? 'published' : t.status === 'done' ? 'done' : 'draft'}`}>
                    {t.status === 'open' ? 'Avoin' : t.status === 'done' ? 'Tehty' : 'Ei tarvetta'}
                  </span>
                </div>
                <p className="muted">{t.instructions}</p>
                <p className="meta">
                  {t.effort === 'heavy' ? 'Raskas' : 'Kevyt'}
                  {t.doneByName ? ` · kuitannut ${t.doneByName}` : ''}
                </p>
                {t.status === 'open' && canAck && (
                  <div className="row-actions task-ack">
                    <button
                      className="btn primary small"
                      disabled={busyId === t.id}
                      onClick={() => void complete(t.id, 'done')}
                    >
                      Tehty
                    </button>
                    <button
                      className="btn small"
                      disabled={busyId === t.id}
                      onClick={() => void complete(t.id, 'skipped')}
                    >
                      Ei tehty
                    </button>
                  </div>
                )}
              </article>
            )
          })}
          {!p.tasks.length && (
            <p className="muted">Ei huoltotehtäviä tälle viikolle vielä.</p>
          )}
        </div>
      </section>
    </div>
  )
}
