import { useEffect, useState, type FormEvent } from 'react'
import { api, type Notice } from '../api'
import { useAuth } from '../auth'

export function NoticesPage() {
  const { user } = useAuth()
  const [notices, setNotices] = useState<Notice[]>([])
  const [body, setBody] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [error, setError] = useState('')
  const [replyFor, setReplyFor] = useState<string | null>(null)
  const [replyBody, setReplyBody] = useState('')

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
    const fd = new FormData()
    fd.append('body', body)
    if (photo) fd.append('photo', photo)
    try {
      await api('/api/notices', { method: 'POST', formData: fd })
      setBody('')
      setPhoto(null)
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
    await api(`/api/notices/${id}`, { method: 'PATCH', json: { status: 'resolved' } })
    await load()
  }

  return (
    <div className="page">
      <header className="page-hero compact">
        <p className="brand-mark">Siisti salin piha</p>
        <h1>Huomiot</h1>
        <p className="lede">Ilmoita viat ja havainnot — kuva mukaan.</p>
      </header>

      {error && <p className="error">{error}</p>}

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
          <button className="btn primary" type="submit">
            Lähetä kaikille
          </button>
        </form>
      </section>

      <div className="card-list">
        {notices.map((n) => (
          <article key={n.id} className="notice-card">
            <div className="week-card-top">
              <strong>{n.authorName}</strong>
              <span className={`pill status-${n.status}`}>
                {n.status === 'open' ? 'Avoin' : n.status === 'in_progress' ? 'Hoidossa' : 'Ratkaistu'}
              </span>
            </div>
            <p>{n.body}</p>
            {n.photoUrl && (
              <img className="notice-photo" src={n.photoUrl} alt="Huomion kuva" />
            )}
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
                  </>
                )}
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  )
}
