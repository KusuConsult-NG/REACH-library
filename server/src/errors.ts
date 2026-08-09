import type { NextFunction, Request, Response } from 'express'

/**
 * Status codes the PWA branches on (see `docs/BACKEND.md`):
 *   401 -> session expired, returns to sign-in
 *   404 -> record not found
 *   409 -> unavailable; the client shows the message and does not retry
 *   5xx -> transient; a queued offline action stays queued and retries
 */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly detail?: unknown,
  ) {
    super(message)
    this.name = 'HttpError'
  }

  static unauthorized(message = 'Your session has expired. Please sign in again.') {
    return new HttpError(401, message)
  }

  static notFound(message = 'That record could not be found.') {
    return new HttpError(404, message)
  }

  static conflict(message: string) {
    return new HttpError(409, message)
  }

  static badRequest(message: string) {
    return new HttpError(400, message)
  }

  static upstream(message = 'The library service is temporarily unavailable.') {
    return new HttpError(502, message)
  }
}

/** Wrap an async handler so a rejected promise reaches the error middleware. */
export function asyncRoute<T extends Request>(
  handler: (req: T, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req as T, res, next).catch(next)
  }
}

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ message: 'No such endpoint.' })
}

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (error instanceof HttpError) {
    res.status(error.status).json({ message: error.message, detail: error.detail })
    return
  }

  // Anything unrecognised is a bug on this side: report it as transient so the
  // client retries rather than discarding the user's queued action.
  console.error('[reach-api] unhandled error', error)
  res.status(500).json({ message: 'The library service is temporarily unavailable.' })
}
