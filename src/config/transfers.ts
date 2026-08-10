/**
 * Rules for sending XP to another member.
 *
 * Only the spendable balance moves. Lifetime XP — the figure that sets levels
 * and feeds the library's impact reporting — is never transferable, so a
 * transfer cannot manufacture engagement that did not happen.
 */

/** Smallest transfer worth the audit row it creates. */
export const MIN_TRANSFER = 50

/** Most one member may send in a single ISO week, across all recipients. */
export const WEEKLY_TRANSFER_LIMIT = 1000

/** Transfers are logged; this bounds how much history the client keeps. */
export const MAX_TRANSFER_HISTORY = 100
