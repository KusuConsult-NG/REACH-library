import { beforeEach, describe, expect, it } from 'vitest'
import { makeStore } from '@/app/store'
import { borrowResource } from './actions'
import { loadResource, runSearch, setQuery } from './catalogueSlice'
import { returnLoan } from '@/features/circulation/circulationSlice'
import { login } from '@/features/auth/authSlice'
import { resetLocalBackend } from '@/services/api'
import { clearAll } from '@/services/storage'

/** A title with more than one copy, so the count is visibly a count. */
const MULTI_COPY = 'r-005'

async function signedInStore() {
  const store = makeStore()
  await store.dispatch(login({ username: 'uj/2021/cve/0142', password: 'password' }))
  return store
}

describe('shelf availability follows the transaction', () => {
  beforeEach(() => {
    clearAll()
    // The api adapter is a module singleton holding its own copy of the demo
    // backend; clearing storage alone leaves last test's loans in memory.
    resetLocalBackend()
  })

  it('drops the copy count on the record you just borrowed', async () => {
    const store = await signedInStore()
    await store.dispatch(loadResource(MULTI_COPY))
    const before = store.getState().catalogue.cache[MULTI_COPY]
    expect(before.copiesAvailable).toBeGreaterThan(0)

    await store.dispatch(borrowResource(before))

    // Without this the cached record still advertises a copy on the shelf and
    // the next borrower is refused by the server after tapping Borrow.
    const after = store.getState().catalogue.cache[MULTI_COPY]
    expect(after.copiesAvailable).toBe(before.copiesAvailable! - 1)
    expect(after.copiesTotal).toBe(before.copiesTotal)
  })

  it('updates the open search results, not just the record page', async () => {
    const store = await signedInStore()
    store.dispatch(setQuery('structural'))
    await store.dispatch(runSearch())
    const listed = store.getState().catalogue.results.find((item) => item.id === MULTI_COPY)
    expect(listed?.copiesAvailable).toBeGreaterThan(0)

    await store.dispatch(borrowResource(listed!))

    const relisted = store.getState().catalogue.results.find((item) => item.id === MULTI_COPY)
    expect(relisted!.copiesAvailable).toBe(listed!.copiesAvailable! - 1)
  })

  it('puts the copy back when the loan is returned', async () => {
    const store = await signedInStore()
    await store.dispatch(loadResource(MULTI_COPY))
    const before = store.getState().catalogue.cache[MULTI_COPY]

    await store.dispatch(borrowResource(before))
    const loan = store.getState().circulation.loans[0]
    await store.dispatch(returnLoan(loan.id))

    expect(store.getState().catalogue.cache[MULTI_COPY].copiesAvailable).toBe(before.copiesAvailable)
  })

  it('reaches zero on the last copy, so the page offers a hold instead', async () => {
    const store = await signedInStore()
    await store.dispatch(loadResource(MULTI_COPY))
    const start = store.getState().catalogue.cache[MULTI_COPY].copiesAvailable!

    // Borrowing the same title twice is refused, so exhaust it from separate
    // borrowers — the shelf is shared even though the loans are not.
    for (let i = 0; i < start; i++) {
      const other = makeStore()
      await other.dispatch(login({ username: `uj/2021/xx/${1000 + i}`, password: 'password' }))
      await other.dispatch(loadResource(MULTI_COPY))
      await other.dispatch(borrowResource(other.getState().catalogue.cache[MULTI_COPY]))
    }

    await store.dispatch(loadResource(MULTI_COPY))
    expect(store.getState().catalogue.cache[MULTI_COPY].copiesAvailable).toBe(0)
  })
})
