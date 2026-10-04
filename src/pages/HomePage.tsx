import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type AppNotification, type Pihavuoro, type WeatherPayload } from '../api'
import { useAuth } from '../auth'
import { HomeShiftPanel } from '../components/HomeShiftPanel'
import { LeadCallout } from '../components/LeadCallout'
import { NotificationStrip } from '../components/NotificationStrip'
import { PushToggle } from '../components/PushToggle'
import { WeatherStrip } from '../components/WeatherStrip'

function QuickLink({
  title,
  body,
  to,
  action = 'Avaa',
}: {
  title: string
  body: string
  to: string
  action?: string
}) {
  return (
    <Link className="quick-link" to={to}>
      <span className="quick-link-text">
        <strong>{title}</strong>
        <span>{body}</span>
      </span>
      <span className="quick-link-action">{action}</span>
    </Link>
  )
}

export function HomePage() {
  const { user } = useAuth()
  const [next, setNext] = useState<Pihavuoro | null>(null)
  const [openNotices, setOpenNotices] = useState(0)
  const [openExtras, setOpenExtras] = useState(0)
  const [weather, setWeather] = useState<WeatherPayload | null>(null)
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [unreadNotifications, setUnreadNotifications] = useState(0)
  const [blockedCount, setBlockedCount] = useState(0)
  const [error, setError] = useState('')

  useEffect(() => {
    api<{
      nextPihavuoro: Pihavuoro | null
      openNotices: number
      openExtraTasks: number
      weather: WeatherPayload | null
      recentNotifications: AppNotification[]
      unreadNotifications: number
      availability?: { weeksAhead: number; blockedCount: number }
    }>('/api/home')
      .then((d) => {
        setNext(d.nextPihavuoro)
        setOpenNotices(d.openNotices)
        setOpenExtras(d.openExtraTasks)
        setWeather(d.weather)
        setNotifications(d.recentNotifications || [])
        setUnreadNotifications(d.unreadNotifications || 0)
        setBlockedCount(d.availability?.blockedCount ?? 0)
      })
      .catch((e) => setError(e.message))
  }, [])

  const myAssignment = next?.assignments.find((a) => a.userId === user?.id)
  const isLead = myAssignment?.role === 'lead'
  const firstName = user?.name.split(' ')[0]

  return (
    <div className="page home-page">
      <header className="page-hero home-hero">
        <p className="brand-mark">Siisti salin piha</p>
        <h1>
          {isLead
            ? 'Olet viikon vastuuveli'
            : next
              ? 'Seuraava vuorosi odottaa'
              : `Hei, ${firstName}`}
        </h1>
        <p className="lede">
          {isLead
            ? 'Sinulla on vastuu viikon töistä — katso ohjeet alta.'
            : next
              ? 'Katso tehtävät, kokoonpano ja kuittaa työt viikon aikana.'
              : 'Kun Pihavuoro julkaistaan, se näkyy tässä.'}
        </p>
        <div className="hero-cta">
          {next ? (
            <Link className="btn primary on-dark" to={`/pihavuoro/${next.id}`}>
              Avaa Pihavuoro
            </Link>
          ) : user?.role === 'admin' ? (
            <Link className="btn primary on-dark" to="/kalenteri">
              Luo viikko kalenterissa
            </Link>
          ) : (
            <Link className="btn primary on-dark" to="/kalenteri">
              Katso kalenteri
            </Link>
          )}
        </div>
      </header>

      {error && <p className="error">{error}</p>}

      <div className="home-stack">
        {next && isLead && (
          <LeadCallout
            weekStart={next.weekStart}
            weekEnd={next.weekEnd}
            pihavuoroId={next.id}
          />
        )}

        <PushToggle hideWhenEnabled />

        <div className="surface-card" style={{ animationDelay: '0.05s' }}>
          <NotificationStrip items={notifications} unreadCount={unreadNotifications} />
        </div>

        {weather && (
          <div className="surface-card" style={{ animationDelay: '0.1s' }}>
            <WeatherStrip weather={weather} />
          </div>
        )}

        {next && (
          <HomeShiftPanel
            pihavuoro={next}
            role={myAssignment?.role ?? null}
            showCalendar={Boolean(myAssignment)}
          />
        )}

        <section className="surface-card quick-grid" style={{ animationDelay: '0.18s' }}>
          <p className="kicker">Pikavalinnat</p>
          <div className="quick-list">
            <QuickLink
              title="Käyttöohje"
              body="Näin käytät sovellusta puhelimella"
              to="/ohjeet"
              action="Avaa"
            />
            <QuickLink
              title="Käytettävyys"
              body={
                blockedCount === 0
                  ? 'Ei merkittyjä esteitä'
                  : `${blockedCount} estettyä viikkoa`
              }
              to="/kaytettavyys"
              action="Muokkaa"
            />
            <QuickLink
              title="Apukutsut"
              body={openExtras === 0 ? 'Ei avoimia apukutsuja' : `${openExtras} avointa`}
              to="/apukutsut"
            />
            <QuickLink
              title="Huomiot"
              body={openNotices === 0 ? 'Ei avoimia huomioita' : `${openNotices} avointa`}
              to="/huomiot"
            />
          </div>
        </section>
      </div>
    </div>
  )
}
