import { randomUUID } from 'node:crypto'
import { Router } from 'express'
import { asyncRoute, HttpError } from '../errors.js'
import { requireSession, type AuthedRequest } from '../session.js'
import type { Store } from '../store.js'
import type { ConsultationRequest, SpaceBooking, StudySpace } from '../types.js'
import { BOOKING_SLOTS, FIXTURE_SPACES } from '../fixtures/catalogue.js'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export function spaceRoutes(store: Store): Router {
  const router = Router()
  router.use(requireSession)

  router.get(
    '/',
    asyncRoute(async (_req, res) => {
      const today = todayIso()
      const spaces: StudySpace[] = FIXTURE_SPACES.map((space) => ({
        ...space,
        // Every booking counts towards availability, whoever made it.
        bookedSlots: store.data.bookings
          .filter((booking) => booking.spaceId === space.id && booking.date === today)
          .map((booking) => booking.slot),
      }))
      res.json(spaces)
    }),
  )

  router.get(
    '/bookings',
    asyncRoute(async (req: AuthedRequest, res) => {
      const mine = store.data.bookings.filter(
        (booking) => store.data.bookingOwners[booking.id] === req.user.borrowerNumber,
      )
      res.json(mine)
    }),
  )

  router.post(
    '/bookings',
    asyncRoute(async (req: AuthedRequest, res) => {
      const { spaceId, date, slot } = (req.body ?? {}) as Record<string, unknown>

      if (typeof spaceId !== 'string' || typeof date !== 'string' || typeof slot !== 'string') {
        throw HttpError.badRequest('spaceId, date and slot are required.')
      }
      if (!ISO_DATE.test(date)) throw HttpError.badRequest('date must be YYYY-MM-DD.')
      if (!BOOKING_SLOTS.includes(slot)) throw HttpError.badRequest('That is not a bookable time.')
      if (date < todayIso()) throw HttpError.badRequest('That date is in the past.')

      const space = FIXTURE_SPACES.find((entry) => entry.id === spaceId)
      if (!space) throw HttpError.notFound('That space is not bookable.')

      const booking = await store.update((state) => {
        const taken = state.bookings.some(
          (entry) => entry.spaceId === spaceId && entry.date === date && entry.slot === slot,
        )
        if (taken) throw HttpError.conflict('That slot has just been taken. Choose another time.')

        const created: SpaceBooking = {
          id: randomUUID(),
          spaceId,
          spaceName: space.name,
          date,
          slot,
          createdAt: new Date().toISOString(),
        }
        state.bookings.push(created)
        state.bookingOwners[created.id] = req.user.borrowerNumber
        return created
      })

      res.status(201).json(booking)
    }),
  )

  router.delete(
    '/bookings/:id',
    asyncRoute(async (req: AuthedRequest, res) => {
      const { id } = req.params
      // Absent and someone-else's are both reported as not found, so the
      // endpoint cannot be used to probe for other people's bookings.
      if (store.data.bookingOwners[id] !== req.user.borrowerNumber) throw HttpError.notFound()

      await store.update((state) => {
        state.bookings = state.bookings.filter((booking) => booking.id !== id)
        delete state.bookingOwners[id]
      })
      res.status(204).end()
    }),
  )

  return router
}

export function consultationRoutes(store: Store): Router {
  const router = Router()
  router.use(requireSession)

  router.post(
    '/',
    asyncRoute(async (req: AuthedRequest, res) => {
      const { topic, details, preferredMode, preferredDate } = (req.body ?? {}) as Record<string, unknown>

      if (typeof topic !== 'string' || !topic.trim()) throw HttpError.badRequest('A topic is required.')
      if (typeof details !== 'string' || !details.trim()) throw HttpError.badRequest('Some detail is required.')
      if (!['in_person', 'video', 'email'].includes(String(preferredMode))) {
        throw HttpError.badRequest('preferredMode must be in_person, video or email.')
      }
      if (typeof preferredDate !== 'string' || !ISO_DATE.test(preferredDate)) {
        throw HttpError.badRequest('preferredDate must be YYYY-MM-DD.')
      }

      const request = await store.update((state) => {
        const created: ConsultationRequest = {
          id: randomUUID(),
          topic: topic.trim().slice(0, 200),
          details: details.trim().slice(0, 4000),
          preferredMode: preferredMode as ConsultationRequest['preferredMode'],
          preferredDate,
          submittedAt: new Date().toISOString(),
          status: 'submitted',
        }
        state.consultations.push(created)
        state.consultationOwners[created.id] = req.user.borrowerNumber
        return created
      })

      res.status(201).json(request)
    }),
  )

  router.get(
    '/',
    asyncRoute(async (req: AuthedRequest, res) => {
      res.json(
        store.data.consultations.filter(
          (request) => store.data.consultationOwners[request.id] === req.user.borrowerNumber,
        ),
      )
    }),
  )

  return router
}
