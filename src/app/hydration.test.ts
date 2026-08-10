import { beforeEach, describe, expect, it } from 'vitest'
import { loadPersisted, makeStore } from './store'
import { clearAll } from '@/services/storage'

/**
 * A state blob written by an older build of this app: `xp` before transfers and
 * the spendable balance existed, no `rewards` slice, no `lastBorrowerNumber`.
 *
 * This is not hypothetical — it is what was on real devices, and loading it
 * rendered a white page, because `preloadedState` replaces a slice rather than
 * merging with the reducer's own initial state and every field added since
 * arrived as `undefined`.
 */
const OLD_STATE = {
  version: 1,
  state: {
    auth: {
      user: {
        id: 'u1',
        username: 'uj/2021/cve/0142',
        name: 'Ibrahim Dashe',
        email: 'i@unijos.edu.ng',
        role: 'undergraduate',
        department: 'Civil Engineering',
        faculty: 'Engineering',
        avatarInitials: 'ID',
        borrowerNumber: '25108',
        joinedAt: '2025-12-13T00:00:00.000Z',
      },
      token: 'demo.token',
      status: 'authenticated',
      error: null,
      onboarded: true,
      privacy: { profileVisible: true, shareActivity: false },
      // Note: no `notifications` key at all — it postdates this blob.
    },
    xp: {
      totalXp: 320,
      activities: [],
      weeklyGoal: 150,
      bonusPaidWeeks: [],
      streak: 2,
      lastActiveDay: null,
    },
    ui: { theme: 'dark', queue: [] },
  },
}

describe('hydrating state written by an older build', () => {
  beforeEach(() => {
    clearAll()
    localStorage.setItem('reach:state', JSON.stringify(OLD_STATE))
  })

  it('fills in fields the saved copy predates rather than leaving them undefined', () => {
    const state = makeStore(loadPersisted()).getState()

    expect(Array.isArray(state.xp.transfers)).toBe(true)
    expect(Array.isArray(state.rewards.vouchers)).toBe(true)
    expect(Array.isArray(state.notifications.items)).toBe(true)
    expect(Array.isArray(state.social.following)).toBe(true)
    expect(state.auth.notifications).toBeDefined()
    expect(Array.isArray(state.auth.notifications.interests)).toBe(true)
    expect(state.circulation.loans).toEqual([])
  })

  it('keeps what the user actually had', () => {
    const state = makeStore(loadPersisted()).getState()

    expect(state.xp.totalXp).toBe(320)
    expect(state.xp.streak).toBe(2)
    expect(state.auth.user?.borrowerNumber).toBe('25108')
    expect(state.ui.theme).toBe('dark')
  })

  it('seeds the spendable balance from lifetime XP rather than zeroing it', () => {
    // Everything earned before the balance existed is unspent by definition.
    expect(makeStore(loadPersisted()).getState().xp.balance).toBe(320)
  })

  it('does not resurrect a balance the user has already spent down', () => {
    localStorage.setItem(
      'reach:state',
      JSON.stringify({
        ...OLD_STATE,
        state: { ...OLD_STATE.state, xp: { ...OLD_STATE.state.xp, balance: 40 } },
      }),
    )
    const state = makeStore(loadPersisted()).getState()
    expect(state.xp.balance).toBe(40)
    expect(state.xp.totalXp).toBe(320)
  })

  it('survives a slice saved as junk', () => {
    localStorage.setItem(
      'reach:state',
      JSON.stringify({ version: 1, state: { xp: 'not an object', catalogue: null } }),
    )
    const state = makeStore(loadPersisted()).getState()
    expect(() => state.xp.transfers.length).not.toThrow()
  })
})
