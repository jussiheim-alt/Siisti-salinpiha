import { Link } from 'react-router-dom'
import { api, type AppNotification } from '../api'

export function NotificationStrip({
  items,
  unreadCount,
}: {
  items: AppNotification[]
  unreadCount: number
}) {
  return (
    <section className="notif-strip" aria-label="Ilmoitukset">
      <div className="notif-strip-head">
        <p className="kicker">
          Ilmoitukset
          {unreadCount > 0 ? ` · ${unreadCount} uutta` : ''}
        </p>
        <Link className="btn ghost small" to="/ilmoitukset">
          Avaa
        </Link>
      </div>
      {items.length === 0 ? (
        <p className="muted" style={{ margin: 0 }}>
          Ei uusia ilmoituksia.
        </p>
      ) : (
        <ul className="notif-preview">
          {items.slice(0, 3).map((n) => (
            <li key={n.id} className={n.readAt ? undefined : 'unread'}>
              <Link
                to={n.link || '/ilmoitukset'}
                onClick={() => {
                  if (!n.readAt) {
                    void api(`/api/notifications/${n.id}/read`, { method: 'POST' }).catch(
                      () => undefined,
                    )
                  }
                }}
              >
                <strong>{n.title}</strong>
                <span>{n.body}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
