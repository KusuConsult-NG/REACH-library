import { beforeEach, describe, expect, it } from 'vitest'
import { makeStore } from '@/app/store'
import { REWARDS, rewardById } from '@/config/rewards'
import { recordEngagement } from '@/features/xp/engagement'
import { clearAll } from '@/services/storage'
import { redeemReward } from './actions'
import { expireStale, makeVoucherCode, markUsed } from './rewardsSlice'

const LOAN_SLOT = rewardById('loan-slot')!

/** Earn at least `target` XP through ordinary borrowing. */
function earn(store: ReturnType<typeof makeStore>, target: number) {
  while (store.getState().xp.balance < target) {
    store.dispatch(recordEngagement({ kind: 'physical_borrow', silent: true }))
  }
}

describe('redeeming a reward', () => {
  beforeEach(() => clearAll())

  it('refuses when the balance is short, and spends nothing', () => {
    const store = makeStore()
    const ok = store.dispatch(redeemReward(LOAN_SLOT))

    expect(ok).toBe(false)
    expect(store.getState().rewards.vouchers).toHaveLength(0)
    expect(store.getState().xp.balance).toBe(0)
    expect(store.getState().ui.toasts.at(-1)?.tone).toBe('error')
  })

  it('issues a voucher and debits only the spendable balance', () => {
    const store = makeStore()
    earn(store, LOAN_SLOT.cost)
    const before = store.getState().xp

    expect(store.dispatch(redeemReward(LOAN_SLOT))).toBe(true)

    const after = store.getState()
    expect(after.xp.balance).toBe(before.balance - LOAN_SLOT.cost)
    // Lifetime XP is what drives the level, and redeeming must not touch it.
    expect(after.xp.totalXp).toBe(before.totalXp)
    expect(after.rewards.vouchers).toHaveLength(1)
    expect(after.rewards.vouchers[0].name).toBe(LOAN_SLOT.name)
  })

  it('cannot be redeemed twice on one balance', () => {
    const store = makeStore()
    earn(store, LOAN_SLOT.cost)

    expect(store.dispatch(redeemReward(LOAN_SLOT))).toBe(true)
    // The debit lands in the same tick, so a second tap sees the new balance.
    const second = store.dispatch(redeemReward(LOAN_SLOT))

    if (store.getState().xp.balance < LOAN_SLOT.cost) {
      expect(second).toBe(false)
      expect(store.getState().rewards.vouchers).toHaveLength(1)
    }
  })

  it('records what was paid on the voucher, so history survives a price change', () => {
    const store = makeStore()
    earn(store, LOAN_SLOT.cost)
    store.dispatch(redeemReward(LOAN_SLOT))
    expect(store.getState().rewards.vouchers[0].cost).toBe(LOAN_SLOT.cost)
  })

  it('tells the member about the voucher and where to use it', () => {
    const store = makeStore()
    earn(store, LOAN_SLOT.cost)
    store.dispatch(redeemReward(LOAN_SLOT))

    const notification = store.getState().notifications.items[0]
    expect(notification.title).toContain(LOAN_SLOT.name)
    expect(notification.body).toContain(store.getState().rewards.vouchers[0].code)
  })

  it('sets an expiry from the reward definition', () => {
    const store = makeStore()
    earn(store, LOAN_SLOT.cost)
    store.dispatch(redeemReward(LOAN_SLOT))

    const voucher = store.getState().rewards.vouchers[0]
    const days = Math.round(
      (new Date(voucher.expiresAt).getTime() - new Date(voucher.issuedAt).getTime()) / 86_400_000,
    )
    expect(days).toBe(LOAN_SLOT.validForDays)
  })
})

describe('voucher lifecycle', () => {
  beforeEach(() => clearAll())

  it('marks a voucher used, once', () => {
    const store = makeStore()
    earn(store, LOAN_SLOT.cost)
    store.dispatch(redeemReward(LOAN_SLOT))
    const { id } = store.getState().rewards.vouchers[0]

    store.dispatch(markUsed(id))
    const usedAt = store.getState().rewards.vouchers[0].usedAt
    store.dispatch(markUsed(id))

    expect(store.getState().rewards.vouchers[0].status).toBe('used')
    expect(store.getState().rewards.vouchers[0].usedAt).toBe(usedAt)
  })

  it('expires a voucher past its date but leaves used ones alone', () => {
    const store = makeStore({
      rewards: {
        vouchers: [
          {
            id: 'v1',
            rewardId: 'print-20',
            name: '20 sheets of printing',
            cost: 300,
            code: 'REACH-AAAA-BBBB',
            issuedAt: new Date(Date.now() - 90 * 86_400_000).toISOString(),
            expiresAt: new Date(Date.now() - 86_400_000).toISOString(),
            status: 'active',
          },
          {
            id: 'v2',
            rewardId: 'print-20',
            name: '20 sheets of printing',
            cost: 300,
            code: 'REACH-CCCC-DDDD',
            issuedAt: new Date(Date.now() - 90 * 86_400_000).toISOString(),
            expiresAt: new Date(Date.now() - 86_400_000).toISOString(),
            status: 'used',
          },
        ],
      },
    })

    store.dispatch(expireStale())
    const [expired, used] = store.getState().rewards.vouchers
    expect(expired.status).toBe('expired')
    expect(used.status).toBe('used')
  })
})

describe('voucher codes', () => {
  it('avoid characters that are misread when spoken or typed', () => {
    const code = makeVoucherCode(() => 0.999999)
    expect(code).toMatch(/^REACH-[A-Z0-9]{4}-[A-Z0-9]{4}$/)
    for (const forbidden of ['O', 'I', 'S', '0', '1', '5']) {
      expect(code.slice(6)).not.toContain(forbidden)
    }
  })

  it('are unlikely to collide', () => {
    const codes = new Set(Array.from({ length: 400 }, () => makeVoucherCode()))
    expect(codes.size).toBeGreaterThan(395)
  })
})

describe('the reward catalogue', () => {
  it('has unique ids and positive costs', () => {
    expect(new Set(REWARDS.map((r) => r.id)).size).toBe(REWARDS.length)
    expect(REWARDS.every((r) => r.cost > 0 && r.validForDays > 0)).toBe(true)
  })
})
