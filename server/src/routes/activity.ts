import { Router } from 'express'
import { asyncRoute, HttpError } from '../errors.js'
import { requireSession, type AuthedRequest } from '../session.js'
import type { Store } from '../store.js'
import { CLIENT_ACTIVITY_KINDS, ledgerFor, recordActivity } from '../xp.js'
import { acknowledge, listIncoming, sendXp } from '../transfers.js'
import type { MemberDirectory } from '../directory.js'
import type { ActivityKind } from '../types.js'

/**
 * The XP ledger.
 *
 * The client reports what the user did; this decides what it is worth. Only
 * the five earning kinds may be claimed — bonuses are the server's to award,
 * or a client could simply post itself a weekly bonus.
 */
export function activityRoutes(store: Store, directory: MemberDirectory): Router {
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

  /**
   * Name a member before XP is sent to them, so a mistyped digit is caught by
   * the sender rather than by the stranger who receives the credit.
   */
  router.get(
    '/members/:identifier',
    asyncRoute(async (req: AuthedRequest, res) => {
      const member = await directory.lookup(req.params.identifier ?? '')
      if (!member) throw HttpError.notFound('No member matches that number.')
      if (member.id === req.user.borrowerNumber) throw HttpError.conflict('That is your own account.')
      res.json(member)
    }),
  )

  router.post(
    '/transfers',
    asyncRoute(async (req: AuthedRequest, res) => {
      const { identifier, amount, note } = (req.body ?? {}) as Record<string, unknown>
      if (typeof identifier !== 'string' || !identifier.trim()) {
        throw HttpError.badRequest('identifier is required')
      }
      if (typeof amount !== 'number') {
        throw HttpError.badRequest('amount must be a number')
      }

      const recipient = await directory.lookup(identifier)
      if (!recipient) throw HttpError.notFound('No member matches that number.')

      const result = await sendXp(
        store,
        req.user,
        recipient,
        amount,
        typeof note === 'string' ? note : undefined,
      )
      res.status(201).json(result)
    }),
  )

  router.get(
    '/transfers/incoming',
    asyncRoute(async (req: AuthedRequest, res) => {
      res.json(listIncoming(store, req.user))
    }),
  )

  router.post(
    '/transfers/ack',
    asyncRoute(async (req: AuthedRequest, res) => {
      const { ids } = (req.body ?? {}) as Record<string, unknown>
      if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string')) {
        throw HttpError.badRequest('ids must be an array of transfer ids')
      }
      await acknowledge(store, req.user, ids as string[])
      res.status(204).end()
    }),
  )

  return router
}
