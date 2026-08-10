import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { dismissToast, setTheme } from '@/features/ui/uiSlice'
import { UniversityLogo } from './UniversityLogo'
import {
  BackIcon,
  BellIcon,
  MoonIcon,
  SunIcon,
  CommunityIcon,
  HomeIcon,
  OfflineIcon,
  ProfileIcon,
  SearchIcon,
  SettingsIcon,
  ToolsIcon,
} from './icons'

const TABS = [
  { to: '/', label: 'Home', Icon: HomeIcon, end: true },
  { to: '/search', label: 'Search', Icon: SearchIcon, end: false },
  { to: '/community', label: 'Community', Icon: CommunityIcon, end: false },
  { to: '/tools', label: 'Tools', Icon: ToolsIcon, end: false },
  { to: '/profile', label: 'Profile', Icon: ProfileIcon, end: false },
]

/** Routes that get a back arrow rather than the greeting header. */
const TITLES: Record<string, string> = {
  '/search': 'Find resources',
  '/community': 'Community',
  '/tools': 'Library tools',
  '/profile': 'My profile',
  '/rewards': 'Spend your XP',
  '/notifications': 'Notifications',
  '/settings': 'Settings',
  '/tools/spaces': 'Study spaces',
  '/tools/librarian': 'Ask a librarian',
  '/tools/map': 'Library map',
  '/tools/help': 'Help & FAQs',
}

function ToastHost() {
  const dispatch = useAppDispatch()
  const toasts = useAppSelector((state) => state.ui.toasts)

  useEffect(() => {
    if (!toasts.length) return
    const timers = toasts.map((t) => setTimeout(() => dispatch(dismissToast(t.id)), 3600))
    return () => timers.forEach(clearTimeout)
  }, [toasts, dispatch])

  if (!toasts.length) return null

  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast--${t.tone}`}>
          {t.xp ? <span className="toast__xp">+{t.xp}</span> : null}
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  )
}

/**
 * What the user is actually looking at right now. `system` follows the device,
 * so the toggle has to resolve it before deciding which way to flip.
 */
function useResolvedTheme(): 'light' | 'dark' {
  const preference = useAppSelector((state) => state.ui.theme)
  const [systemDark, setSystemDark] = useState(
    () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches,
  )

  useEffect(() => {
    const query = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!query) return
    const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  if (preference === 'system') return systemDark ? 'dark' : 'light'
  return preference
}

export function AppShell() {
  const location = useLocation()
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const resolvedTheme = useResolvedTheme()
  const user = useAppSelector((state) => state.auth.user)
  const unread = useAppSelector((state) => state.notifications.items.filter((n) => !n.read).length)
  const online = useAppSelector((state) => state.ui.online)
  const queued = useAppSelector((state) => state.ui.queue.length)
  const syncing = useAppSelector((state) => state.ui.syncing)

  const isDetail = location.pathname.startsWith('/resource/') || location.pathname.split('/').length > 2
  const title = TITLES[location.pathname] ?? (isDetail ? 'Resource' : 'REACH')
  const isHome = location.pathname === '/'

  /**
   * Every navigation starts at the top of the new screen — unless it carries an
   * anchor, which is how the profile screen links straight to one group of
   * settings rather than dropping you at the top of a long page to hunt.
   */
  useEffect(() => {
    if (location.hash) {
      const target = document.getElementById(location.hash.slice(1))
      if (target) {
        target.scrollIntoView?.({ block: 'start', behavior: 'instant' as ScrollBehavior })
        return
      }
    }
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }, [location.pathname, location.hash])

  return (
    <div className="shell">
      <a className="skip-link" href="#main">
        Skip to main content
      </a>

      <header className="topbar">
        {isDetail ? (
          <button type="button" className="topbar__action" onClick={() => navigate(-1)} aria-label="Go back">
            <BackIcon size={20} />
          </button>
        ) : (
          <UniversityLogo size={34} className="topbar__logo" />
        )}

        <div className="topbar__title">
          {isHome ? (
            <>
              Hello, {user?.name.split(' ')[0] ?? 'there'}
              <span className="topbar__sub">
                {user?.department ?? 'University of Jos Library'}
              </span>
            </>
          ) : (
            title
          )}
        </div>

        <button
          type="button"
          className="topbar__action"
          aria-label={resolvedTheme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          onClick={() => dispatch(setTheme(resolvedTheme === 'dark' ? 'light' : 'dark'))}
        >
          {resolvedTheme === 'dark' ? <SunIcon size={20} /> : <MoonIcon size={20} />}
        </button>

        <NavLink to="/notifications" className="topbar__action" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}>
          <BellIcon size={20} />
          {unread > 0 ? <span className="badge-dot">{unread > 9 ? '9+' : unread}</span> : null}
        </NavLink>
      </header>

      {!online ? (
        <div className="banner" role="status">
          <OfflineIcon size={16} />
          Offline — showing your saved library. {queued > 0 ? `${queued} action${queued === 1 ? '' : 's'} queued.` : ''}
        </div>
      ) : syncing ? (
        <div className="banner banner--sync" role="status">
          Syncing your offline activity…
        </div>
      ) : null}

      <main className="shell__main" id="main">
        <Outlet />
      </main>

      <nav className="tabbar" aria-label="Primary">
        {/* The sidebar identifies the app on desktop, where there is room for
            it; on mobile the bar is icons only and this is hidden. */}
        <div className="tabbar__brand" aria-hidden="true">
          <UniversityLogo size={34} />
          <span>
            <strong>REACH</strong>
            University of Jos Library
          </span>
        </div>

        {TABS.map(({ to, label, Icon, end }) => (
          <NavLink key={to} to={to} end={end} className="tabbar__item">
            <Icon className="tabbar__icon" />
            {label}
          </NavLink>
        ))}

        {/* Desktop only: the phone bar is a fixed five columns, and a sixth
            would squeeze the labels. On mobile, Settings is reached from the
            profile screen, where it is a labelled row rather than an icon. */}
        <NavLink to="/settings" className="tabbar__item tabbar__item--desktop">
          <SettingsIcon className="tabbar__icon" />
          Settings
        </NavLink>
      </nav>

      <ToastHost />
    </div>
  )
}
