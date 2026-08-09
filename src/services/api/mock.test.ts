import { beforeEach, describe, expect, it } from 'vitest'
import { MockLibraryApi } from './mock'
import { ApiError } from './types'
import { clearAll } from '@/services/storage'

async function signedIn() {
  const api = new MockLibraryApi()
  await api.login('uj/2021/cve/0142', 'password')
  return api
}

describe('MockLibraryApi search', () => {
  beforeEach(() => clearAll())

  it('returns the whole catalogue for an empty query', async () => {
    const api = new MockLibraryApi()
    const result = await api.search({})
    expect(result.total).toBeGreaterThan(10)
    expect(result.items.length).toBe(10)
    expect(result.page).toBe(1)
  })

  it('matches on title, author and subject', async () => {
    const api = new MockLibraryApi()
    expect((await api.search({ query: 'anatomy' })).total).toBeGreaterThan(0)
    expect((await api.search({ query: 'Nwachukwu' })).total).toBeGreaterThan(0)
    expect((await api.search({ query: 'agriculture' })).total).toBeGreaterThan(0)
  })

  it('requires every term to match', async () => {
    const api = new MockLibraryApi()
    const result = await api.search({ query: 'anatomy zzzznotaterm' })
    expect(result.total).toBe(0)
  })

  it('filters by resource type and reports facets', async () => {
    const api = new MockLibraryApi()
    const result = await api.search({ types: ['thesis'] })
    expect(result.total).toBeGreaterThan(0)
    expect(result.items.every((item) => item.type === 'thesis')).toBe(true)
    expect(result.facets.types.every((facet) => facet.value === 'thesis')).toBe(true)
  })

  it('excludes records with no copy on the shelf when availableOnly is set', async () => {
    const api = new MockLibraryApi()
    const result = await api.search({ availableOnly: true, pageSize: 50 })
    const physical = result.items.filter((item) => item.copiesAvailable != null)
    expect(physical.length).toBeGreaterThan(0)
    expect(physical.every((item) => (item.copiesAvailable ?? 0) > 0)).toBe(true)
  })

  it('sorts by year and by title on request', async () => {
    const api = new MockLibraryApi()
    const byYear = await api.search({ sort: 'year', pageSize: 50 })
    const years = byYear.items.map((item) => item.year)
    expect([...years].sort((a, b) => b - a)).toEqual(years)

    const byTitle = await api.search({ sort: 'title', pageSize: 50 })
    const titles = byTitle.items.map((item) => item.title)
    expect([...titles].sort((a, b) => a.localeCompare(b))).toEqual(titles)
  })

  it('paginates without overlapping', async () => {
    const api = new MockLibraryApi()
    const first = await api.search({ page: 1, pageSize: 5 })
    const second = await api.search({ page: 2, pageSize: 5 })
    const overlap = first.items.filter((item) => second.items.some((other) => other.id === item.id))
    expect(overlap).toHaveLength(0)
  })
})

describe('MockLibraryApi circulation', () => {
  beforeEach(() => clearAll())

  it('rejects a sign-in with an unusable password', async () => {
    const api = new MockLibraryApi()
    await expect(api.login('uj/2021/cve/0142', '1')).rejects.toBeInstanceOf(ApiError)
  })

  it('issues an available book and decrements availability', async () => {
    const api = await signedIn()
    const before = await api.getResource('r-005')
    const loan = await api.checkout('r-005')
    const after = await api.getResource('r-005')

    expect(loan.status).toBe('active')
    expect(new Date(loan.dueAt).getTime()).toBeGreaterThan(Date.now())
    expect(after!.copiesAvailable).toBe((before!.copiesAvailable ?? 0) - 1)
  })

  it('refuses to issue a title with every copy on loan', async () => {
    const api = await signedIn()
    await expect(api.checkout('r-002')).rejects.toMatchObject({ code: 'unavailable' })
  })

  it('refuses to issue the same title twice', async () => {
    const api = await signedIn()
    await api.checkout('r-005')
    await expect(api.checkout('r-005')).rejects.toMatchObject({ code: 'limit_reached' })
  })

  it('enforces the borrower category loan limit', async () => {
    const api = await signedIn() // undergraduate: 4 items
    const borrowable = ['r-005', 'r-007', 'r-011', 'r-017', 'r-019']
    for (const id of borrowable.slice(0, 4)) await api.checkout(id)
    await expect(api.checkout(borrowable[4])).rejects.toMatchObject({ code: 'limit_reached' })
  })

  it('extends the due date on renewal until the limit is hit', async () => {
    const api = await signedIn()
    const loan = await api.checkout('r-005')
    let current = loan
    for (let i = 0; i < loan.maxRenewals; i++) current = await api.renew(current.id)
    expect(current.renewals).toBe(loan.maxRenewals)
    await expect(api.renew(current.id)).rejects.toMatchObject({ code: 'limit_reached' })
  })

  it('restores availability when an item is returned', async () => {
    const api = await signedIn()
    const before = await api.getResource('r-005')
    const loan = await api.checkout('r-005')
    await api.returnLoan(loan.id)
    const after = await api.getResource('r-005')
    expect(after!.copiesAvailable).toBe(before!.copiesAvailable)
  })

  it('places one hold per title', async () => {
    const api = await signedIn()
    const hold = await api.placeHold('r-002')
    expect(hold.queuePosition).toBeGreaterThan(0)
    await expect(api.placeHold('r-002')).rejects.toMatchObject({ code: 'limit_reached' })
  })

  it('will not book a slot that is already taken', async () => {
    const api = await signedIn()
    const today = new Date().toISOString().slice(0, 10)
    await api.bookSpace('s-01', today, '13:00')
    await expect(api.bookSpace('s-01', today, '13:00')).rejects.toMatchObject({ code: 'unavailable' })
  })

  it('requires a session before circulating anything', async () => {
    const api = new MockLibraryApi()
    await expect(api.checkout('r-005')).rejects.toMatchObject({ code: 'invalid_credentials' })
  })
})
