import { useEffect, useState, type FormEvent } from 'react'
import { api, type ExtraTask } from '../api'
import { useAuth } from '../auth'
import { disablePushNotifications, enablePushNotifications, getPushStatus } from '../push'

const STATUS_FI: Record<ExtraTask['status'], string> = {
  open: 'Kerää ilmoittautumisia',
  ready: 'Valmis aloitettavaksi',
  in_progress: 'Käynnissä',
  done: 'Valmis',
  cancelled: 'Peruttu',
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
  const [pushSupported, setPushSupported] = useState(false)
  const [pushOn, setPushOn] = useState(false)
  const [pushBusy, setPushBusy] = useState(false)
  const [pushMsg, setPushMsg] = useState('')

  async function load() {
    const data = await api<{ tasks: ExtraTask[]; canCreate: boolean }>('/api/extra-tasks')
    setTasks(Array.isArray(data.tasks) ? data.tasks : [])
    setCanCreate(Boolean(data.canCreate))
  }

  async function refreshPush() {
    const status = await getPushStatus()
    setPushSupported(status.supported)
    setPushOn(status.subscribed && status.permission === 'granted')
  }

  useEffect(() => {
    load().catch((e) => setError(e.message))
    refreshPush().catch(() => undefined)
  }, [])

  async function togglePush() {
    setPushBusy(true)
    setPushMsg('')
    setError('')
    try {
      if (pushOn) {
        await disablePushNotifications()
        setPushMsg('Ilmoitukset pois päältä')
      } else {
        await enablePushNotifications()
        setPushMsg('Ilmoitukset päällä — saat tiedon uusista apukutsuista')
      }
      await refreshPush()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ilmoitusasetus epäonnistui')
    } finally {
      setPushBusy(false)
    }
  }

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
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Toiminto epäonnistui')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="page">
      <header className="page-hero compact">
        <p className="brand-mark">Siisti piha</p>
        <h1>Apukutsut</h1>
        <p className="lede">Yllättävä tarve — ilmoittaudu, kun minimi täyttyy tehtävä aktivoituu.</p>
      </header>

      {error && <p className="error">{error}</p>}

      {pushSupported && (
        <section className="notice-strip">
          <div>
            <strong>Push-ilmoitukset</strong>
            <p>
              {pushOn
                ? 'Päällä — uudet apukutsut tulevat myös sovelluksen ulkopuolelle'
                : 'Pois — ota käyttöön, jotta et missaa kutsuja'}
            </p>
            {pushMsg && <p className="hint">{pushMsg}</p>}
          </div>
          <button
            className="btn ghost small"
            type="button"
            disabled={pushBusy}
            onClick={() => void togglePush()}
          >
            {pushBusy ? '…' : pushOn ? 'Poista' : 'Ota käyttöön'}
          </button>
        </section>
      )}

      {!pushSupported && (
        <p className="hint">
          {import.meta.env.VITE_DATA_MODE === 'local'
            ? 'Push-ilmoitukset eivät ole käytössä tässä demossa — uudet kutsut näkyvät Ilmo-välilehdellä.'
            : 'Push-ilmoitukset vaativat modernin selaimen. iPhonella: Lisää Koti-valikkoon, avaa siitä ja salli ilmoitukset.'}
        </p>
      )}

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
          Apukutsun voi luoda ylläpitäjä tai julkaistun viikon vastuuhenkilö.
        </p>
      )}

      <div className="card-list">
        {tasks.map((t) => {
          const isCreator = t.createdByUserId === user?.id || user?.role === 'admin'
          return (
            <article key={t.id} className="notice-card">
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
                    className="btn small"
                    disabled={busyId === t.id}
                    onClick={() => void act(t.id, 'cancel')}
                  >
                    Peruuta kutsu
                  </button>
                )}
              </div>
            </article>
          )
        })}
        {!tasks.length && <p className="muted">Ei apukutsuja vielä.</p>}
      </div>
    </div>
  )
}
