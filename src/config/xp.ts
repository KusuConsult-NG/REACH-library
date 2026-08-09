import type { ActivityKind } from '@/types'

/** XP awarded per activity — the values fixed by the PRD (§3.3). */
export const XP_VALUES: Record<ActivityKind, number> = {
  opac_browse: 5,
  eresource_access: 10,
  resource_download: 20,
  reservation: 30,
  physical_borrow: 50,
  weekly_goal_bonus: 40,
  streak_bonus: 15,
}

export const ACTIVITY_LABELS: Record<ActivityKind, string> = {
  opac_browse: 'Browsed the catalogue',
  eresource_access: 'Opened an e-resource',
  resource_download: 'Downloaded a resource',
  reservation: 'Reserved a book',
  physical_borrow: 'Borrowed a book',
  weekly_goal_bonus: 'Weekly goal completed',
  streak_bonus: 'Visit streak bonus',
}

/**
 * Daily ceiling on how many times each activity can earn XP.
 * Browsing is cheap to repeat, so it is capped hardest — the reward should
 * track genuine engagement rather than tab-refreshing.
 */
export const DAILY_CAPS: Partial<Record<ActivityKind, number>> = {
  opac_browse: 6,
  eresource_access: 12,
  resource_download: 10,
}

/** Cumulative XP required to *enter* each level. */
export const LEVEL_THRESHOLDS = [
  0, 100, 250, 500, 850, 1300, 1900, 2650, 3550, 4600, 5900, 7400, 9100, 11000, 13200,
] as const

export const LEVEL_TITLES = [
  'Freshman Reader',
  'Library Regular',
  'Stack Explorer',
  'Reference Seeker',
  'Diligent Scholar',
  'Research Apprentice',
  'Subject Specialist',
  'Senior Scholar',
  'Repository Contributor',
  'Knowledge Steward',
  'Master Researcher',
  'Distinguished Fellow',
  'Library Laureate',
  'REACH Luminary',
  'Keeper of the Stacks',
] as const

/** Default weekly XP target; met targets pay `weekly_goal_bonus`. */
export const WEEKLY_XP_GOAL = 150

/** Milestones that raise an in-app notification when crossed. */
export const XP_MILESTONES = [100, 500, 1000, 2500, 5000, 10000] as const
