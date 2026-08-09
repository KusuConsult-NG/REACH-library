import { createHmac, timingSafeEqual } from 'node:crypto'
import type { NextFunction, Request, Response } from 'express'
import { config } from './config.js'
import { HttpError } from './errors.js'
import type { User } from './types.js'

/**
 * Stateless session tokens: `base64url(payload).base64url(hmac)`.
 *
 * A JWT library would add a dependency for the two things we actually need —
 * an integrity check and an expiry — so the same job is done with node:crypto.
 * The token carries only the borrower identity the circulation routes need.
 */

export interface SessionPayload {
  user: User
  /** Seconds since epoch. */
  exp: number
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url')
}

function sign(payload: string): string {
  return createHmac('sha256', config.sessionSecret).update(payload).digest('base64url')
}

export function issueToken(user: User, ttlSeconds = config.sessionTtlSeconds): SessionPayload & { token: string } {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds
  const payload: SessionPayload = { user, exp }
  const encoded = b64url(JSON.stringify(payload))
  return { ...payload, token: `${encoded}.${sign(encoded)}` }
}

export function verifyToken(token: string): SessionPayload {
  const [encoded, signature] = token.split('.')
  if (!encoded || !signature) throw HttpError.unauthorized()

  const expected = Buffer.from(sign(encoded))
  const actual = Buffer.from(signature)
  // Length must match before timingSafeEqual, which throws on a mismatch.
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    throw HttpError.unauthorized()
  }

  let payload: SessionPayload
  try {
    payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SessionPayload
  } catch {
    throw HttpError.unauthorized()
  }

  if (!payload?.user?.borrowerNumber || typeof payload.exp !== 'number') throw HttpError.unauthorized()
  if (payload.exp * 1000 <= Date.now()) throw HttpError.unauthorized()

  return payload
}

export interface AuthedRequest extends Request {
  user: User
}

/** Reject anything without a valid bearer token. */
export function requireSession(req: Request, _res: Response, next: NextFunction) {
  const header = req.header('authorization') ?? ''
  const [scheme, token] = header.split(' ')
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    next(HttpError.unauthorized('Sign in to continue.'))
    return
  }

  try {
    ;(req as AuthedRequest).user = verifyToken(token).user
    next()
  } catch (error) {
    next(error)
  }
}
