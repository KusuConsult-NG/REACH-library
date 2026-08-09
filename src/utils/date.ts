/** Date helpers shared across XP accounting, loans and notifications. */

export function dayKey(date: Date | string = new Date()): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toISOString().slice(0, 10)
}

/** ISO-8601 week identifier, e.g. `2026-W32`, used to scope weekly XP goals. */
export function weekKey(date: Date | string = new Date()): string {
  const d = new Date(typeof date === 'string' ? date : date.getTime())
  d.setHours(0, 0, 0, 0)
  // Thursday of the current week determines the ISO year.
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
  const isoYear = d.getFullYear()
  const firstThursday = new Date(isoYear, 0, 4)
  firstThursday.setDate(firstThursday.getDate() + 3 - ((firstThursday.getDay() + 6) % 7))
  const week = 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 24 * 60 * 60 * 1000))
  return `${isoYear}-W${String(week).padStart(2, '0')}`
}

export function daysUntil(iso: string, from: Date = new Date()): number {
  const target = new Date(iso)
  const start = new Date(from)
  start.setHours(0, 0, 0, 0)
  target.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - start.getTime()) / (24 * 60 * 60 * 1000))
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function relativeTime(iso: string, now: Date = new Date()): string {
  const diff = new Date(iso).getTime() - now.getTime()
  const abs = Math.abs(diff)
  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour

  if (abs < minute) return 'just now'
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
  if (abs < hour) return rtf.format(Math.round(diff / minute), 'minute')
  if (abs < day) return rtf.format(Math.round(diff / hour), 'hour')
  if (abs < 30 * day) return rtf.format(Math.round(diff / day), 'day')
  return formatDate(iso)
}

/** Human phrasing for a due date, e.g. "due in 3 days" / "5 days overdue". */
export function dueLabel(iso: string, now: Date = new Date()): string {
  const days = daysUntil(iso, now)
  if (days < 0) return `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} overdue`
  if (days === 0) return 'due today'
  if (days === 1) return 'due tomorrow'
  return `due in ${days} days`
}
