import {
  combineReducers,
  configureStore,
  type Action,
  type Middleware,
  type Reducer,
} from '@reduxjs/toolkit'
import auth, { login } from '@/features/auth/authSlice'
import xp from '@/features/xp/xpSlice'
import catalogue from '@/features/catalogue/catalogueSlice'
import circulation from '@/features/circulation/circulationSlice'
import notifications from '@/features/notifications/notificationsSlice'
import rewards from '@/features/rewards/rewardsSlice'
import social from '@/features/social/socialSlice'
import ui, { uiInitialState } from '@/features/ui/uiSlice'
import { debug } from '@/services/debug'
import { readJson, writeJson } from '@/services/storage'

const combined = combineReducers({ auth, xp, catalogue, circulation, notifications, rewards, social, ui })

type RootShape = ReturnType<typeof combined>

/**
 * Wipe one borrower's record when a *different* borrower takes over the device.
 *
 * Library machines and shared phones are normal here, and everything below auth
 * — XP, vouchers, loans, notifications — belongs to one person. Leaving it
 * behind would hand the next user someone else's wallet, which transfers make
 * plainly wrong.
 *
 * The comparison is against `lastBorrowerNumber`, not the live `user`, because
 * sign-out clears the user: keying off that would wipe the record of anyone who
 * merely signed out, and with XP held on the device that means losing it. Same
 * borrower back in, nothing is touched.
 *
 * Only the theme survives a handover. The offline queue must not: a renewal one
 * borrower captured offline would otherwise replay under the next borrower's
 * session.
 */
const rootReducer: Reducer<RootShape, Action, Partial<RootShape>> = (state, action) => {
  if (state && login.fulfilled.match(action)) {
    const previous = state.auth?.lastBorrowerNumber
    const next = action.payload.user.borrowerNumber
    debug('identity', 'sign-in', {
      previous,
      next,
      handover: Boolean(previous && previous !== next),
      xpBeing_discarded: previous && previous !== next ? state.xp?.balance : 0,
      queuedOpsDiscarded: previous && previous !== next ? state.ui?.queue?.length : 0,
    })
    if (previous && previous !== next) {
      state = { ui: { ...uiInitialState, theme: state.ui?.theme ?? uiInitialState.theme } }
    }
  }
  return combined(state, action)
}

/**
 * Slices worth restoring on next launch. Everything here is either the user's
 * own record (XP, loans, preferences) or a cache that makes the app usable
 * before the network answers — which is what keeps cold start under the 2s
 * budget and the core screens readable offline.
 */
const PERSISTED = ['auth', 'xp', 'catalogue', 'circulation', 'notifications', 'rewards', 'social'] as const

/**
 * `ui` is mostly transient, but two parts of it must outlive a reload: the
 * chosen theme, and the offline queue — actions taken with no connection would
 * otherwise be lost if the user closed the app before reconnecting.
 */
const PERSISTED_UI = ['theme', 'queue'] as const
const PERSIST_KEY = 'state'
const PERSIST_VERSION = 1

function loadPersisted(): Partial<RootShape> | undefined {
  const saved = readJson<{ version: number; state: Partial<RootShape> } | null>(PERSIST_KEY, null)
  if (!saved || saved.version !== PERSIST_VERSION) return undefined

  const state = saved.state
  // Transient fields must not be restored, or the UI resumes mid-flight.
  if (state.catalogue) {
    state.catalogue = {
      ...state.catalogue,
      status: 'idle',
      error: null,
      requestId: null,
      results: [],
      total: 0,
      page: 1,
    }
  }
  if (state.circulation) {
    state.circulation = { ...state.circulation, status: 'idle', busyId: null, error: null }
  }
  if (state.auth) {
    state.auth = {
      ...state.auth,
      status: state.auth.token ? 'authenticated' : 'idle',
      error: null,
    }
  }
  if (state.xp && state.xp.balance == null) {
    // Spendable balance arrived after launch: everything earned so far is
    // unspent, so seed it from the lifetime total rather than zeroing it.
    state.xp = { ...state.xp, balance: state.xp.totalXp }
  }
  if (state.ui) {
    state.ui = {
      ...uiInitialState,
      theme: state.ui.theme ?? uiInitialState.theme,
      queue: state.ui.queue ?? [],
      online: typeof navigator === 'undefined' ? true : navigator.onLine,
    }
  }
  return state
}

let writeTimer: ReturnType<typeof setTimeout> | undefined
/** Set while a debounced write is outstanding, so it can be forced out early. */
let flushPending: (() => void) | undefined

function writeNow(state: RootShape) {
  const slice: Partial<RootShape> = {}
  for (const key of PERSISTED) slice[key] = state[key] as never
  slice.ui = Object.fromEntries(
    PERSISTED_UI.map((key) => [key, state.ui[key]]),
  ) as unknown as RootShape['ui']

  const payload = { version: PERSIST_VERSION, state: slice }
  writeJson(PERSIST_KEY, payload)
  // Size is the value to watch: localStorage caps around 5MB per origin and
  // `writeJson` swallows the quota error by design, so the first symptom of an
  // over-large state is silently stale data rather than an exception.
  debug('persist', 'wrote state', {
    bytes: JSON.stringify(payload).length,
    activities: state.xp.activities.length,
    transfers: state.xp.transfers.length,
    notifications: state.notifications.items?.length,
    queued: state.ui.queue.length,
    balance: state.xp.balance,
    totalXp: state.xp.totalXp,
  })
}

/**
 * Force the debounced write to disk immediately.
 *
 * Used where losing the last 250ms of state is not survivable — acknowledging
 * received XP to the server, for one: the acknowledgement is irreversible, so
 * the credit has to be durable before it is sent.
 */
export function flushPersistence(): void {
  flushPending?.()
}

const persistence: Middleware = (store) => (next) => (action) => {
  const result = next(action)
  clearTimeout(writeTimer)
  flushPending = () => {
    clearTimeout(writeTimer)
    flushPending = undefined
    writeNow(store.getState() as RootShape)
  }
  writeTimer = setTimeout(() => flushPending?.(), 250)
  return result
}

/**
 * Build a store. The app uses the singleton below; tests build isolated
 * instances so one case's XP never bleeds into the next.
 */
export function makeStore(preloadedState?: Partial<RootShape>) {
  return configureStore({
    reducer: rootReducer,
    preloadedState,
    middleware: (getDefault) => getDefault({ serializableCheck: false }).concat(persistence),
  })
}

export const store = makeStore(loadPersisted())

/**
 * A debounced write would be lost if the user backgrounds or closes the app in
 * the gap — which is exactly when a queued offline action matters most, so the
 * pending write is forced out as the page goes away.
 */
if (typeof document !== 'undefined') {
  const flush = () => flushPending?.()
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush()
  })
  window.addEventListener('pagehide', flush)
}

export type AppStore = ReturnType<typeof makeStore>
export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
