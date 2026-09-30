import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, type HubInspection } from '../api'

export function HubDetailPage() {
  const { id } = useParams()
  const [insp, setInsp] = useState<HubInspection | null>(null)
  const [canEdit, setCanEdit] = useState(false)
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function load() {
    const data = await api<{ inspection: HubInspection; canEdit: boolean }>(`/api/hub/${id}`)
    setInsp(data.inspection)
    setCanEdit(Boolean(data.canEdit))
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

  return (
    <div className="page">
      <Link className="back" to="/huolto">
        ← Hub-huolto
      </Link>
      <header className="page-hero compact">
        <p className="brand-mark">Siisti piha</p>
        <h1>{insp.title}</h1>
        <p className="lede">
          {insp.cadenceLabel} · {insp.windowStart} – {insp.windowEnd}
        </p>
      </header>

      {error && <p className="error">{error}</p>}
      {!canEdit && (
        <p className="hint">Vain ylläpitäjä tai viikon vastuuhenkilö voi merkitä tarkastuksia.</p>
      )}

      {insp.intro && <p className="hint">{insp.intro}</p>}

      <section className="panel">
        <h2>Tarkistuskohdat</h2>
        <ul className="hub-items">
          {insp.items.map((item) => (
            <li key={item.id} className={`hub-item status-${item.status}`}>
              <p>{item.label}</p>
              {canEdit ? (
                <div className="row-actions">
                  <button
                    type="button"
                    className={`btn small ${item.status === 'ok' ? 'primary' : 'ghost'}`}
                    disabled={busy}
                    onClick={() => void setItemStatus(item.id, 'ok')}
                  >
                    OK
                  </button>
                  <button
                    type="button"
                    className={`btn small ${item.status === 'issue' ? 'primary' : 'ghost'}`}
                    disabled={busy}
                    onClick={() => void setItemStatus(item.id, 'issue')}
                  >
                    Puute
                  </button>
                </div>
              ) : (
                <p className="meta">
                  {item.status === 'ok' ? 'OK' : item.status === 'issue' ? 'Puute' : 'Avoin'}
                </p>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="panel">
        <h2>Jos huomaat puutteita</h2>
        <ol className="hub-protocol">
          {insp.protocol.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>

      <form className="panel stack" onSubmit={(e) => void saveNotes(e)}>
        <h2>Huomautukset</h2>
        <label>
          Muistiinpanot
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            disabled={!canEdit}
          />
        </label>
        {canEdit && (
          <label>
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
          <img className="notice-photo" src={insp.photoUrl} alt="Tarkastuksen liite" />
        )}
        {canEdit && (
          <div className="row-actions">
            <button className="btn primary" type="submit" disabled={busy}>
              Tallenna huomautukset
            </button>
            {insp.status !== 'done' && (
              <button
                className="btn ghost"
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
          <p className="meta">
            Valmis
            {insp.completedByName ? ` · ${insp.completedByName}` : ''}
            {insp.completedAt ? ` · ${insp.completedAt.slice(0, 10)}` : ''}
          </p>
        )}
      </form>
    </div>
  )
}
