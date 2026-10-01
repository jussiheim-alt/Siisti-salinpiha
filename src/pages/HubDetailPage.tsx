import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, type HubInspection } from '../api'
import { useAuth } from '../auth'

function itemStatusLabel(status: HubInspection['items'][number]['status']) {
  if (status === 'ok') return 'OK'
  if (status === 'issue') return 'Puute'
  return 'Avoin'
}

export function HubDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [insp, setInsp] = useState<HubInspection | null>(null)
  const [canEdit, setCanEdit] = useState(false)
  const [canManage, setCanManage] = useState(false)
  const [managing, setManaging] = useState(false)
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [newItemLabel, setNewItemLabel] = useState('')
  const [editTitle, setEditTitle] = useState('')
  const [editCadence, setEditCadence] = useState('')
  const [editStart, setEditStart] = useState('')
  const [editEnd, setEditEnd] = useState('')
  const [editIntro, setEditIntro] = useState('')
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [editingItemLabel, setEditingItemLabel] = useState('')

  async function load() {
    const data = await api<{
      inspection: HubInspection
      canEdit: boolean
      canManage?: boolean
    }>(`/api/hub/${id}`)
    setInsp(data.inspection)
    setCanEdit(Boolean(data.canEdit))
    setCanManage(Boolean(data.canManage ?? user?.role === 'admin'))
    setNotes(data.inspection.notes || '')
    setEditTitle(data.inspection.title)
    setEditCadence(data.inspection.cadenceLabel)
    setEditStart(data.inspection.windowStart)
    setEditEnd(data.inspection.windowEnd)
    setEditIntro(data.inspection.intro || '')
  }

  useEffect(() => {
    if (!id) return
    load().catch((e) => setError(e.message))
  }, [id])

  async function setItemStatus(itemId: string, status: 'ok' | 'issue' | 'open') {
    setBusy(true)
    setError('')
    try {
      const data = await api<{ inspection: HubInspection }>(`/api/hub/${id}/items/${itemId}`, {
        method: 'PATCH',
        json: { status },
      })
      setInsp(data.inspection)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Tallennus epäonnistui')
    } finally {
      setBusy(false)
    }
  }

  async function saveNotes(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const data = await api<{ inspection: HubInspection }>(`/api/hub/${id}`, {
        method: 'PATCH',
        json: { notes },
      })
      setInsp(data.inspection)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tallennus epäonnistui')
    } finally {
      setBusy(false)
    }
  }

  async function uploadPhoto(file: File) {
    setBusy(true)
    setError('')
    try {
      const fd = new FormData()
      fd.append('photo', file)
      const data = await api<{ inspection: HubInspection }>(`/api/hub/${id}/photo`, {
        method: 'POST',
        formData: fd,
      })
      setInsp(data.inspection)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kuvan lataus epäonnistui')
    } finally {
      setBusy(false)
    }
  }

  async function complete() {
    setBusy(true)
    setError('')
    try {
      const data = await api<{ inspection: HubInspection }>(`/api/hub/${id}`, {
        method: 'PATCH',
        json: { status: 'done', notes },
      })
      setInsp(data.inspection)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Valmiiksi merkintä epäonnistui')
    } finally {
      setBusy(false)
    }
  }

  async function saveInspectionMeta(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const data = await api<{ inspection: HubInspection }>(`/api/hub/${id}`, {
        method: 'PATCH',
        json: {
          title: editTitle,
          cadenceLabel: editCadence,
          windowStart: editStart,
          windowEnd: editEnd,
          intro: editIntro,
        },
      })
      setInsp(data.inspection)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tallennus epäonnistui')
    } finally {
      setBusy(false)
    }
  }

  async function addItem(e: FormEvent) {
    e.preventDefault()
    if (!newItemLabel.trim()) return
    setBusy(true)
    setError('')
    try {
      const data = await api<{ inspection: HubInspection }>(`/api/hub/${id}/items`, {
        method: 'POST',
        json: { label: newItemLabel.trim() },
      })
      setInsp(data.inspection)
      setNewItemLabel('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lisäys epäonnistui')
    } finally {
      setBusy(false)
    }
  }

  async function saveItemLabel(itemId: string) {
    if (!editingItemLabel.trim()) return
    setBusy(true)
    setError('')
    try {
      const data = await api<{ inspection: HubInspection }>(`/api/hub/${id}/items/${itemId}`, {
        method: 'PATCH',
        json: { label: editingItemLabel.trim() },
      })
      setInsp(data.inspection)
      setEditingItemId(null)
      setEditingItemLabel('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Muokkaus epäonnistui')
    } finally {
      setBusy(false)
    }
  }

  async function removeItem(itemId: string) {
    if (!window.confirm('Poistetaanko tämä tarkistuskohta?')) return
    setBusy(true)
    setError('')
    try {
      const data = await api<{ inspection: HubInspection }>(`/api/hub/${id}/items/${itemId}`, {
        method: 'DELETE',
      })
      setInsp(data.inspection)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Poisto epäonnistui')
    } finally {
      setBusy(false)
    }
  }

  async function removeInspection() {
    if (!window.confirm('Poistetaanko koko tarkastuskortti? Tätä ei voi perua.')) return
    setBusy(true)
    setError('')
    try {
      await api(`/api/hub/${id}`, { method: 'DELETE' })
      navigate('/huolto')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Poisto epäonnistui')
      setBusy(false)
    }
  }

  if (!insp && !error) return <div className="boot">Ladataan…</div>
  if (!insp) return <p className="error">{error}</p>

  const doneCount = insp.items.filter((i) => i.status !== 'open').length
  const issueCount = insp.items.filter((i) => i.status === 'issue').length

  return (
    <div className="page hub-detail-page">
      <Link className="back" to="/huolto">
        ← Hub-huolto
      </Link>
      <header className="page-hero compact">
        <p className="brand-mark">Siisti salin piha</p>
        <h1>{insp.title}</h1>
        <p className="lede">
          {insp.cadenceLabel} · {insp.windowStart} – {insp.windowEnd}
        </p>
        <div className="hub-progress-meta">
          <span>
            {doneCount}/{insp.items.length} merkitty
          </span>
          {issueCount > 0 && <span className="hub-progress-issues">{issueCount} puutetta</span>}
          <span className={`pill status-${insp.status}`}>
            {insp.status === 'done' ? 'Valmis' : insp.status === 'in_progress' ? 'Kesken' : 'Avoin'}
          </span>
        </div>
        {canManage && (
          <div className="row-actions" style={{ marginTop: '0.75rem' }}>
            <button
              className="btn small"
              type="button"
              onClick={() => setManaging((v) => !v)}
            >
              {managing ? 'Valmis muokkaus' : 'Muokkaa korttia'}
            </button>
          </div>
        )}
      </header>

      {error && <p className="error">{error}</p>}
      {!canEdit && (
        <p className="hint">Vain ylläpitäjä tai viikon vastuuhenkilö voi merkitä tarkastuksia.</p>
      )}

      {managing && canManage && (
        <form className="surface-card hub-manage stack" onSubmit={(e) => void saveInspectionMeta(e)}>
          <p className="kicker">Ylläpito</p>
          <h2>Muokkaa tarkastusta</h2>
          <label>
            Otsikko
            <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} required />
          </label>
          <label>
            Jakso / rytmi
            <input
              value={editCadence}
              onChange={(e) => setEditCadence(e.target.value)}
              placeholder="Kerran vuodessa"
            />
          </label>
          <div className="hub-date-row">
            <label>
              Alkaa
              <input
                type="date"
                value={editStart}
                onChange={(e) => setEditStart(e.target.value)}
                required
              />
            </label>
            <label>
              Päättyy
              <input
                type="date"
                value={editEnd}
                onChange={(e) => setEditEnd(e.target.value)}
                required
              />
            </label>
          </div>
          <label>
            Taustateksti
            <textarea
              rows={2}
              value={editIntro}
              onChange={(e) => setEditIntro(e.target.value)}
              placeholder="Valinnainen ohje tarkastukseen"
            />
          </label>
          <div className="row-actions">
            <button className="btn primary" type="submit" disabled={busy}>
              Tallenna tiedot
            </button>
            <button
              className="btn small"
              type="button"
              disabled={busy}
              onClick={() => void removeInspection()}
            >
              Poista kortti
            </button>
          </div>
        </form>
      )}

      {insp.intro && !managing && (
        <section className="surface-card hub-intro">
          <p className="kicker">Tausta</p>
          <p>{insp.intro}</p>
        </section>
      )}

      <section className="surface-card hub-checks">
        <div className="hub-checks-head">
          <div>
            <p className="kicker">Tarkistuslista</p>
            <h2>Tarkistuskohdat</h2>
          </div>
          <p className="hub-checks-count">
            {doneCount}/{insp.items.length}
          </p>
        </div>
        <ul className="hub-items">
          {insp.items.map((item) => (
            <li key={item.id} className={`hub-item status-${item.status}`}>
              {managing && canManage ? (
                <div className="hub-item-manage">
                  {editingItemId === item.id ? (
                    <form
                      className="hub-item-edit"
                      onSubmit={(e) => {
                        e.preventDefault()
                        void saveItemLabel(item.id)
                      }}
                    >
                      <input
                        value={editingItemLabel}
                        onChange={(e) => setEditingItemLabel(e.target.value)}
                        autoFocus
                      />
                      <button className="btn primary small" type="submit" disabled={busy}>
                        Tallenna
                      </button>
                      <button
                        className="btn small"
                        type="button"
                        onClick={() => {
                          setEditingItemId(null)
                          setEditingItemLabel('')
                        }}
                      >
                        Peru
                      </button>
                    </form>
                  ) : (
                    <>
                      <p className="hub-item-label">{item.label}</p>
                      <div className="hub-item-manage-actions">
                        <button
                          className="btn ghost small"
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            setEditingItemId(item.id)
                            setEditingItemLabel(item.label)
                          }}
                        >
                          Muokkaa
                        </button>
                        <button
                          className="btn ghost small"
                          type="button"
                          disabled={busy}
                          onClick={() => void removeItem(item.id)}
                        >
                          Poista
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <>
                  {canEdit ? (
                    <button
                      type="button"
                      className={`hub-check ${item.status}`}
                      disabled={busy}
                      aria-label={
                        item.status === 'ok'
                          ? 'Merkitty OK — napsauta avataksesi'
                          : 'Merkitse OK'
                      }
                      aria-pressed={item.status === 'ok'}
                      onClick={() =>
                        void setItemStatus(item.id, item.status === 'ok' ? 'open' : 'ok')
                      }
                    >
                      {item.status === 'ok' ? '✓' : item.status === 'issue' ? '!' : ''}
                    </button>
                  ) : (
                    <span className={`hub-check readonly ${item.status}`} aria-hidden="true">
                      {item.status === 'ok' ? '✓' : item.status === 'issue' ? '!' : ''}
                    </span>
                  )}
                  <p className="hub-item-label">{item.label}</p>
                  {canEdit ? (
                    <button
                      type="button"
                      className={`hub-issue-link ${item.status === 'issue' ? 'is-active' : ''}`}
                      disabled={busy}
                      aria-pressed={item.status === 'issue'}
                      onClick={() =>
                        void setItemStatus(item.id, item.status === 'issue' ? 'open' : 'issue')
                      }
                    >
                      Puute
                    </button>
                  ) : (
                    <span className={`hub-item-state status-${item.status}`}>
                      {itemStatusLabel(item.status)}
                    </span>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>

        {managing && canManage && (
          <form className="hub-add-item" onSubmit={(e) => void addItem(e)}>
            <label>
              Uusi tarkistuskohta
              <input
                value={newItemLabel}
                onChange={(e) => setNewItemLabel(e.target.value)}
                placeholder="Esim. Tarkista valaisimet"
              />
            </label>
            <button className="btn primary small" type="submit" disabled={busy || !newItemLabel.trim()}>
              Lisää kohta
            </button>
          </form>
        )}
      </section>

      <section className="surface-card hub-protocol-card">
        <p className="kicker">Ohje</p>
        <h2>Jos huomaat puutteita</h2>
        <ol className="hub-protocol">
          {insp.protocol.map((step, index) => (
            <li key={step}>
              <span className="hub-protocol-num" aria-hidden="true">
                {index + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </section>

      <form className="surface-card hub-notes stack" onSubmit={(e) => void saveNotes(e)}>
        <p className="kicker">Kirjaus</p>
        <h2>Huomautukset</h2>
        <label>
          Muistiinpanot
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            disabled={!canEdit}
            placeholder="Kirjaa havainnot ja tehdyt korjaukset…"
          />
        </label>
        {canEdit && (
          <label className="hub-photo-label">
            Liite (kuva)
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void uploadPhoto(f)
              }}
            />
          </label>
        )}
        {insp.photoUrl && (
          <img className="notice-photo hub-photo" src={insp.photoUrl} alt="Tarkastuksen liite" />
        )}
        {canEdit && (
          <div className="row-actions">
            <button className="btn primary" type="submit" disabled={busy}>
              Tallenna huomautukset
            </button>
            {insp.status !== 'done' && (
              <button
                className="btn"
                type="button"
                disabled={busy}
                onClick={() => void complete()}
              >
                Merkitse valmiiksi
              </button>
            )}
          </div>
        )}
        {insp.status === 'done' && (
          <p className="meta hub-done-meta">
            Valmis
            {insp.completedByName ? ` · ${insp.completedByName}` : ''}
            {insp.completedAt ? ` · ${insp.completedAt.slice(0, 10)}` : ''}
          </p>
        )}
      </form>
    </div>
  )
}
