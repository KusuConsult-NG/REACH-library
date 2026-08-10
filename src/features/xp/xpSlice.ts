import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import { DAILY_CAPS, WEEKLY_XP_GOAL, XP_VALUES } from '@/config/xp'
import type { Activity, ActivityKind } from '@/types'
import { dayKey, weekKey } from '@/utils/date'

export interface XpState {
  /**
   * Everything ever earned. Never decreases, so spending XP cannot cost you a
   * level — this is what drives progression and the library's impact figures.
   */
  totalXp: number
  /**
   * What is left to spend. Rises with the same earnings and falls on
   * redemption. Kept separate from totalXp precisely so the two never fight.
   */
  balance: number
  activities: Activity[]
  weeklyGoal: number
  /** ISO weeks whose goal bonus has already been paid, so it pays once. */
  bonusPaidWeeks: string[]
  /** Consecutive days on which the user recorded at least one activity. */
  streak: number
  lastActiveDay: string | null
}

const initialState: XpState = {
  totalXp: 0,
  balance: 0,
  activities: [],
  weeklyGoal: WEEKLY_XP_GOAL,
  bonusPaidWeeks: [],
  streak: 0,
  lastActiveDay: null,
}

/** Keep the activity log bounded — the dashboard only ever reads the recent tail. */
const MAX_ACTIVITIES = 300

export interface AwardInput {
  kind: ActivityKind
  resourceId?: string
  resourceTitle?: string
  /** Marked when recorded offline; cleared by the sync pass. */
  pending?: boolean
  at?: string
}

/**
 * True when `kind` still has room under its daily cap.
 * Uncapped activities (borrowing, reservations, bonuses) always qualify.
 */
export function canEarn(state: XpState, kind: ActivityKind, now: Date = new Date()): boolean {
  const cap = DAILY_CAPS[kind]
  if (cap == null) return true
  const today = dayKey(now)
  const used = state.activities.filter((a) => a.kind === kind && dayKey(a.at) === today).length
  return used < cap
}

export function xpEarnedInWeek(state: XpState, now: Date = new Date()): number {
  const week = weekKey(now)
  return state.activities
    .filter((a) => weekKey(a.at) === week)
    .reduce((sum, a) => sum + a.xp, 0)
}

let counter = 0
function activityId() {
  counter += 1
  return `act-${Date.now().toString(36)}-${counter.toString(36)}`
}

const xpSlice = createSlice({
  name: 'xp',
  initialState,
  reducers: {
    /**
     * Record an activity and its XP. Capped activities beyond their daily
     * allowance are still logged with 0 XP so the dashboard stays honest about
     * what the user did — they simply stop paying out.
     */
    award: {
      reducer(state, action: PayloadAction<Activity>) {
        const activity = action.payload
        state.activities.unshift(activity)
        if (state.activities.length > MAX_ACTIVITIES) state.activities.length = MAX_ACTIVITIES
        state.totalXp += activity.xp
        state.balance += activity.xp

        const today = dayKey(activity.at)
        if (state.lastActiveDay !== today) {
          const yesterday = dayKey(new Date(new Date(today).getTime() - 86_400_000))
          state.streak = state.lastActiveDay === yesterday ? state.streak + 1 : 1
          state.lastActiveDay = today
        }
      },
      prepare(input: AwardInput, earnsXp = true) {
        const at = input.at ?? new Date().toISOString()
        return {
          payload: {
            id: activityId(),
            kind: input.kind,
            xp: earnsXp ? XP_VALUES[input.kind] : 0,
            resourceId: input.resourceId,
            resourceTitle: input.resourceTitle,
            at,
            pending: input.pending,
          } satisfies Activity,
        }
      },
    },
    markWeeklyBonusPaid(state, action: PayloadAction<string>) {
      if (!state.bonusPaidWeeks.includes(action.payload)) {
        state.bonusPaidWeeks.push(action.payload)
      }
    },
    setWeeklyGoal(state, action: PayloadAction<number>) {
      state.weeklyGoal = Math.max(50, Math.min(1000, Math.round(action.payload / 10) * 10))
    },
    /** Clear the `pending` flag once a queued activity has been accepted server-side. */
    confirmPending(state, action: PayloadAction<string[]>) {
      const ids = new Set(action.payload)
      state.activities = state.activities.map((a) => (ids.has(a.id) ? { ...a, pending: false } : a))
    },
    /** Deduct the cost of a redemption. Never touches totalXp. */
    spend(state, action: PayloadAction<number>) {
      state.balance = Math.max(0, state.balance - action.payload)
    },
    /** Refund a redemption that could not be fulfilled. */
    refund(state, action: PayloadAction<number>) {
      state.balance += action.payload
    },
    resetXp() {
      return initialState
    },
  },
})

export const { award, markWeeklyBonusPaid, setWeeklyGoal, confirmPending, spend, refund, resetXp } =
  xpSlice.actions
export default xpSlice.reducer
