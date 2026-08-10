import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'
import { App } from './App'
import { makeStore, type AppStore } from '@/app/store'
import { clearAll } from '@/services/storage'
import { resetLocalBackend } from '@/services/api'

function renderApp(store: AppStore = makeStore()) {
  return {
    store,
    ...render(
      <Provider store={store}>
        <MemoryRouter>
          <App />
        </MemoryRouter>
      </Provider>,
    ),
  }
}

async function signIn(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/matriculation or staff number/i), 'UJ/2021/CVE/0142')
  await user.type(screen.getByLabelText(/password/i), 'password')
  await user.click(screen.getByRole('button', { name: /^sign in$/i }))
  // Onboarding runs before the dashboard on a first launch.
  await screen.findByRole('button', { name: /continue/i }, { timeout: 4000 })
  await user.click(screen.getByRole('button', { name: /skip introduction/i }))
}

describe('REACH app', () => {
  beforeEach(() => {
    clearAll()
    resetLocalBackend()
  })

  it('shows the sign-in screen before authentication', () => {
    renderApp()
    expect(screen.getByRole('heading', { name: 'REACH' })).toBeInTheDocument()
    expect(screen.getByLabelText(/matriculation or staff number/i)).toBeInTheDocument()
  })

  it('rejects an empty submission without calling the backend', async () => {
    const user = userEvent.setup()
    const { store } = renderApp()
    await user.click(screen.getByRole('button', { name: /^sign in$/i }))
    expect(store.getState().auth.token).toBeNull()
  })

  it('signs in, runs onboarding, then lands on the dashboard', async () => {
    const user = userEvent.setup()
    const { store } = renderApp()
    await signIn(user)

    await waitFor(() => expect(store.getState().auth.token).toBeTruthy())
    expect(await screen.findByRole('heading', { name: /XP$/ })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: /primary/i })).toBeInTheDocument()
  })

  it('searches the catalogue and opens a record, awarding browse XP', async () => {
    const user = userEvent.setup()
    const { store } = renderApp()
    await signIn(user)

    await user.click(screen.getByRole('link', { name: /^search$/i }))
    const box = await screen.findByLabelText(/search the library catalogue/i)
    await user.type(box, 'anatomy{Enter}')

    const result = await screen.findByText(/Human Anatomy and Physiology/i, {}, { timeout: 4000 })
    const before = store.getState().xp.totalXp
    await user.click(result)

    await waitFor(() => expect(store.getState().xp.totalXp).toBeGreaterThan(before), { timeout: 4000 })
    expect(store.getState().xp.activities[0].kind).toBe('opac_browse')
  })

  it('borrows an available book and records the loan and its XP', async () => {
    const user = userEvent.setup()
    const store = makeStore()
    renderApp(store)
    await signIn(user)

    await user.click(screen.getByRole('link', { name: /^search$/i }))
    const box = await screen.findByLabelText(/search the library catalogue/i)
    await user.type(box, 'structural analysis{Enter}')
    await user.click(await screen.findByText(/Structural Analysis for Civil Engineers/i, {}, { timeout: 4000 }))

    const borrow = await screen.findByRole('button', { name: /borrow this book/i }, { timeout: 4000 })
    await user.click(borrow)

    await waitFor(() => expect(store.getState().circulation.loans).toHaveLength(1), { timeout: 4000 })
    expect(store.getState().xp.activities.some((a) => a.kind === 'physical_borrow')).toBe(true)
    expect(store.getState().notifications.items.some((n) => n.title === 'Item issued')).toBe(true)
  })

  it('offers a hold instead of a loan when every copy is out', async () => {
    const user = userEvent.setup()
    const store = makeStore()
    renderApp(store)
    await signIn(user)

    await user.click(screen.getByRole('link', { name: /^search$/i }))
    await user.type(await screen.findByLabelText(/search the library catalogue/i), 'constitutional{Enter}')
    await user.click(await screen.findByText(/Nigerian Constitutional Law/i, {}, { timeout: 4000 }))

    const hold = await screen.findByRole('button', { name: /place a hold/i }, { timeout: 4000 })
    await user.click(hold)

    await waitFor(() => expect(store.getState().circulation.holds).toHaveLength(1), { timeout: 4000 })
    expect(store.getState().xp.activities.some((a) => a.kind === 'reservation')).toBe(true)
  })

  it('lets the user turn off activity sharing from settings', async () => {
    const user = userEvent.setup()
    const store = makeStore()
    renderApp(store)
    await signIn(user)

    await user.click(screen.getByRole('link', { name: /^profile$/i }))
    // Scoped to the page: Settings is also a permanent item in the desktop
    // sidebar, so an unscoped query now matches two legitimate links.
    const page = within(screen.getByRole('main'))
    await user.click(await page.findByRole('link', { name: /^settings$/i }))

    const toggle = await screen.findByRole('switch', { name: /discoverable profile/i })
    expect(store.getState().auth.privacy.profileVisible).toBe(true)
    await user.click(toggle)
    expect(store.getState().auth.privacy.profileVisible).toBe(false)
  })

  it('opens a named settings group straight from the profile', async () => {
    const user = userEvent.setup()
    const store = makeStore()
    renderApp(store)
    await signIn(user)

    await user.click(screen.getByRole('link', { name: /^profile$/i }))
    // The complaint this guards against: settings were reachable only through
    // one unlabelled icon, so nobody knew subject alerts could be changed.
    const page = within(screen.getByRole('main'))
    await user.click(await page.findByRole('link', { name: /subject interests/i }))

    expect(await screen.findByRole('heading', { name: /subject interests/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /^privacy$/i })).toBeInTheDocument()
  })

  it('surfaces the offline banner when connectivity drops', async () => {
    const user = userEvent.setup()
    const store = makeStore()
    renderApp(store)
    await signIn(user)

    store.dispatch({ type: 'ui/setOnline', payload: false })
    const banner = await screen.findByText(/offline — showing your saved library/i)
    expect(banner).toBeInTheDocument()
  })

  it('marks notifications as read', async () => {
    const user = userEvent.setup()
    const store = makeStore()
    renderApp(store)
    await signIn(user)

    await waitFor(() => expect(store.getState().notifications.items.length).toBeGreaterThan(0), {
      timeout: 4000,
    })
    await user.click(screen.getByRole('link', { name: /notifications/i }))

    const list = await screen.findByRole('list')
    await user.click(within(list).getAllByRole('button')[0])
    await waitFor(() => expect(store.getState().notifications.items.some((n) => n.read)).toBe(true))
  })
})
