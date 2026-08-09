/**
 * Thin, failure-tolerant wrapper over localStorage.
 *
 * Private-mode browsers and storage-quota errors must never take the app down,
 * so every operation degrades to a no-op / default instead of throwing.
 */

const PREFIX = 'reach:'

export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    if (raw == null) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    /* storage unavailable or full — the in-memory state remains authoritative */
  }
}

export function remove(key: string): void {
  try {
    localStorage.removeItem(PREFIX + key)
  } catch {
    /* no-op */
  }
}

export function clearAll(): void {
  try {
    const doomed: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(PREFIX)) doomed.push(key)
    }
    doomed.forEach((k) => localStorage.removeItem(k))
  } catch {
    /* no-op */
  }
}
