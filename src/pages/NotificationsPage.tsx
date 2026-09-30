import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type AppNotification } from '../api'

function formatWhen(iso: string) {
  try {
    return new Intl.DateTimeFormat('fi-FI', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

function kindLabel(kind: string) {
  if (kind === 'weather' || kind === 'weather-cap') return 'Sää'
  if (kind === 'extra') return 'Apu'
  if (kind === 'notice') return 'Huomio'
  if (kind === 'hub') return 'Hub'
  if (kind === 'shift') return 'Vuoro'
  return 'Ilmoitus'
}

export function NotificationsPage() {
  const [items, setItems] = useState<AppNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function load() {
    const data = await api<{
      unreadCount: number
      items?: AppNotification[]
      notifications?: AppNotification[]
    }>('/api/notifications')
    setItems(data.items ?? data.notifications ?? [])
    setUnreadCount(data.unreadCount ?? 0)
  }

  useEffect(() => {
    load().catch((e) => setError(e.message))
  }, [])

  async function markAll() {
    setBusy(true)
    setError('')
    try {
      await api('/api/notifications/read-all', { method: 'POST' })
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Merkintä epäonnistui')
    } finally {
      setBusy(false)
    }
  }

  async function openItem(n: AppNotification) {
    if (!n.readAt) {
      await api(`/api/notifications/${n.id}/read`, { method: 'POST' }).catch(() => undefined)
      setItems((prev) =>
        prev.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)),
      )
      setUnreadCount((c) => Math.max(0, c - 1))
    }
  }

  return (
    <div className="page">
      <header className="page-hero compact">
        <p className="brand-mark">Siisti salin piha</p>
        <h1>Ilmoitukset</h1>
        <p className="lede">
          {unreadCount === 0
            ? 'Kaikki ilmoitukset on luettu.'
            : `${unreadCount} lukematonta — sää, apukutsut ja muut.`}
        </p>
        {unreadCount > 0 && (
          <button
            className="btn ghost small"
            type="button"
            disabled={busy}
            onClick={() => void markAll()}
          >
            Merkitse luetuiksi
          </button>
        )}
      </header>

      {error && <p className="error">{error}</p>}

      {items.length === 0 ? (
        <p className="empty-state">Ei ilmoituksia vielä. Uudet sää- ja apukutsut ilmestyvät tänne.</p>
      ) : (
        <ul className="notif-list">
          {items.map((n) => (
            <li key={n.id} className={n.readAt ? 'read' : 'unread'}>
              {n.link ? (
                <Link to={n.link} onClick={() => void openItem(n)}>
                  <span className="notif-kind">{kindLabel(n.kind)}</span>
                  <strong>{n.title}</strong>
                  <span>{n.body}</span>
                  <em>{formatWhen(n.createdAt)}</em>
                </Link>
              ) : (
                <button type="button" onClick={() => void openItem(n)}>
                  <span className="notif-kind">{kindLabel(n.kind)}</span>
                  <strong>{n.title}</strong>
                  <span>{n.body}</span>
                  <em>{formatWhen(n.createdAt)}</em>
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
