import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api, type ExtraTask } from '../api'
import { useAuth } from '../auth'

const STATUS_FI: Record<ExtraTask['status'], string> = {
  open: 'Kerää ilmoittautumisia',
  ready: 'Valmis aloitettavaksi',
  in_progress: 'Käynnissä',
  done: 'Valmis',
  cancelled: 'Peruttu',
}

function IconTrash() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="btn-icon">
      <path d="M4 7h16" />
      <path d="M9 7V5h6v2" />
      <path d="M7 7l1 13h8l1-13" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  )
}

export function ExtraTasksPage() {
  const { user } = useAuth()
  const [tasks, setTasks] = useState<ExtraTask[]>([])
  const [canCreate, setCanCreate] = useState(false)
  const [error, setError] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [minRequired, setMinRequired] = useState(2)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [confirmWipe, setConfirmWipe] = useState(false)
  const [wiping, setWiping] = useState(false)
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null)

  async function load() {
    const data = await api<{ tasks: ExtraTask[]; canCreate: boolean }>('/api/extra-tasks')
    setTasks(Array.isArray(data.tasks) ? data.tasks : [])
    setCanCreate(Boolean(data.canCreate))
  }

  useEffect(() => {
    load().catch((e) => setError(e.message))
  }, [])

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    setError('')
    try {
      await api('/api/extra-tasks', {
        method: 'POST',
        json: { title, description, minRequired },
      })
      setTitle('')
      setDescription('')
      setMinRequired(2)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Luonti epäonnistui')
    }
  }

  async function act(id: string, path: string, method: 'POST' | 'DELETE' = 'POST') {
    setBusyId(id)
    setError('')
    try {
      await api(`/api/extra-tasks/${id}/${path}`, { method })
      setConfirmCancelId(null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Toiminto epäonnistui')
    } finally {
      setBusyId(null)
    }
  }

  async function wipeAllExtras() {
    setWiping(true)
    setError('')
    try {
      await api('/api/extra-tasks', { method: 'DELETE' })
      setConfirmWipe(false)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Poisto epäonnistui')
    } finally {
      setWiping(false)
    }
  }

  return (
    <div className="page">
      <header className="page-hero compact">
        <p className="brand-mark">Siisti salin piha</p>
        <h1>Apukutsut</h1>
        <p className="lede">Yllättävä tarve — ilmoittaudu, kun minimi täyttyy tehtävä aktivoituu.</p>
      </header>

      {user?.role === 'admin' && tasks.length > 0 && (
        <section className="danger-zone" aria-label="Apukutsujen poisto">
          {!confirmWipe ? (
            <button
              className="btn danger small"
              type="button"
              onClick={() => setConfirmWipe(true)}
            >
              <IconTrash />
              Poista kaikki apukutsut
            </button>
          ) : (
            <div className="danger-confirm">
              <div className="danger-confirm-copy">
                <strong>Poistetaanko kaikki {tasks.length} apukutsua?</strong>
                <p>Kutsut, ilmoittautumiset ja tilat poistuvat pysyvästi. Tätä ei voi perua.</p>
              </div>
              <div className="row-actions danger-confirm-actions">
                <button
                  className="btn danger-solid"
                  type="button"
                  disabled={wiping}
                  onClick={() => void wipeAllExtras()}
                >
                  <IconTrash />
                  {wiping ? 'Poistetaan…' : 'Kyllä, poista kaikki'}
                </button>
                <button
                  className="btn ghost small"
                  type="button"
                  disabled={wiping}
                  onClick={() => setConfirmWipe(false)}
                >
                  Peru
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {error && <p className="error">{error}</p>}

      <p className="hint push-home-hint">
        Push-ilmoitukset kytketään <Link to="/">etusivulta</Link> (päällä / pois).
      </p>

      {canCreate && (
        <section className="panel">
          <h2>Uusi apukutsu</h2>
          <form className="stack" onSubmit={onCreate}>
            <label>
              Otsikko
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                placeholder="Tarvitaan apuvoimaa lumitöihin"
              />
            </label>
            <label>
              Lisätieto
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Milloin ja missä?"
              />
            </label>
            <label>
              Vähintään ilmoittautuneita
              <input
                type="number"
                min={1}
                max={20}
                value={minRequired}
                onChange={(e) => setMinRequired(Number(e.target.value) || 1)}
              />
            </label>
            <button className="btn primary" type="submit">
              Lähetä kaikille
            </button>
          </form>
        </section>
      )}

      {!canCreate && (
        <p className="hint">
          Apukutsun voi luoda ylläpitäjä tai julkaistun viikon vastuuveli.
        </p>
      )}

      <div className="card-list">
        {tasks.map((t) => {
          const isCreator = t.createdByUserId === user?.id || user?.role === 'admin'
          const cancelling = confirmCancelId === t.id
          return (
            <article
              key={t.id}
              className={`notice-card${t.status === 'cancelled' ? ' is-cancelled' : ''}`}
            >
              <div className="week-card-top">
                <strong>{t.title}</strong>
                <span className={`pill status-${t.status}`}>{STATUS_FI[t.status]}</span>
              </div>
              {t.description && <p>{t.description}</p>}
              <p className="meta">
                {t.signupCount}/{t.minRequired} ilmoittautunut
                {t.spotsLeft > 0 && t.status === 'open' ? ` · tarvitaan vielä ${t.spotsLeft}` : ''}
                {' · '}
                {t.createdByName}
              </p>
              {(t.signups?.length ?? 0) > 0 && (
                <ul className="task-preview">
                  {(t.signups ?? []).map((s) => (
                    <li key={s.id}>{s.userName}</li>
                  ))}
                </ul>
              )}
              {cancelling ? (
                <div className="danger-confirm danger-confirm-inline">
                  <div className="danger-confirm-copy">
                    <strong>Perutaanko tämä apukutsu?</strong>
                    <p>Ilmoittautuneet näkevät kutsun peruttuna.</p>
                  </div>
                  <div className="row-actions danger-confirm-actions">
                    <button
                      className="btn danger-solid small"
                      type="button"
                      disabled={busyId === t.id}
                      onClick={() => void act(t.id, 'cancel')}
                    >
                      {busyId === t.id ? 'Perutaan…' : 'Kyllä, peruuta'}
                    </button>
                    <button
                      className="btn ghost small"
                      type="button"
                      disabled={busyId === t.id}
                      onClick={() => setConfirmCancelId(null)}
                    >
                      Älä peru
                    </button>
                  </div>
                </div>
              ) : (
                <div className="row-actions">
                  {(t.status === 'open' || t.status === 'ready') && !t.iSignedUp && (
                    <button
                      className="btn primary small"
                      disabled={busyId === t.id}
                      onClick={() => void act(t.id, 'signup')}
                    >
                      Ilmoittaudu
                    </button>
                  )}
                  {(t.status === 'open' || t.status === 'ready') && t.iSignedUp && (
                    <button
                      className="btn small"
                      disabled={busyId === t.id}
                      onClick={() => void act(t.id, 'signup', 'DELETE')}
                    >
                      Peru ilmoittautuminen
                    </button>
                  )}
                  {t.status === 'ready' && isCreator && (
                    <button
                      className="btn primary small"
                      disabled={busyId === t.id}
                      onClick={() => void act(t.id, 'start')}
                    >
                      Aloita
                    </button>
                  )}
                  {(t.status === 'ready' || t.status === 'in_progress') &&
                    (isCreator || t.iSignedUp) && (
                      <button
                        className="btn small"
                        disabled={busyId === t.id}
                        onClick={() => void act(t.id, 'complete')}
                      >
                        Merkitse valmiiksi
                      </button>
                    )}
                  {isCreator && t.status !== 'done' && t.status !== 'cancelled' && (
                    <button
                      className="btn danger small"
                      type="button"
                      disabled={busyId === t.id}
                      onClick={() => {
                        setConfirmWipe(false)
                        setConfirmCancelId(t.id)
                      }}
                    >
                      <IconTrash />
                      Peruuta kutsu
                    </button>
                  )}
                </div>
              )}
            </article>
          )
        })}
        {!tasks.length && <p className="muted">Ei apukutsuja vielä.</p>}
      </div>
    </div>
  )
}
