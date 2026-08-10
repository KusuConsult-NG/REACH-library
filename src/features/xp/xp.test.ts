import { describe, expect, it } from 'vitest'
import reducer, { award, canEarn, refund, spend, xpEarnedInWeek, type XpState } from './xpSlice'
import { levelFromXp, milestonesCrossed } from './levels'
import { DAILY_CAPS, LEVEL_THRESHOLDS, LEVEL_TITLES, XP_VALUES } from '@/config/xp'
import { weekKey } from '@/utils/date'

const base: XpState = {
  totalXp: 0,
  balance: 0,
  activities: [],
  weeklyGoal: 150,
  bonusPaidWeeks: [],
  streak: 0,
  lastActiveDay: null,
  transfers: [],
}

describe('levelFromXp', () => {
  it('starts every user at level 1 with no XP', () => {
    const info = levelFromXp(0)
    expect(info.level).toBe(1)
    expect(info.title).toBe(LEVEL_TITLES[0])
    expect(info.progress).toBe(0)
  })

  it('reports progress within the current band', () => {
    const info = levelFromXp(175)
    expect(info.level).toBe(2)
    expect(info.xpIntoLevel).toBe(75)
    expect(info.xpForLevel).toBe(150)
    expect(info.xpToNext).toBe(75)
    expect(info.progress).toBeCloseTo(0.5)
  })

  it('promotes exactly on a threshold', () => {
    expect(levelFromXp(LEVEL_THRESHOLDS[3]).level).toBe(4)
    expect(levelFromXp(LEVEL_THRESHOLDS[3] - 1).level).toBe(3)
  })

  it('caps at the final level and absorbs surplus XP', () => {
    const info = levelFromXp(LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1] + 5000)
    expect(info.level).toBe(LEVEL_THRESHOLDS.length)
    expect(info.isMax).toBe(true)
    expect(info.xpToNext).toBe(0)
    expect(info.progress).toBe(1)
  })

  it('treats negative or fractional input defensively', () => {
    expect(levelFromXp(-50).level).toBe(1)
    expect(levelFromXp(120.9).currentXp).toBe(120)
  })
})

describe('milestonesCrossed', () => {
  it('only reports milestones passed by this award', () => {
    expect(milestonesCrossed(90, 110, [100, 500])).toEqual([100])
    expect(milestonesCrossed(110, 130, [100, 500])).toEqual([])
    expect(milestonesCrossed(90, 600, [100, 500])).toEqual([100, 500])
  })
})

describe('award reducer', () => {
  it('adds the configured XP for the activity', () => {
    const next = reducer(base, award({ kind: 'physical_borrow' }, true))
    expect(next.totalXp).toBe(XP_VALUES.physical_borrow)
    expect(next.activities).toHaveLength(1)
    expect(next.activities[0].xp).toBe(50)
  })

  it('logs a capped activity without paying XP', () => {
    const next = reducer(base, award({ kind: 'opac_browse' }, false))
    expect(next.totalXp).toBe(0)
    expect(next.activities[0].xp).toBe(0)
  })

  it('starts a streak on the first activity', () => {
    const next = reducer(base, award({ kind: 'opac_browse' }, true))
    expect(next.streak).toBe(1)
  })

  it('does not double-count a streak within the same day', () => {
    const once = reducer(base, award({ kind: 'opac_browse' }, true))
    const twice = reducer(once, award({ kind: 'eresource_access' }, true))
    expect(twice.streak).toBe(1)
  })

  it('extends a streak across consecutive days', () => {
    const yesterday = new Date(Date.now() - 86_400_000).toISOString()
    const seeded = reducer(base, award({ kind: 'opac_browse', at: yesterday }, true))
    const today = reducer(seeded, award({ kind: 'opac_browse' }, true))
    expect(today.streak).toBe(2)
  })

  it('resets a streak after a missed day', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 86_400_000).toISOString()
    const seeded = reducer(base, award({ kind: 'opac_browse', at: threeDaysAgo }, true))
    const today = reducer(seeded, award({ kind: 'opac_browse' }, true))
    expect(today.streak).toBe(1)
  })
})

describe('spendable balance', () => {
  it('rises with earnings alongside the lifetime total', () => {
    const next = reducer(base, award({ kind: 'physical_borrow' }, true))
    expect(next.totalXp).toBe(50)
    expect(next.balance).toBe(50)
  })

  it('spending draws down the balance and leaves the lifetime total alone', () => {
    const earned = reducer(base, award({ kind: 'physical_borrow' }, true))
    const spent = reducer(earned, spend(30))
    expect(spent.balance).toBe(20)
    // The level must not fall because the member redeemed something.
    expect(spent.totalXp).toBe(50)
  })

  it('never lets the balance go negative', () => {
    const earned = reducer(base, award({ kind: 'opac_browse' }, true))
    expect(reducer(earned, spend(999)).balance).toBe(0)
  })

  it('refunds an unfulfilled redemption', () => {
    const earned = reducer(base, award({ kind: 'physical_borrow' }, true))
    const spent = reducer(earned, spend(50))
    expect(reducer(spent, refund(50)).balance).toBe(50)
  })

  it('does not credit the balance for a capped, zero-XP activity', () => {
    const next = reducer(base, award({ kind: 'opac_browse' }, false))
    expect(next.balance).toBe(0)
    expect(next.totalXp).toBe(0)
  })
})

describe('canEarn', () => {
  it('allows uncapped activities without limit', () => {
    let state = base
    for (let i = 0; i < 20; i++) state = reducer(state, award({ kind: 'physical_borrow' }, true))
    expect(canEarn(state, 'physical_borrow')).toBe(true)
  })

  it('stops paying once the daily cap for browsing is reached', () => {
    const cap = DAILY_CAPS.opac_browse!
    let state = base
    for (let i = 0; i < cap; i++) {
      expect(canEarn(state, 'opac_browse')).toBe(true)
      state = reducer(state, award({ kind: 'opac_browse' }, true))
    }
    expect(canEarn(state, 'opac_browse')).toBe(false)
    // A different activity is unaffected by another one's cap.
    expect(canEarn(state, 'eresource_access')).toBe(true)
  })

  it('counts caps per day, not in total', () => {
    const cap = DAILY_CAPS.opac_browse!
    const yesterday = new Date(Date.now() - 86_400_000).toISOString()
    let state = base
    for (let i = 0; i < cap + 2; i++) {
      state = reducer(state, award({ kind: 'opac_browse', at: yesterday }, true))
    }
    expect(canEarn(state, 'opac_browse')).toBe(true)
  })
})

describe('xpEarnedInWeek', () => {
  it('counts only activity inside the current ISO week', () => {
    const lastWeek = new Date(Date.now() - 8 * 86_400_000).toISOString()
    let state = reducer(base, award({ kind: 'physical_borrow', at: lastWeek }, true))
    state = reducer(state, award({ kind: 'reservation' }, true))
    expect(state.totalXp).toBe(XP_VALUES.physical_borrow + XP_VALUES.reservation)
    expect(xpEarnedInWeek(state)).toBe(XP_VALUES.reservation)
  })
})

describe('weekKey', () => {
  it('produces an ISO-8601 week identifier', () => {
    expect(weekKey(new Date('2026-01-01T12:00:00Z'))).toBe('2026-W01')
    expect(weekKey(new Date('2026-08-09T12:00:00Z'))).toBe('2026-W32')
  })

  it('gives the same key to every day of one week', () => {
    const monday = weekKey(new Date('2026-08-03T09:00:00Z'))
    const sunday = weekKey(new Date('2026-08-09T09:00:00Z'))
    expect(monday).toBe(sunday)
  })
})
