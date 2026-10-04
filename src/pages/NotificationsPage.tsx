import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type AppNotification } from '../api'
import { useAuth } from '../auth'
import { PrivacyNotice } from '../components/PrivacyNotice'
import { PushToggle } from '../components/PushToggle'
import { formatDateTimeFi } from '../shared/datetime'
import { onServiceWorkerPush, startLiveRefresh } from '../shared/liveRefresh'

function formatWhen(iso: string) {
  return formatDateTimeFi(iso)
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
  const { user } = useAuth()
  const [items, setItems] = useState<AppNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [privacyOpen, setPrivacyOpen] = useState(false)

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
    const refresh = () => {
      load().catch((e) => setError(e instanceof Error ? e.message : 'Lataus epäonnistui'))
    }
    const stopRefresh = startLiveRefresh(refresh, 15_000)
    const stopPush = onServiceWorkerPush(() => refresh())
    return () => {
      stopRefresh()
      stopPush()
    }
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

  async function wipeAll() {
    if (!window.confirm('Poistetaanko KAIKKI ilmoitukset kaikilta käyttäjiltä? Tätä ei voi perua.')) {
      return
    }
    if (!window.confirm('Vahvista vielä kerran: poista kaikki ilmoitukset.')) return
    setBusy(true)
    setError('')
    try {
      await api('/api/notifications', { method: 'DELETE' })
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Poisto epäonnistui')
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
        {user?.role === 'admin' && items.length > 0 && (
          <button
            className="btn ghost small"
            type="button"
            disabled={busy}
            onClick={() => void wipeAll()}
          >
            Poista kaikki
          </button>
        )}
      </header>

      <PushToggle />

      <section className="panel privacy-ilmo-link">
        <button type="button" className="quick-link" onClick={() => setPrivacyOpen(true)}>
          <span className="quick-link-text">
            <strong>Tietosuojaseloste</strong>
            <span>Miten henkilötietoja käsitellään tässä sovelluksessa</span>
          </span>
          <span className="quick-link-action">Avaa</span>
        </button>
      </section>

      <PrivacyNotice open={privacyOpen} mode="readonly" onClose={() => setPrivacyOpen(false)} />

      {error && <p className="error">{error}</p>}

      {items.length === 0 ? (
        <p className="empty-state">
          Ei ilmoituksia vielä. Sää ja apukutsut ilmestyvät tänne. Chat-viestit näkyvät
          chat-kuvakkeen punaisessa merkissä.
        </p>
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
