import { Router } from 'express'
import { asyncRoute, HttpError } from '../errors.js'
import { authenticate, type PatronLookup } from '../idp.js'
import { issueToken, requireSession, type AuthedRequest } from '../session.js'

export function authRoutes(lookupPatron?: PatronLookup): Router {
  const router = Router()

  router.post(
    '/login',
    asyncRoute(async (req, res) => {
      const { username, password } = (req.body ?? {}) as Record<string, unknown>
      if (typeof username !== 'string' || typeof password !== 'string') {
        throw HttpError.badRequest('Enter your university username and password.')
      }

      const user = await authenticate(username, password, lookupPatron)
      const session = issueToken(user)

      res.json({
        user,
        token: session.token,
        expiresAt: new Date(session.exp * 1000).toISOString(),
      })
    }),
  )

  // Tokens are stateless, so signing out is the client discarding its copy.
  // The endpoint exists so that becomes a revocation point later without a
  // client change.
  router.post('/logout', requireSession, (_req, res) => {
    res.status(204).end()
  })

  router.get('/me', requireSession, (req, res) => {
    res.json((req as AuthedRequest).user)
  })

  return router
}
