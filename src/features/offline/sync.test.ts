import { beforeEach, describe, expect, it } from 'vitest'
import { makeStore } from '@/app/store'
import { api, resetLocalBackend } from '@/services/api'
import { loadCirculation } from '@/features/circulation/circulationSlice'
import { renewWithSync, reserveResource } from '@/features/catalogue/actions'
import { flushQueue } from './sync'
import { setOnline } from '@/features/ui/uiSlice'
import { clearAll } from '@/services/storage'
import { RESOURCES } from '@/services/api/seed'

const AVAILABLE = RESOURCES.find((r) => r.id === 'r-005')!
const ALL_ON_LOAN = RESOURCES.find((r) => r.id === 'r-002')!

async function signedInStore() {
  await api.login('uj/2021/cve/0142', 'password')
  const store = makeStore()
  await store.dispatch(loadCirculation())
  return store
}

describe('offline queue and sync', () => {
  beforeEach(() => {
    clearAll()
    resetLocalBackend()
  })

  it('queues a renewal while offline and applies the new due date locally', async () => {
    const store = await signedInStore()
    const loan = await api.checkout(AVAILABLE.id)
    await store.dispatch(loadCirculation())

    store.dispatch(setOnline(false))
    const before = store.getState().circulation.loans.find((l) => l.id === loan.id)!
    store.dispatch(renewWithSync(loan.id))

    const after = store.getState().circulation.loans.find((l) => l.id === loan.id)!
    expect(after.renewals).toBe(before.renewals + 1)
    expect(new Date(after.dueAt).getTime()).toBeGreaterThan(new Date(before.dueAt).getTime())
    expect(store.getState().ui.queue).toHaveLength(1)
    expect(store.getState().ui.queue[0].kind).toBe('renew')
  })

  it('queues a reservation made offline rather than dropping it', async () => {
    const store = await signedInStore()
    store.dispatch(setOnline(false))
    await store.dispatch(reserveResource(ALL_ON_LOAN))

    expect(store.getState().circulation.holds).toHaveLength(0)
    expect(store.getState().ui.queue).toEqual([expect.objectContaining({ kind: 'hold' })])
  })

  it('replays the queue on reconnection and empties it', async () => {
    const store = await signedInStore()
    store.dispatch(setOnline(false))
    await store.dispatch(reserveResource(ALL_ON_LOAN))
    expect(store.getState().ui.queue).toHaveLength(1)

    store.dispatch(setOnline(true))
    await store.dispatch(flushQueue())

    expect(store.getState().ui.queue).toHaveLength(0)
    expect(store.getState().circulation.holds).toHaveLength(1)
    expect(store.getState().circulation.holds[0].resourceId).toBe(ALL_ON_LOAN.id)
  })

  it('does nothing while still offline', async () => {
    const store = await signedInStore()
    store.dispatch(setOnline(false))
    await store.dispatch(reserveResource(ALL_ON_LOAN))
    await store.dispatch(flushQueue())
    expect(store.getState().ui.queue).toHaveLength(1)
  })

  it('drops an operation the server permanently rejects so the queue cannot wedge', async () => {
    const store = await signedInStore()
    await api.placeHold(ALL_ON_LOAN.id) // a duplicate hold is rejected outright

    store.dispatch(setOnline(false))
    await store.dispatch(reserveResource(ALL_ON_LOAN))
    store.dispatch(setOnline(true))
    await store.dispatch(flushQueue())

    expect(store.getState().ui.queue).toHaveLength(0)
    expect(store.getState().ui.toasts.some((t) => t.tone === 'error')).toBe(true)
  })

  it('refuses to borrow a physical copy while offline', async () => {
    const store = await signedInStore()
    store.dispatch(setOnline(false))
    const { borrowResource } = await import('@/features/catalogue/actions')
    await store.dispatch(borrowResource(AVAILABLE))

    expect(store.getState().circulation.loans).toHaveLength(0)
    expect(store.getState().ui.toasts.at(-1)?.tone).toBe('error')
  })
})
