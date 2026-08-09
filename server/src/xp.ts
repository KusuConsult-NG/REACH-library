import { randomUUID } from 'node:crypto'
import type { Store } from './store.js'
import type { Activity, ActivityKind, User } from './types.js'

/**
 * Server-side XP.
 *
 * The web app computes XP locally so the dashboard works offline, but the
 * client copy is advisory: caps enforced in a browser are not enforced at all.
 * This module is the source of truth, and the values here must stay in step
 * with `src/config/xp.ts` in the web app.
 */

export const XP_VALUES: Record<ActivityKind, number> = {
  opac_browse: 5,
  eresource_access: 10,
  resource_download: 20,
  reservation: 30,
  physical_borrow: 50,
  weekly_goal_bonus: 40,
  streak_bonus: 15,
}

export const DAILY_CAPS: Partial<Record<ActivityKind, number>> = {
  opac_browse: 6,
  eresource_access: 12,
  resource_download: 10,
}

export const LEVEL_THRESHOLDS = [
  0, 100, 250, 500, 850, 1300, 1900, 2650, 3550, 4600, 5900, 7400, 9100, 11000, 13200,
] as const

export const WEEKLY_XP_GOAL = 150

export const ACTIVITY_KINDS = Object.keys(XP_VALUES) as ActivityKind[]

/** Kinds a client may claim. Bonuses are awarded by this module alone. */
export const CLIENT_ACTIVITY_KINDS: ActivityKind[] = [
  'opac_browse',
  'eresource_access',
  'resource_download',
  'reservation',
  'physical_borrow',
]

export function levelFor(totalXp: number): number {
  let level = 1
  for (let index = 0; index < LEVEL_THRESHOLDS.length; index++) {
    if (totalXp >= LEVEL_THRESHOLDS[index]) level = index + 1
    else break
  }
  return level
}

function dayKey(iso: string): string {
  return iso.slice(0, 10)
}

/** ISO-8601 week identifier, matching the web app's `weekKey`. */
export function weekKey(date: Date = new Date()): string {
  const value = new Date(date.getTime())
  value.setHours(0, 0, 0, 0)
  value.setDate(value.getDate() + 3 - ((value.getDay() + 6) % 7))
  const isoYear = value.getFullYear()
  const firstThursday = new Date(isoYear, 0, 4)
  firstThursday.setDate(firstThursday.getDate() + 3 - ((firstThursday.getDay() + 6) % 7))
  const week = 1 + Math.round((value.getTime() - firstThursday.getTime()) / (7 * 24 * 60 * 60 * 1000))
  return `${isoYear}-W${String(week).padStart(2, '0')}`
}

export interface RecordResult {
  activity: Activity
  /** Paid alongside the activity when the weekly goal was met by it. */
  bonus?: Activity
  totalXp: number
  level: number
  /** False when the daily cap was hit: the activity is logged at zero XP. */
  earned: boolean
}

/**
 * Record one activity for a borrower, applying the daily cap and paying the
 * weekly bonus at most once per ISO week.
 */
export async function recordActivity(
  store: Store,
  user: User,
  input: { kind: ActivityKind; resourceId?: string; resourceTitle?: string },
): Promise<RecordResult> {
  const now = new Date()
  const nowIso = now.toISOString()
  const today = dayKey(nowIso)
  const borrower = user.borrowerNumber

  return store.update((state) => {
    const ledger = (state.activity[borrower] ??= [])

    const cap = DAILY_CAPS[input.kind]
    const usedToday = cap
      ? ledger.filter((entry) => entry.kind === input.kind && dayKey(entry.at) === today).length
      : 0
    const earned = cap == null || usedToday < cap

    const activity: Activity = {
      id: randomUUID(),
      kind: input.kind,
      xp: earned ? XP_VALUES[input.kind] : 0,
      resourceId: input.resourceId,
      resourceTitle: input.resourceTitle,
      at: nowIso,
    }
    ledger.unshift(activity)

    if (input.resourceId) {
      state.accessCounts[input.resourceId] = (state.accessCounts[input.resourceId] ?? 0) + 1
    }

    let bonus: Activity | undefined
    const week = weekKey(now)
    const paid = (state.bonusWeeks[borrower] ??= [])
    if (earned && !paid.includes(week)) {
      const weekTotal = ledger
        .filter((entry) => weekKey(new Date(entry.at)) === week)
        .reduce((sum, entry) => sum + entry.xp, 0)

      if (weekTotal >= WEEKLY_XP_GOAL) {
        paid.push(week)
        bonus = {
          id: randomUUID(),
          kind: 'weekly_goal_bonus',
          xp: XP_VALUES.weekly_goal_bonus,
          at: nowIso,
        }
        ledger.unshift(bonus)
      }
    }

    // Keep the ledger bounded; the client only ever renders the recent tail.
    if (ledger.length > 500) ledger.length = 500

    const totalXp = ledger.reduce((sum, entry) => sum + entry.xp, 0)
    return { activity, bonus, totalXp, level: levelFor(totalXp), earned }
  })
}

export function ledgerFor(store: Store, user: User): { activities: Activity[]; totalXp: number; level: number } {
  const activities = store.data.activity[user.borrowerNumber] ?? []
  const totalXp = activities.reduce((sum, entry) => sum + entry.xp, 0)
  return { activities, totalXp, level: levelFor(totalXp) }
}
