import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type AppNotification, type HubSummary, type Pihavuoro, type WeatherPayload } from '../api'
import { useAuth } from '../auth'
import { NotificationStrip } from '../components/NotificationStrip'
import { WeatherStrip } from '../components/WeatherStrip'

export function HomePage() {
  const { user } = useAuth()
  const [next, setNext] = useState<Pihavuoro | null>(null)
  const [openNotices, setOpenNotices] = useState(0)
  const [openExtras, setOpenExtras] = useState(0)
  const [weather, setWeather] = useState<WeatherPayload | null>(null)
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [unreadNotifications, setUnreadNotifications] = useState(0)
  const [hub, setHub] = useState<HubSummary | null>(null)
  const [blockedCount, setBlockedCount] = useState(0)
  const [swapsAvailable, setSwapsAvailable] = useState(0)
  const [myOpenSwaps, setMyOpenSwaps] = useState(0)
  const [error, setError] = useState('')

  useEffect(() => {
    api<{
      nextPihavuoro: Pihavuoro | null
      openNotices: number
      openExtraTasks: number
      weather: WeatherPayload | null
      recentNotifications: AppNotification[]
      unreadNotifications: number
      hub: HubSummary
      availability?: { weeksAhead: number; blockedCount: number }
      swaps?: { availableCount: number; myOpenCount: number }
    }>('/api/home')
      .then((d) => {
        setNext(d.nextPihavuoro)
        setOpenNotices(d.openNotices)
        setOpenExtras(d.openExtraTasks)
        setWeather(d.weather)
        setNotifications(d.recentNotifications || [])
        setUnreadNotifications(d.unreadNotifications || 0)
        setHub(d.hub || null)
        setBlockedCount(d.availability?.blockedCount ?? 0)
        setSwapsAvailable(d.swaps?.availableCount ?? 0)
        setMyOpenSwaps(d.swaps?.myOpenCount ?? 0)
      })
      .catch((e) => setError(e.message))
  }, [])

  const myAssignment = next?.assignments.find((a) => a.userId === user?.id)
  const openTasks = next?.tasks.filter((t) => t.status === 'open') ?? []
  const firstName = user?.name.split(' ')[0]

  return (
    <div className="page">
      <header className="page-hero home-hero">
        <p className="brand-mark">Siisti salin piha</p>
        <h1>{next ? 'Seuraava vuorosi odottaa' : `Hei, ${firstName}`}</h1>
        <p className="lede">
          {next
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
        <NotificationStrip items={notifications} unreadCount={unreadNotifications} />

        {weather && <WeatherStrip weather={weather} />}

        {next && (
          <section className="home-shift">
            <p className="kicker">Pihavuoro</p>
            <p className="week-line">
              {next.weekStart} – {next.weekEnd}
            </p>
            <p className="role-line">
              {next.season === 'talvi' ? 'Talvi' : 'Sulankausi'}
              {myAssignment
                ? ` · ${myAssignment.role === 'lead' ? 'vastuuhenkilö' : 'avustaja'}`
                : ''}
              {openTasks.length ? ` · ${openTasks.length} avointa tehtävää` : ''}
            </p>
            {openTasks.length > 0 && (
              <ul className="task-preview">
                {openTasks.slice(0, 3).map((t) => (
                  <li key={t.id}>
                    {t.title}
                    {t.effort === 'heavy' ? ' · raskas' : ''}
                  </li>
                ))}
              </ul>
            )}
            {myAssignment && (
              <p className="muted" style={{ marginTop: '0.65rem' }}>
                Vuorokeskustelu aukeaa chat-painikkeesta oikeassa alakulmassa.
              </p>
            )}
          </section>
        )}

        <section className="notice-strip">
          <div>
            <strong>Esteviikot</strong>
            <p>
              {blockedCount === 0
                ? 'Ei merkittyjä esteitä seuraaville viikoille'
                : `${blockedCount} estettyä viikkoa merkitty`}
            </p>
          </div>
          <Link className="btn ghost small" to="/esteet">
            Muokkaa
          </Link>
        </section>

        <section className="notice-strip">
          <div>
            <strong>Vuoronvaihdot</strong>
            <p>
              {swapsAvailable === 0 && myOpenSwaps === 0
                ? 'Ei avoimia vaihtoja'
                : [
                    swapsAvailable ? `${swapsAvailable} tarjolla` : null,
                    myOpenSwaps ? `${myOpenSwaps} omaa tarjousta` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
            </p>
          </div>
          <Link className="btn ghost small" to="/vaihdot">
            Avaa
          </Link>
        </section>

        <section className="notice-strip">
          <div>
            <strong>Hub-huolto</strong>
            <p>
              {hub
                ? hub.openCount === 0
                  ? 'Kaikki vuositarkastukset tehty'
                  : `${hub.openCount} avointa · ${hub.dueCount} ajankohtaista`
                : 'Vuositarkastukset'}
            </p>
          </div>
          <Link className="btn ghost small" to="/huolto">
            Avaa
          </Link>
        </section>

        <section className="notice-strip">
          <div>
            <strong>Apukutsut</strong>
            <p>
              {openExtras === 0 ? 'Ei avoimia apukutsuja' : `${openExtras} avointa apukutsua`}
            </p>
          </div>
          <Link className="btn ghost small" to="/apukutsut">
            Avaa
          </Link>
        </section>

        <section className="notice-strip">
          <div>
            <strong>Huomiot</strong>
            <p>
              {openNotices === 0
                ? 'Ei avoimia huomioita'
                : `${openNotices} avointa huomioita`}
            </p>
          </div>
          <Link className="btn ghost small" to="/huomiot">
            Avaa
          </Link>
        </section>
      </div>
    </div>
  )
}
