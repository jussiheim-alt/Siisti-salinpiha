import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, type HubInspection } from '../api'
import { useAuth } from '../auth'
import { formatDateFi } from '../shared/datetime'

function itemStatusLabel(status: HubInspection['items'][number]['status']) {
  if (status === 'ok') return 'OK'
  if (status === 'issue') return 'Puute'
  return 'Avoin'
}

export function HubDetailPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const [insp, setInsp] = useState<HubInspection | null>(null)
  const [canEdit, setCanEdit] = useState(false)
  const [canManage, setCanManage] = useState(false)
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function load() {
    const data = await api<{
      inspection: HubInspection
      canEdit: boolean
      canManage?: boolean
    }>(`/api/hub/${id}`)
    setInsp(data.inspection)
    setCanEdit(Boolean(data.canEdit))
    setCanManage(Boolean(data.canManage) || user?.role === 'admin')
    setNotes(data.inspection.notes || '')
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

  if (!insp && !error) return <div className="boot">Ladataan…</div>
  if (!insp) return <p className="error">{error}</p>

  const doneCount = insp.items.filter((i) => i.status !== 'open').length
  const issueCount = insp.items.filter((i) => i.status === 'issue').length

  return (
    <div className="page hub-detail-page">
      <Link className="back" to={canManage ? '/huolto' : '/'}>
        {canManage ? '← Huoltokorttien tehtävät' : '← Etusivu'}
      </Link>
      <header className="page-hero compact">
        <p className="brand-mark">Siisti salin piha</p>
        <h1>{insp.title}</h1>
        <p className="lede">
          {insp.cadenceLabel} · {insp.windowStart} – {insp.windowEnd}
          {insp.activated ? ' · aktivoitu viikkovuorolle' : ''}
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
      </header>

      {error && <p className="error">{error}</p>}
      {!canEdit && (
        <p className="hint">
          {insp.activated
            ? 'Vain viikon vastuuveli tai ylläpitäjä voi merkitä tarkastuksia tehdyiksi.'
            : 'Kortti ei ole vielä aktivoitu viikkovuorolle.'}
        </p>
      )}

      {insp.intro && (
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
          {insp.items.map((item, index) => (
            <li key={item.id} className={`hub-item status-${item.status}`}>
              <span className="hub-item-index" aria-hidden="true">
                {index + 1}
              </span>
              <p className="hub-item-label">{item.label}</p>
              {canEdit ? (
                <div
                  className="hub-seg"
                  role="group"
                  aria-label={`Merkintä: ${item.label}`}
                >
                  <button
                    type="button"
                    className={`hub-seg-btn hub-ok ${item.status === 'ok' ? 'is-active' : ''}`}
                    disabled={busy}
                    aria-pressed={item.status === 'ok'}
                    onClick={() =>
                      void setItemStatus(item.id, item.status === 'ok' ? 'open' : 'ok')
                    }
                  >
                    OK
                  </button>
                  <button
                    type="button"
                    className={`hub-seg-btn hub-issue ${item.status === 'issue' ? 'is-active' : ''}`}
                    disabled={busy}
                    aria-pressed={item.status === 'issue'}
                    onClick={() =>
                      void setItemStatus(item.id, item.status === 'issue' ? 'open' : 'issue')
                    }
                  >
                    Puute
                  </button>
                </div>
              ) : (
                <span className={`hub-item-state status-${item.status}`}>
                  {itemStatusLabel(item.status)}
                </span>
              )}
            </li>
          ))}
        </ul>
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
            {insp.completedAt ? ` · ${formatDateFi(insp.completedAt)}` : ''}
          </p>
        )}
      </form>
    </div>
  )
}
