import { MockLibraryApi } from './mock'
import { KohaLibraryApi } from './koha'
import type { LibraryApi } from './types'

/**
 * Point the app at a real backend by setting `VITE_API_BASE_URL` (the REACH
 * Express proxy in front of Koha). With the variable unset the app runs entirely
 * on seeded local data, which is what makes the demo build installable and
 * fully explorable offline.
 */
const baseUrl = import.meta.env.VITE_API_BASE_URL as string | undefined

export const api: LibraryApi = baseUrl ? new KohaLibraryApi(baseUrl) : new MockLibraryApi()

export const usingLiveBackend = Boolean(baseUrl)

/**
 * Discard any state the demo backend is holding in memory. A no-op against a
 * live backend, where the server owns the record.
 */
export function resetLocalBackend() {
  if (api instanceof MockLibraryApi) api.reload()
}

export * from './types'
