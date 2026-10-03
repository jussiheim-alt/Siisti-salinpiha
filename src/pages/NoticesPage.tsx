import { useEffect, useState, type FormEvent } from 'react'
import { api, type Notice } from '../api'
import { useAuth } from '../auth'

export function NoticesPage() {
  const { user } = useAuth()
  const [notices, setNotices] = useState<Notice[]>([])
  const [body, setBody] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [audience, setAudience] = useState<'all' | 'leads'>('all')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [replyFor, setReplyFor] = useState<string | null>(null)
  const [replyBody, setReplyBody] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  async function load() {
    const data = await api<{ notices: Notice[] }>('/api/notices')
    setNotices(data.notices)
  }

  useEffect(() => {
    load().catch((e) => setError(e.message))
  }, [])

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    setError('')
    setInfo('')
    const fd = new FormData()
    fd.append('body', body)
    fd.append('audience', audience)
    if (photo) fd.append('photo', photo)
    try {
      await api('/api/notices', { method: 'POST', formData: fd })
      setBody('')
      setPhoto(null)
      setInfo('Huomio lähetetty')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lähetys epäonnistui')
    }
  }

  async function sendReply(noticeId: string) {
    try {
      await api(`/api/notices/${noticeId}/replies`, {
        method: 'POST',
        json: { body: replyBody, status: 'in_progress' },
      })
      setReplyBody('')
      setReplyFor(null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Vastaus epäonnistui')
    }
  }

  async function resolve(id: string) {
    if (!window.confirm('Merkitäänkö huomio ratkaistuksi?')) return
    await api(`/api/notices/${id}`, { method: 'PATCH', json: { status: 'resolved' } })
    await load()
  }

  async function acknowledge(id: string) {
    setBusyId(id)
    setError('')
    try {
      await api(`/api/notices/${id}/ack`, { method: 'POST', json: {} })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kuittaus epäonnistui')
    } finally {
      setBusyId(null)
    }
  }

  async function removeNotice(id: string) {
    if (!window.confirm('Poistetaanko tämä huomio? Tätä ei voi perua.')) return
    if (!window.confirm('Vahvista poisto vielä kerran.')) return
    try {
      await api(`/api/notices/${id}`, { method: 'DELETE' })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Poisto epäonnistui')
    }
  }

  return (
    <div className="page">
      <header className="page-hero compact">
        <p className="brand-mark">Siisti salin piha</p>
        <h1>Huomiot</h1>
        <p className="lede">Ilmoita viat ja havainnot — kuva mukaan.</p>
      </header>

      {error && <p className="error">{error}</p>}
      {info && <p className="hint success-hint">{info}</p>}

      <section className="panel">
        <h2>Uusi huomio</h2>
        <form className="stack" onSubmit={onCreate}>
          <label>
            Viesti
            <textarea value={body} onChange={(e) => setBody(e.target.value)} required rows={3} />
          </label>
          <label>
            Valokuva (valinnainen)
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => setPhoto(e.target.files?.[0] || null)}
            />
          </label>
          <fieldset className="audience-fieldset">
            <legend>Kenelle</legend>
            <label className="check-row">
              <input
                type="radio"
                name="audience"
                checked={audience === 'all'}
                onChange={() => setAudience('all')}
              />
              Lähetä kaikille
            </label>
            <label className="check-row">
              <input
                type="radio"
                name="audience"
                checked={audience === 'leads'}
                onChange={() => setAudience('leads')}
              />
              Lähetä vastuuveljille
            </label>
            <p className="hint">
              Vastuuveljille = ylläpitäjät ja viikkovuoron vastuuveli (asiat jotka eivät vaadi kaikkia).
            </p>
          </fieldset>
          <button className="btn primary" type="submit">
            Lähetä
          </button>
        </form>
      </section>

      <div className="card-list">
        {notices.map((n) => {
          const isAuthor = n.authorUserId === user?.id
          const ackText =
            n.acknowledgedAt &&
            (isAuthor || user?.role === 'admin')
              ? 'Kiitos huomiostasi, veljet ovat vastaanottaneet sen'
              : null
          return (
            <article key={n.id} className="notice-card">
              <div className="week-card-top">
                <strong>{n.authorName}</strong>
                <span className={`pill status-${n.status}`}>
                  {n.acknowledgedAt
                    ? 'Vastaanotettu'
                    : n.status === 'open'
                      ? 'Avoin'
                      : n.status === 'in_progress'
                        ? 'Hoidossa'
                        : 'Ratkaistu'}
                </span>
              </div>
              <p className="meta">
                {(n.audience || 'all') === 'leads' ? 'Vastuuveljille' : 'Kaikille'}
              </p>
              <p>{n.body}</p>
              {n.photoUrl && (
                <img className="notice-photo" src={n.photoUrl} alt="Huomion kuva" />
              )}
              {ackText && <p className="ack-banner">{ackText}</p>}
              <p className="muted">{new Date(n.createdAt).toLocaleString('fi-FI')}</p>
              {n.replies.length > 0 && (
                <ul className="replies">
                  {n.replies.map((r) => (
                    <li key={r.id}>
                      <strong>{r.authorName}:</strong> {r.body}
                    </li>
                  ))}
                </ul>
              )}
              {user?.role === 'admin' && n.status !== 'resolved' && (
                <div className="row-actions">
                  {!n.acknowledgedAt && (
                    <button
                      className="btn primary small"
                      disabled={busyId === n.id}
                      onClick={() => void acknowledge(n.id)}
                    >
                      Kuittaa vastaanotetuksi
                    </button>
                  )}
                  {replyFor === n.id ? (
                    <div className="stack grow">
                      <textarea
                        rows={2}
                        value={replyBody}
                        onChange={(e) => setReplyBody(e.target.value)}
                        placeholder="Vastaus…"
                      />
                      <div className="row-actions">
                        <button className="btn primary small" onClick={() => void sendReply(n.id)}>
                          Lähetä vastaus
                        </button>
                        <button className="btn small" onClick={() => setReplyFor(null)}>
                          Peru
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <button className="btn small" onClick={() => setReplyFor(n.id)}>
                        Vastaa
                      </button>
                      <button className="btn small" onClick={() => void resolve(n.id)}>
                        Merkitse ratkaistuksi
                      </button>
                      <button className="btn small" onClick={() => void removeNotice(n.id)}>
                        Poista
                      </button>
                    </>
                  )}
                </div>
              )}
            </article>
          )
        })}
      </div>
    </div>
  )
}
