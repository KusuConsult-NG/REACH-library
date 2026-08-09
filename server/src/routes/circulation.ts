import { Router } from 'express'
import { asyncRoute, HttpError } from '../errors.js'
import { requireSession, type AuthedRequest } from '../session.js'
import type { LibraryService } from '../service.js'
import type { Store } from '../store.js'
import { recordActivity } from '../xp.js'

function resourceIdFrom(body: unknown): string {
  const value = (body as { resourceId?: unknown } | null)?.resourceId
  if (typeof value !== 'string' || !value.trim()) {
    throw HttpError.badRequest('resourceId is required.')
  }
  return value.trim()
}

export function circulationRoutes(service: LibraryService, store: Store): Router {
  const router = Router()
  router.use(requireSession)

  router.get(
    '/loans',
    asyncRoute(async (req: AuthedRequest, res) => {
      res.json(await service.listLoans(req.user))
    }),
  )

  router.get(
    '/holds',
    asyncRoute(async (req: AuthedRequest, res) => {
      res.json(await service.listHolds(req.user))
    }),
  )

  router.post(
    '/checkout',
    asyncRoute(async (req: AuthedRequest, res) => {
      const resourceId = resourceIdFrom(req.body)
      const loan = await service.checkout(req.user, resourceId)
      const resource = await service.getResource(resourceId).catch(() => undefined)
      await recordActivity(store, req.user, {
        kind: 'physical_borrow',
        resourceId,
        resourceTitle: resource?.title,
      })
      res.status(201).json(loan)
    }),
  )

  router.post(
    '/loans/:id/renew',
    asyncRoute(async (req: AuthedRequest, res) => {
      res.json(await service.renew(req.user, req.params.id))
    }),
  )

  router.post(
    '/loans/:id/return',
    asyncRoute(async (req: AuthedRequest, res) => {
      res.json(await service.returnLoan(req.user, req.params.id))
    }),
  )

  router.post(
    '/holds',
    asyncRoute(async (req: AuthedRequest, res) => {
      const resourceId = resourceIdFrom(req.body)

      // Replayed from the offline queue, a duplicate hold is the client
      // catching up rather than a new request: return the existing one so the
      // retry succeeds instead of surfacing an error the user cannot act on.
      const existing = (await service.listHolds(req.user)).find(
        (hold) => hold.resourceId === resourceId && hold.status !== 'cancelled',
      )
      if (existing) {
        res.status(200).json(existing)
        return
      }

      const hold = await service.placeHold(req.user, resourceId)
      const resource = await service.getResource(resourceId).catch(() => undefined)
      await recordActivity(store, req.user, {
        kind: 'reservation',
        resourceId,
        resourceTitle: resource?.title,
      })
      res.status(201).json(hold)
    }),
  )

  router.delete(
    '/holds/:id',
    asyncRoute(async (req: AuthedRequest, res) => {
      await service.cancelHold(req.user, req.params.id)
      res.status(204).end()
    }),
  )

  return router
}
