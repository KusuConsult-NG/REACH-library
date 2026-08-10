/**
 * Opt-in tracing for the seams where this app actually goes wrong.
 *
 * Every bug worth chasing here has lived on one of three boundaries: which
 * borrower a piece of state belongs to, whether a write reached disk, and
 * whether a request's answer arrived before something else overwrote it. Those
 * are invisible in a stack trace and obvious in a log line, so the probes are
 * placed there and nowhere else — a log on every action is noise that hides the
 * three lines that matter.
 *
 * Off by default in a build. Turn it on from the console, on a real device,
 * without a redeploy:
 *
 *   localStorage.setItem('reach:debug', '1'); location.reload()
 *
 * and off again with `localStorage.removeItem('reach:debug')`.
 */

let cached: boolean | null = null

export function debugEnabled(): boolean {
  if (cached != null) return cached
  try {
    cached = localStorage.getItem('reach:debug') === '1'
  } catch {
    cached = false
  }
  return cached
}

/**
 * `scope` names the seam, not the file — `identity`, `persist`, `transfer`,
 * `api`, `queue` — so a filter of `reach:transfer` in the console shows one
 * story end to end rather than one module's chatter.
 */
export function debug(scope: string, message: string, data?: Record<string, unknown>): void {
  if (!debugEnabled()) return
  // eslint-disable-next-line no-console
  console.info(`reach:${scope}`, message, data ?? '')
}
