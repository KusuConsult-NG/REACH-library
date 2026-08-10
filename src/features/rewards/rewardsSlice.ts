import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { Voucher } from '@/types'

export interface RewardsState {
  vouchers: Voucher[]
}

const initialState: RewardsState = { vouchers: [] }

/**
 * Voucher codes are read aloud and typed at a desk, so the alphabet drops the
 * characters people confuse: no O/0, no I/1, no S/5.
 */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRTUVWXYZ2346789'

export function makeVoucherCode(random: () => number = Math.random): string {
  const block = () =>
    Array.from({ length: 4 }, () => CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)]).join('')
  return `REACH-${block()}-${block()}`
}

let counter = 0

const rewardsSlice = createSlice({
  name: 'rewards',
  initialState,
  reducers: {
    issue: {
      reducer(state, action: PayloadAction<Voucher>) {
        state.vouchers.unshift(action.payload)
      },
      prepare(input: { rewardId: string; name: string; cost: number; validForDays: number }) {
        counter += 1
        const issuedAt = new Date()
        const expiresAt = new Date(issuedAt)
        expiresAt.setDate(expiresAt.getDate() + input.validForDays)

        return {
          payload: {
            id: `v-${Date.now().toString(36)}-${counter.toString(36)}`,
            rewardId: input.rewardId,
            name: input.name,
            cost: input.cost,
            code: makeVoucherCode(),
            issuedAt: issuedAt.toISOString(),
            expiresAt: expiresAt.toISOString(),
            status: 'active',
          } satisfies Voucher,
        }
      },
    },
    markUsed(state, action: PayloadAction<string>) {
      const voucher = state.vouchers.find((v) => v.id === action.payload)
      if (!voucher || voucher.status !== 'active') return
      voucher.status = 'used'
      voucher.usedAt = new Date().toISOString()
    },
    /**
     * Record that the code has been passed on. The voucher stays valid — it is
     * a bearer instrument, so whoever presents the code claims it. Nothing is
     * transferred inside the app, which is what keeps XP itself personal.
     */
    markShared(state, action: PayloadAction<string>) {
      const voucher = state.vouchers.find((v) => v.id === action.payload)
      if (voucher) voucher.sharedAt = new Date().toISOString()
    },
    /** Expire anything past its date, so the list tells the truth on open. */
    expireStale(state) {
      const now = Date.now()
      for (const voucher of state.vouchers) {
        if (voucher.status === 'active' && new Date(voucher.expiresAt).getTime() < now) {
          voucher.status = 'expired'
        }
      }
    },
    removeVoucher(state, action: PayloadAction<string>) {
      state.vouchers = state.vouchers.filter((v) => v.id !== action.payload)
    },
  },
})

export const { issue, markUsed, markShared, expireStale, removeVoucher } = rewardsSlice.actions
export default rewardsSlice.reducer
