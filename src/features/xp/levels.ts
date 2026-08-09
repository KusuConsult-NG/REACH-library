import { LEVEL_THRESHOLDS, LEVEL_TITLES } from '@/config/xp'
import type { LevelInfo } from '@/types'

/**
 * Resolve a total XP figure into level, title and progress toward the next level.
 * Levels are 1-indexed; the final level absorbs all XP beyond the last threshold.
 */
export function levelFromXp(totalXp: number): LevelInfo {
  const xp = Math.max(0, Math.floor(totalXp))

  let index = 0
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (xp >= LEVEL_THRESHOLDS[i]) index = i
    else break
  }

  const isMax = index === LEVEL_THRESHOLDS.length - 1
  const floor = LEVEL_THRESHOLDS[index]
  const ceiling = isMax ? floor : LEVEL_THRESHOLDS[index + 1]
  const xpForLevel = isMax ? 0 : ceiling - floor
  const xpIntoLevel = xp - floor

  return {
    level: index + 1,
    title: LEVEL_TITLES[index],
    currentXp: xp,
    xpIntoLevel,
    xpForLevel,
    xpToNext: isMax ? 0 : ceiling - xp,
    progress: isMax ? 1 : xpIntoLevel / xpForLevel,
    isMax,
  }
}

/** Milestones crossed by moving from `before` XP to `after` XP. */
export function milestonesCrossed(before: number, after: number, milestones: readonly number[]) {
  return milestones.filter((m) => before < m && after >= m)
}
