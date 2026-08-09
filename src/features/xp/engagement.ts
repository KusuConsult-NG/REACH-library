import type { AppDispatch, RootState } from '@/app/store'
import { ACTIVITY_LABELS, XP_MILESTONES, XP_VALUES } from '@/config/xp'
import { push } from '@/features/notifications/notificationsSlice'
import { toast } from '@/features/ui/uiSlice'
import type { ActivityKind } from '@/types'
import { weekKey } from '@/utils/date'
import { award, canEarn, markWeeklyBonusPaid, xpEarnedInWeek } from './xpSlice'
import { levelFromXp, milestonesCrossed } from './levels'

export interface EngagementInput {
  kind: ActivityKind
  resourceId?: string
  resourceTitle?: string
  /** Suppress the reward toast for background activity such as OPAC browsing. */
  silent?: boolean
  pending?: boolean
}

/**
 * The single entry point for earning XP.
 *
 * It applies daily caps, records the activity, and raises the follow-on effects
 * a reward should have: a toast, a level-up notice, milestone notifications and
 * the weekly-goal bonus. Screens call this rather than dispatching `award`
 * directly, so every XP path behaves identically.
 */
export function recordEngagement(input: EngagementInput) {
  return (dispatch: AppDispatch, getState: () => RootState) => {
    const before = getState()
    const earns = canEarn(before.xp, input.kind)
    const xpValue = earns ? XP_VALUES[input.kind] : 0
    const beforeXp = before.xp.totalXp
    const beforeLevel = levelFromXp(beforeXp)

    dispatch(
      award(
        {
          kind: input.kind,
          resourceId: input.resourceId,
          resourceTitle: input.resourceTitle,
          pending: input.pending,
        },
        earns,
      ),
    )

    if (!input.silent) {
      if (earns) {
        dispatch(toast(`+${xpValue} XP · ${ACTIVITY_LABELS[input.kind]}`, 'xp', xpValue))
      } else {
        dispatch(toast(`Daily limit reached for this action — activity still recorded.`, 'info'))
      }
    }

    if (!earns) return

    const after = getState()
    const afterXp = after.xp.totalXp
    const afterLevel = levelFromXp(afterXp)
    const prefs = after.auth.notifications

    if (afterLevel.level > beforeLevel.level) {
      dispatch(toast(`Level ${afterLevel.level} — ${afterLevel.title}`, 'success'))
      if (prefs.xpMilestones) {
        dispatch(
          push({
            kind: 'xp_milestone',
            title: `You reached level ${afterLevel.level}`,
            body: `${afterLevel.title}. ${afterLevel.isMax ? 'You have reached the highest level.' : `${afterLevel.xpToNext} XP to the next level.`}`,
            link: '/profile',
            dedupeKey: `level:${afterLevel.level}`,
          }),
        )
      }
    }

    for (const milestone of milestonesCrossed(beforeXp, afterXp, XP_MILESTONES)) {
      if (!prefs.xpMilestones) break
      dispatch(
        push({
          kind: 'xp_milestone',
          title: `${milestone.toLocaleString()} XP earned`,
          body: 'Your engagement with library resources is adding up. Keep it going this week.',
          link: '/profile',
          dedupeKey: `milestone:${milestone}`,
        }),
      )
    }

    maybePayWeeklyBonus(dispatch, getState)
  }
}

/** Pay the weekly-goal bonus once per ISO week, the first time the target is met. */
function maybePayWeeklyBonus(dispatch: AppDispatch, getState: () => RootState) {
  const state = getState()
  const week = weekKey()
  if (state.xp.bonusPaidWeeks.includes(week)) return
  if (xpEarnedInWeek(state.xp) < state.xp.weeklyGoal) return

  dispatch(markWeeklyBonusPaid(week))
  dispatch(award({ kind: 'weekly_goal_bonus' }, true))
  dispatch(toast(`Weekly goal met — bonus +${XP_VALUES.weekly_goal_bonus} XP`, 'xp', XP_VALUES.weekly_goal_bonus))
  if (getState().auth.notifications.xpMilestones) {
    dispatch(
      push({
        kind: 'xp_milestone',
        title: 'Weekly goal completed',
        body: `You hit your ${state.xp.weeklyGoal} XP target for the week and earned a ${XP_VALUES.weekly_goal_bonus} XP bonus.`,
        link: '/profile',
        dedupeKey: `weekly:${week}`,
      }),
    )
  }
}
