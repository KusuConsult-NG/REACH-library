import { Router } from 'express'
import { asyncRoute, HttpError } from '../errors.js'
import { requireSession, type AuthedRequest } from '../session.js'
import type { LibraryService, SearchParams } from '../service.js'
import type { Store } from '../store.js'
import type { TrendingEntry } from '../types.js'

const SORTS = new Set(['relevance', 'year', 'popular', 'title'])

function parseSearch(query: Record<string, unknown>): SearchParams {
  const string = (key: string) => (typeof query[key] === 'string' ? (query[key] as string) : '')
  const csv = (key: string) => string(key).split(',').map((entry) => entry.trim()).filter(Boolean)

  const page = Number(string('page') || 1)
  const pageSize = Number(string('pageSize') || 10)
  const sort = string('sort')

  return {
    query: string('q'),
    types: csv('type'),
    subjects: csv('subject'),
    availableOnly: string('available') === '1',
    repositoryOnly: string('repository') === '1',
    sort: (SORTS.has(sort) ? sort : 'relevance') as SearchParams['sort'],
    // Clamp rather than reject: a bad page number should not fail a search.
    page: Number.isFinite(page) ? Math.max(1, Math.floor(page)) : 1,
    pageSize: Number.isFinite(pageSize) ? Math.min(50, Math.max(1, Math.floor(pageSize))) : 10,
  }
}

export function catalogueRoutes(service: LibraryService, store: Store): Router {
  const router = Router()
  router.use(requireSession)

  router.get(
    '/search',
    asyncRoute(async (req, res) => {
      res.json(await service.search(parseSearch(req.query as Record<string, unknown>)))
    }),
  )

  router.get(
    '/trending',
    asyncRoute(async (req, res) => {
      const department = typeof req.query.department === 'string' ? req.query.department : undefined

      // Trending is derived from the aggregate access counter, never from any
      // individual's history — the counter records nothing about who read what.
      const counts = Object.entries(store.data.accessCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 12)

      const resources = await service.getResources(counts.map(([id]) => id))
      const byId = new Map(resources.map((resource) => [resource.id, resource]))

      const entries: TrendingEntry[] = counts
        .map(([id, accessCount], index) => {
          const resource = byId.get(id)
          if (!resource) return undefined
          return {
            resourceId: id,
            title: resource.title,
            department: resource.subjects[0] ?? 'University of Jos',
            accessCount,
            delta: 0,
            rank: index,
          }
        })
        .filter((entry): entry is TrendingEntry & { rank: number } => Boolean(entry))
        .filter((entry) => !department || entry.department.toLowerCase().includes(department.toLowerCase()))
        .slice(0, 6)
        .map(({ rank: _rank, ...entry }) => entry)

      res.json(entries)
    }),
  )

  router.get(
    '/batch',
    asyncRoute(async (req, res) => {
      const ids = typeof req.query.ids === 'string' ? req.query.ids.split(',').filter(Boolean) : []
      if (ids.length > 50) throw HttpError.badRequest('Too many ids requested.')
      res.json(await service.getResources(ids))
    }),
  )

  router.get(
    '/:id',
    asyncRoute(async (req: AuthedRequest, res) => {
      const resource = await service.getResource(req.params.id)
      if (!resource) throw HttpError.notFound()
      res.json(resource)
    }),
  )

  return router
}
