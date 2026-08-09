import { beforeEach, describe, expect, it } from 'vitest'
import { makeStore } from '@/app/store'
import { resetLocalBackend } from '@/services/api'
import { clearAll } from '@/services/storage'
import { runSearch, setQuery, toggleSaved, rememberSearch } from './catalogueSlice'

describe('catalogue search', () => {
  beforeEach(() => {
    clearAll()
    resetLocalBackend()
  })

  it('stores results for the query it was given', async () => {
    const store = makeStore()
    store.dispatch(setQuery('anatomy'))
    await store.dispatch(runSearch())

    const state = store.getState().catalogue
    expect(state.status).toBe('ready')
    expect(state.total).toBe(1)
    expect(state.results[0].title).toMatch(/Human Anatomy/)
  })

  it('ignores a slower earlier search that resolves after a newer one', async () => {
    const store = makeStore()

    // Start a search, then immediately start another with a different query.
    store.dispatch(setQuery('anatomy'))
    const stale = store.dispatch(runSearch())
    store.dispatch(setQuery('structural analysis'))
    const fresh = store.dispatch(runSearch())

    await Promise.all([stale, fresh])

    const state = store.getState().catalogue
    expect(state.results.map((r) => r.title)).toEqual([
      'Structural Analysis for Civil Engineers',
    ])
    expect(state.status).toBe('ready')
  })

  it('caches every record it returns so detail views work offline', async () => {
    const store = makeStore()
    store.dispatch(setQuery('journal'))
    await store.dispatch(runSearch())

    const { results, cache } = store.getState().catalogue
    expect(results.length).toBeGreaterThan(0)
    for (const resource of results) expect(cache[resource.id]).toBeDefined()
  })

  it('keeps recent searches unique and newest-first, capped at six', () => {
    const store = makeStore()
    for (const term of ['a', 'b', 'c', 'd', 'e', 'f', 'g']) store.dispatch(rememberSearch(term))
    store.dispatch(rememberSearch('c'))

    const recent = store.getState().catalogue.recentSearches
    expect(recent[0]).toBe('c')
    expect(recent).toHaveLength(6)
    expect(new Set(recent).size).toBe(recent.length)
  })

  it('toggles a saved record on and off', () => {
    const store = makeStore()
    store.dispatch(toggleSaved('r-001'))
    expect(store.getState().catalogue.saved).toEqual(['r-001'])
    store.dispatch(toggleSaved('r-001'))
    expect(store.getState().catalogue.saved).toEqual([])
  })
})
