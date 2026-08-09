import { Router } from 'express'
import { asyncRoute, HttpError } from '../errors.js'
import { requireSession, type AuthedRequest } from '../session.js'
import type { Store } from '../store.js'
import { CLIENT_ACTIVITY_KINDS, ledgerFor, recordActivity } from '../xp.js'
import type { ActivityKind } from '../types.js'

/**
 * The XP ledger.
 *
 * The client reports what the user did; this decides what it is worth. Only
 * the five earning kinds may be claimed — bonuses are the server's to award,
 * or a client could simply post itself a weekly bonus.
 */
export function activityRoutes(store: Store): Router {
  const router = Router()
  router.use(requireSession)

  router.get(
    '/',
    asyncRoute(async (req: AuthedRequest, res) => {
      res.json(ledgerFor(store, req.user))
    }),
  )

  router.post(
    '/',
    asyncRoute(async (req: AuthedRequest, res) => {
      const { kind, resourceId, resourceTitle } = (req.body ?? {}) as Record<string, unknown>

      if (!CLIENT_ACTIVITY_KINDS.includes(kind as ActivityKind)) {
        throw HttpError.badRequest(`kind must be one of: ${CLIENT_ACTIVITY_KINDS.join(', ')}`)
      }

      const result = await recordActivity(store, req.user, {
        kind: kind as ActivityKind,
        resourceId: typeof resourceId === 'string' ? resourceId : undefined,
        resourceTitle: typeof resourceTitle === 'string' ? resourceTitle.slice(0, 300) : undefined,
      })

      res.status(201).json(result)
    }),
  )

  return router
}
