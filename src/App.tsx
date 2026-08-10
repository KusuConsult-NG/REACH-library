import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { AppShell } from '@/components/AppShell'
import { LoginScreen } from '@/screens/LoginScreen'
import { OnboardingScreen } from '@/screens/OnboardingScreen'
import { HomeScreen } from '@/screens/HomeScreen'
import { SearchScreen } from '@/screens/SearchScreen'
import { ResourceScreen } from '@/screens/ResourceScreen'
import { CommunityScreen } from '@/screens/CommunityScreen'
import { ToolsScreen } from '@/screens/ToolsScreen'
import { SpacesScreen } from '@/screens/SpacesScreen'
import { LibrarianScreen } from '@/screens/LibrarianScreen'
import { MapScreen } from '@/screens/MapScreen'
import { HelpScreen } from '@/screens/HelpScreen'
import { ProfileScreen } from '@/screens/ProfileScreen'
import { RewardsScreen } from '@/screens/RewardsScreen'
import { NotificationsScreen } from '@/screens/NotificationsScreen'
import { SettingsScreen } from '@/screens/SettingsScreen'
import { loadCirculation } from '@/features/circulation/circulationSlice'
import { loadTrending } from '@/features/catalogue/catalogueSlice'
import { refreshReminders } from '@/features/notifications/reminders'
import { flushQueue } from '@/features/offline/sync'
import { setInstallAvailable, setOnline } from '@/features/ui/uiSlice'
import { watchInstallPrompt } from '@/pwa'
import { EmptyState } from '@/components/primitives'

function NotFound() {
  const location = useLocation()
  return (
    <EmptyState
      title="Page not found"
      body={`Nothing lives at ${location.pathname}. Use the tabs below to get back on track.`}
    />
  )
}

/** Applies the user's theme choice; `system` leaves the media query in charge. */
function useTheme() {
  const theme = useAppSelector((state) => state.ui.theme)
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', theme)
  }, [theme])
}

/** Connectivity, install prompt, and the initial data load. */
function useBootstrap(authenticated: boolean) {
  const dispatch = useAppDispatch()

  useEffect(() => {
    watchInstallPrompt((available) => dispatch(setInstallAvailable(available)))

    const goOnline = () => {
      dispatch(setOnline(true))
      void dispatch(flushQueue())
    }
    const goOffline = () => dispatch(setOnline(false))

    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [dispatch])

  useEffect(() => {
    if (!authenticated) return
    void (async () => {
      await dispatch(loadCirculation())
      void dispatch(loadTrending())
      dispatch(refreshReminders())
      void dispatch(flushQueue())
    })()
  }, [authenticated, dispatch])
}

export function App() {
  const authenticated = useAppSelector((state) => Boolean(state.auth.token))
  const onboarded = useAppSelector((state) => state.auth.onboarded)

  useTheme()
  useBootstrap(authenticated)

  if (!authenticated) return <LoginScreen />
  if (!onboarded) return <OnboardingScreen />

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<HomeScreen />} />
        <Route path="search" element={<SearchScreen />} />
        <Route path="resource/:id" element={<ResourceScreen />} />
        <Route path="community" element={<CommunityScreen />} />
        <Route path="tools" element={<ToolsScreen />} />
        <Route path="tools/spaces" element={<SpacesScreen />} />
        <Route path="tools/librarian" element={<LibrarianScreen />} />
        <Route path="tools/map" element={<MapScreen />} />
        <Route path="tools/help" element={<HelpScreen />} />
        <Route path="profile" element={<ProfileScreen />} />
        <Route path="rewards" element={<RewardsScreen />} />
        <Route path="notifications" element={<NotificationsScreen />} />
        <Route path="settings" element={<SettingsScreen />} />
        <Route path="login" element={<Navigate to="/" replace />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
