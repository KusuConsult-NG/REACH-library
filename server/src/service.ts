import type { Hold, Loan, Resource, SearchResult, User, UserRole } from './types.js'

export interface SearchParams {
  query: string
  types: string[]
  subjects: string[]
  availableOnly: boolean
  repositoryOnly: boolean
  sort: 'relevance' | 'year' | 'popular' | 'title'
  page: number
  pageSize: number
}

/**
 * Everything the circulation and catalogue routes need, so the routes are
 * identical whether Koha or the dev fixture is behind them.
 */
export interface LibraryService {
  search(params: SearchParams): Promise<SearchResult>
  getResource(id: string): Promise<Resource | undefined>
  getResources(ids: string[]): Promise<Resource[]>

  listLoans(user: User): Promise<Loan[]>
  listHolds(user: User): Promise<Hold[]>
  checkout(user: User, resourceId: string): Promise<Loan>
  renew(user: User, loanId: string): Promise<Loan>
  returnLoan(user: User, loanId: string): Promise<Loan>
  placeHold(user: User, resourceId: string): Promise<Hold>
  cancelHold(user: User, holdId: string): Promise<void>
}

/**
 * Circulation policy by borrower category.
 *
 * Koha enforces its own rules and its answer wins; these are used to fill in
 * `maxRenewals` when Koha does not report it, and by the dev fixture.
 */
export const LOAN_RULES: Record<UserRole, { limit: number; days: number; renewals: number }> = {
  undergraduate: { limit: 4, days: 14, renewals: 2 },
  postgraduate: { limit: 8, days: 21, renewals: 3 },
  faculty: { limit: 12, days: 30, renewals: 4 },
  staff: { limit: 6, days: 21, renewals: 3 },
  visiting: { limit: 2, days: 7, renewals: 1 },
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

/** Apply the query/filter/sort/paginate pipeline to an in-memory record set. */
export function searchRecords(records: Resource[], params: SearchParams): SearchResult {
  const terms = params.query.toLowerCase().split(/\s+/).filter(Boolean)

  const scored = records
    .map((resource) => {
      const haystack = [
        resource.title,
        resource.authors.join(' '),
        resource.subjects.join(' '),
        resource.publisher ?? '',
        resource.isbn ?? '',
        resource.abstract ?? '',
      ]
        .join(' ')
        .toLowerCase()

      let score = 0
      for (const term of terms) {
        if (!haystack.includes(term)) return { resource, score: -1 }
        if (resource.title.toLowerCase().includes(term)) score += 10
        if (resource.authors.join(' ').toLowerCase().includes(term)) score += 6
        if (resource.subjects.join(' ').toLowerCase().includes(term)) score += 4
        score += 1
      }
      return { resource, score }
    })
    .filter((entry) => entry.score >= 0)

  const filtered = scored.filter(({ resource }) => {
    if (params.types.length && !params.types.includes(resource.type)) return false
    if (params.subjects.length && !resource.subjects.some((s) => params.subjects.includes(s))) return false
    if (params.repositoryOnly && !resource.repository) return false
    if (params.availableOnly && resource.copiesAvailable != null && resource.copiesAvailable <= 0) return false
    return true
  })

  const sorted = [...filtered].sort((a, b) => {
    switch (params.sort) {
      case 'year':
        return b.resource.year - a.resource.year
      case 'popular':
        return b.resource.accessCount - a.resource.accessCount
      case 'title':
        return a.resource.title.localeCompare(b.resource.title)
      default:
        return b.score - a.score || b.resource.accessCount - a.resource.accessCount
    }
  })

  // Facets are counted over the whole filtered set, not the current page, so
  // the filter sheet shows totals rather than what happens to be on screen.
  const typeCounts = new Map<string, number>()
  const subjectCounts = new Map<string, number>()
  for (const { resource } of filtered) {
    typeCounts.set(resource.type, (typeCounts.get(resource.type) ?? 0) + 1)
    for (const subject of resource.subjects) {
      subjectCounts.set(subject, (subjectCounts.get(subject) ?? 0) + 1)
    }
  }

  const start = (params.page - 1) * params.pageSize
  return {
    items: sorted.slice(start, start + params.pageSize).map((entry) => entry.resource),
    total: sorted.length,
    page: params.page,
    pageSize: params.pageSize,
    facets: {
      types: [...typeCounts.entries()]
        .map(([value, count]) => ({ value: value as Resource['type'], count }))
        .sort((a, b) => b.count - a.count),
      subjects: [...subjectCounts.entries()]
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8),
    },
  }
}
