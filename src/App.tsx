import { useEffect, useState } from 'react'
import { Navigate, NavLink, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { api } from './api'
import { AuthProvider, useAuth } from './auth'
import { ShiftChatFab } from './components/ShiftChatFab'
import { AdminHubPage } from './pages/AdminHubPage'
import { AppSettingsPage } from './pages/AppSettingsPage'
import { AvailabilityPage } from './pages/AvailabilityPage'
import { CalendarPage } from './pages/CalendarPage'
import { ExtraTasksPage } from './pages/ExtraTasksPage'
import { HomePage } from './pages/HomePage'
import { HubDetailPage } from './pages/HubDetailPage'
import { HubPage } from './pages/HubPage'
import { InviteAcceptPage } from './pages/InviteAcceptPage'
import { LoginPage } from './pages/LoginPage'
import { NoticesPage } from './pages/NoticesPage'
import { NotificationsPage } from './pages/NotificationsPage'
import { PihavuoroPage } from './pages/PihavuoroPage'
import { SwapsPage } from './pages/SwapsPage'
import { LeadGuideAdminPage } from './pages/LeadGuideAdminPage'
import { TaskCardsPage } from './pages/TaskCardsPage'
import { UserGuidePage } from './pages/UserGuidePage'
import { UsersPage } from './pages/UsersPage'
import { onServiceWorkerPush, startLiveRefresh } from './shared/liveRefresh'

function IconHome() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" />
    </svg>
  )
}
function IconCal() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M8 3.5v3M16 3.5v3M3.5 9.5h17" />
    </svg>
  )
}
function IconHelp() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 21a9 9 0 1 0-9-9 9 9 0 0 0 9 9Z" />
      <path d="M9.5 10a2.5 2.5 0 1 1 3.8 2.1c-.7.5-1.3 1-1.3 2" />
      <path d="M12 17h.01" />
    </svg>
  )
}
function IconBell() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 16.5h12l-1.2-1.8V10a4.8 4.8 0 1 0-9.6 0v4.7L6 16.5Z" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </svg>
  )
}
function IconNote() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 4.5h10A1.5 1.5 0 0 1 18.5 6v14L12 16.5 5.5 20V6A1.5 1.5 0 0 1 7 4.5Z" />
      <path d="M9 8.5h6M9 11.5h6" />
    </svg>
  )
}
function IconAdmin() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6.1 6.1l1.6 1.6M16.3 16.3l1.6 1.6M6.1 17.9l1.6-1.6M16.3 7.7l1.6-1.6" />
    </svg>
  )
}
function IconOut() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M10 5H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4" />
      <path d="M14 12H8M14 12l3-3M14 12l3 3" />
    </svg>
  )
}

function Shell() {
  const { user, logout, loading } = useAuth()
  const location = useLocation()
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    const load = () => {
      api<{ unreadCount: number }>('/api/notifications')
        .then((d) => {
          if (!cancelled) setUnread(d.unreadCount)
        })
        .catch(() => undefined)
    }
    const stopRefresh = startLiveRefresh(load, 15_000)
    const stopPush = onServiceWorkerPush(() => load())
    return () => {
      cancelled = true
      stopRefresh()
      stopPush()
    }
  }, [user, location.pathname])

  if (loading) return <div className="boot">Ladataan…</div>
  if (!user) return <Navigate to="/kirjaudu" replace />

  const cols = user.role === 'admin' ? 7 : 6
  const adminSectionActive =
    location.pathname.startsWith('/yllapitaja') ||
    location.pathname.startsWith('/kayttajat') ||
    location.pathname.startsWith('/vastuuohjeet') ||
    location.pathname.startsWith('/asetukset') ||
    location.pathname.startsWith('/tehtavat') ||
    location.pathname.startsWith('/huolto')

  return (
    <div className="app-shell app-shell-bottom-nav">
      <main className="app-main">
        <Outlet />
      </main>
      <nav
        className={`tabbar tabbar-bottom${user.role === 'admin' ? ' tabbar-admin' : ''}`}
        aria-label="Päänavigaatio"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        <NavLink to="/" end>
          <IconHome />
          <span className="tab-label">Etusivu</span>
        </NavLink>
        <NavLink to="/kalenteri">
          <IconCal />
          <span className="tab-label">Vuorot</span>
        </NavLink>
        <NavLink to="/apukutsut">
          <IconHelp />
          <span className="tab-label">Apu</span>
        </NavLink>
        <NavLink to="/ilmoitukset" className="tab-with-badge">
          <span className="tab-icon-wrap">
            <IconBell />
            {unread > 0 && (
              <span className="nav-badge" aria-label={`${unread} lukematonta`}>
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </span>
          <span className="tab-label">Ilmo</span>
        </NavLink>
        <NavLink to="/huomiot">
          <IconNote />
          <span className="tab-label">Huomiot</span>
        </NavLink>
        {user.role === 'admin' && (
          <NavLink
            to="/yllapitaja"
            className={({ isActive }) => (isActive || adminSectionActive ? 'active' : undefined)}
          >
            <IconAdmin />
            <span className="tab-label">Ylläpito</span>
          </NavLink>
        )}
        <button type="button" className="tab-logout" onClick={() => void logout()}>
          <IconOut />
          <span className="tab-label">Ulos</span>
        </button>
      </nav>
      <ShiftChatFab />
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/kirjaudu" element={<LoginPage />} />
        <Route path="/kutsu/:token" element={<InviteAcceptPage />} />
        <Route element={<Shell />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/kalenteri" element={<CalendarPage />} />
          <Route path="/pihavuoro/:id" element={<PihavuoroPage />} />
          <Route path="/apukutsut" element={<ExtraTasksPage />} />
          <Route path="/huomiot" element={<NoticesPage />} />
          <Route path="/ilmoitukset" element={<NotificationsPage />} />
          <Route path="/huolto" element={<HubPage />} />
          <Route path="/huolto/:id" element={<HubDetailPage />} />
          <Route path="/yllapitaja" element={<AdminHubPage />} />
          <Route path="/kayttajat" element={<UsersPage />} />
          <Route path="/tehtavat" element={<TaskCardsPage />} />
          <Route path="/vastuuohjeet" element={<LeadGuideAdminPage />} />
          <Route path="/asetukset" element={<AppSettingsPage />} />
          <Route path="/kaytettavyys" element={<AvailabilityPage />} />
          <Route path="/esteet" element={<Navigate to="/kaytettavyys" replace />} />
          <Route path="/vaihdot" element={<SwapsPage />} />
          <Route path="/ohjeet" element={<UserGuidePage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}
