import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, type Pihavuoro, type ShiftMessage, type SwapOffer, type User } from '../api'
import { useAuth } from '../auth'

export function PihavuoroPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const [p, setP] = useState<Pihavuoro | null>(null)
  const [users, setUsers] = useState<User[]>([])
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
  const [messages, setMessages] = useState<ShiftMessage[]>([])
  const [chatBody, setChatBody] = useState('')
  const [chatError, setChatError] = useState('')
  const [sendingChat, setSendingChat] = useState(false)

  async function load() {
    const data = await api<{ pihavuoro: Pihavuoro }>(`/api/pihavuorot/${id}`)
    setP(data.pihavuoro)
    const lead = data.pihavuoro.assignments.find((a) => a.role === 'lead')
    setLeadId(lead?.userId || '')
    setHelperIds(
      data.pihavuoro.assignments.filter((a) => a.role === 'helper').map((a) => a.userId),
    )
  }

  async function loadSwaps() {
    if (!id) return
    const data = await api<{ swaps: SwapOffer[] }>(`/api/pihavuorot/${id}/swaps`)
    setSwaps(data.swaps)
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
    if (user?.role !== 'admin') return
    api<{ users: User[] }>('/api/users')
      .then((d) => setUsers(d.users.filter((u) => u.active)))
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
  const canAssign = isLead || isAdmin
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

  async function assign(taskId: string, assigneeUserId: string) {
    setBusyId(taskId)
    setError('')
    try {
      const data = await api<{ pihavuoro: Pihavuoro }>(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        json: { assigneeUserId: assigneeUserId || null },
      })
      setP(data.pihavuoro)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Jako epäonnistui')
    } finally {
      setBusyId(null)
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
        `/api/pihavuorot/meta/recommend?weekStart=${encodeURIComponent(p.weekStart)}&helperCount=4&fresh=1`,
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
    if (helperIds.length < 3 || helperIds.length > 5) {
      setError('Valitse 3–5 avustajaa')
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
          {p.weekStart} – {p.weekEnd}
        </h1>
        <p className="lede">
          {p.season === 'talvi' ? 'Talvi' : 'Sulankausi'} ·{' '}
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

      {isAdmin && p.status === 'draft' && (
        <div className="row-actions" style={{ marginBottom: '1rem' }}>
          <button className="btn primary" onClick={() => void publish()}>
            Julkaise vuoro
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
                    · {a.role === 'lead' ? 'Vastuuhenkilö' : 'Avustaja'}
                  </span>
                </div>
                {a.constraintLabels.length > 0 && (isLead || isAdmin || a.userId === user?.id) && (
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
              <legend>Avustajat ({helperIds.length}/3–5)</legend>
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

        {(isLead || isAdmin) && !editingRoster && (
          <p className="hint">
            Vastuuhenkilö näkee rajoitukset. Raskaita tehtäviä ei voi antaa “ei raskaisiin”
            -henkilölle.
          </p>
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

      <section className="panel">
        <h2>Tehtävät ({openCount} auki)</h2>
        <div className="task-list">
          {p.tasks.map((t) => {
            const canOwn =
              Boolean(myAssignment) &&
              (isLead || t.assigneeUserId === user?.id || !t.assigneeUserId || isAdmin)
            return (
              <article key={t.id} className={`task ${t.status}`}>
                <div className="task-head">
                  <h3>{t.title}</h3>
                  <span className="pill">
                    {t.status === 'open' ? 'Avoin' : t.status === 'done' ? 'Tehty' : 'Ei tarvetta'}
                  </span>
                </div>
                <p className="muted">{t.instructions}</p>
                <p className="meta">
                  {t.effort === 'heavy' ? 'Raskas' : 'Kevyt'}
                  {t.assigneeName ? ` · ${t.assigneeName}` : ' · ei nimettyä'}
                  {t.doneByName ? ` · kuitannut ${t.doneByName}` : ''}
                </p>
                {t.status === 'open' && canAssign && (
                  <label className="assign-label">
                    Tekijä
                    <select
                      value={t.assigneeUserId || ''}
                      disabled={busyId === t.id}
                      onChange={(e) => void assign(t.id, e.target.value)}
                    >
                      <option value="">Ei nimettyä</option>
                      {p.assignments.map((a) => {
                        const blocked = t.effort === 'heavy' && a.constraints.includes('no_heavy')
                        return (
                          <option key={a.userId} value={a.userId} disabled={blocked}>
                            {a.userName}
                            {a.role === 'lead' ? ' (vastuu)' : ''}
                            {blocked ? ' — ei raskaisiin' : ''}
                          </option>
                        )
                      })}
                    </select>
                  </label>
                )}
                {t.status === 'open' && canOwn && (
                  <div className="row-actions">
                    <button
                      className="btn primary small"
                      disabled={busyId === t.id}
                      onClick={() => void complete(t.id, 'done')}
                    >
                      Kuittaa tehdyksi
                    </button>
                    <button
                      className="btn small"
                      disabled={busyId === t.id}
                      onClick={() => void complete(t.id, 'skipped')}
                    >
                      Ei tarvetta
                    </button>
                  </div>
                )}
              </article>
            )
          })}
        </div>
      </section>
    </div>
  )
}
