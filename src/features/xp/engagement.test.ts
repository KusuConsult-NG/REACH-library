import { beforeEach, describe, expect, it } from 'vitest'
import { makeStore } from '@/app/store'
import { recordEngagement } from './engagement'
import { DAILY_CAPS, WEEKLY_XP_GOAL, XP_VALUES } from '@/config/xp'
import { clearAll } from '@/services/storage'
import { weekKey } from '@/utils/date'

describe('recordEngagement', () => {
  beforeEach(() => clearAll())

  it('awards XP and raises a reward toast', () => {
    const store = makeStore()
    store.dispatch(recordEngagement({ kind: 'physical_borrow', resourceTitle: 'Structural Analysis' }))

    const state = store.getState()
    expect(state.xp.totalXp).toBe(XP_VALUES.physical_borrow)
    expect(state.ui.toasts).toHaveLength(1)
    expect(state.ui.toasts[0].tone).toBe('xp')
    expect(state.ui.toasts[0].xp).toBe(XP_VALUES.physical_borrow)
  })

  it('keeps silent activities out of the toast queue', () => {
    const store = makeStore()
    store.dispatch(recordEngagement({ kind: 'opac_browse', silent: true }))
    expect(store.getState().ui.toasts).toHaveLength(0)
    expect(store.getState().xp.totalXp).toBe(XP_VALUES.opac_browse)
  })

  it('stops paying once the daily cap is reached but still logs the activity', () => {
    const store = makeStore()
    const cap = DAILY_CAPS.opac_browse!
    for (let i = 0; i < cap + 3; i++) {
      store.dispatch(recordEngagement({ kind: 'opac_browse', silent: true }))
    }
    const state = store.getState()
    expect(state.xp.totalXp).toBe(cap * XP_VALUES.opac_browse)
    expect(state.xp.activities.filter((a) => a.kind === 'opac_browse')).toHaveLength(cap + 3)
  })

  it('notifies on a level up', () => {
    const store = makeStore()
    // Level 2 starts at 100 XP; two borrows clear it.
    store.dispatch(recordEngagement({ kind: 'physical_borrow' }))
    store.dispatch(recordEngagement({ kind: 'physical_borrow' }))

    const notifications = store.getState().notifications.items
    expect(notifications.some((n) => n.kind === 'xp_milestone' && n.title.includes('level 2'))).toBe(true)
  })

  it('pays the weekly bonus once when the goal is met', () => {
    const store = makeStore()
    const borrows = Math.ceil(WEEKLY_XP_GOAL / XP_VALUES.physical_borrow)
    for (let i = 0; i < borrows; i++) store.dispatch(recordEngagement({ kind: 'physical_borrow' }))

    const first = store.getState()
    expect(first.xp.bonusPaidWeeks).toEqual([weekKey()])
    expect(first.xp.activities.filter((a) => a.kind === 'weekly_goal_bonus')).toHaveLength(1)

    // Further activity in the same week must not pay the bonus again.
    store.dispatch(recordEngagement({ kind: 'physical_borrow' }))
    expect(
      store.getState().xp.activities.filter((a) => a.kind === 'weekly_goal_bonus'),
    ).toHaveLength(1)
  })

  it('respects the user turning XP notifications off', () => {
    const store = makeStore()
    store.dispatch({ type: 'auth/setNotificationPrefs', payload: { xpMilestones: false } })
    store.dispatch(recordEngagement({ kind: 'physical_borrow' }))
    store.dispatch(recordEngagement({ kind: 'physical_borrow' }))
    expect(store.getState().notifications.items.filter((n) => n.kind === 'xp_milestone')).toHaveLength(0)
  })

  it('marks offline activity as pending', () => {
    const store = makeStore()
    store.dispatch(recordEngagement({ kind: 'reservation', pending: true, silent: true }))
    expect(store.getState().xp.activities[0].pending).toBe(true)
  })
})
