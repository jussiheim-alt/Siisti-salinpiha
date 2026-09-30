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
        <div className="notif-strip-title">
          <span className="notif-bell" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 3.5c-2.8 0-5 2.1-5 4.8v2.2c0 .7-.2 1.4-.6 2L5.2 14a1 1 0 0 0 .8 1.6h12a1 1 0 0 0 .8-1.6l-1.2-1.5c-.4-.6-.6-1.3-.6-2V8.3c0-2.7-2.2-4.8-5-4.8Z"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinejoin="round"
              />
              <path
                d="M10 17.2a2 2 0 0 0 4 0"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
              />
            </svg>
          </span>
          <div>
            <p className="kicker">Ilmoitukset</p>
            <p className="notif-strip-sub">
              {unreadCount > 0
                ? `${unreadCount} lukematonta`
                : items.length > 0
                  ? 'Ajantasalla'
                  : 'Ei uusia ilmoituksia'}
            </p>
          </div>
        </div>
        <Link className="btn ghost small" to="/ilmoitukset">
          Avaa
        </Link>
      </div>
      {items.length > 0 && (
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
