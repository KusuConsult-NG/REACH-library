import { HttpError } from '../errors.js'
import { LOAN_RULES, searchRecords, type LibraryService, type SearchParams } from '../service.js'
import type { Store } from '../store.js'
import type { Hold, Loan, Resource, SearchResult, User } from '../types.js'
import type { KohaClient } from './client.js'
import {
  biblioIdFrom,
  toHold,
  toLoan,
  toResource,
  type KohaBiblio,
  type KohaCheckout,
  type KohaHold,
} from './mapper.js'

/**
 * Koha-backed implementation.
 *
 * Koha owns circulation, so this class does as little as possible: translate
 * ids and shapes, let Koha decide what is allowed, and surface its refusals
 * with the status codes the client understands.
 */
export class KohaLibraryService implements LibraryService {
  constructor(
    private readonly koha: KohaClient,
    private readonly store: Store,
  ) {}

  private accessCount(resourceId: string): number {
    return this.store.data.accessCounts[resourceId] ?? 0
  }

  async search(params: SearchParams): Promise<SearchResult> {
    // Koha's /biblios supports q= and paging; the richer facets and sorts the
    // app offers are applied here over the returned page set.
    const query = new URLSearchParams({
      _page: String(params.page),
      _per_page: String(params.pageSize),
    })
    if (params.query) query.set('q', params.query)

    const biblios = await this.koha.request<KohaBiblio[]>(`/biblios?${query.toString()}`)
    const records = biblios.map((biblio) => toResource(biblio, this.accessCount(`koha-${biblio.biblio_id}`)))

    // Re-run the pipeline locally so filters and facets behave identically to
    // the fixture backend, then restore Koha's paging.
    const result = searchRecords(records, { ...params, page: 1, pageSize: params.pageSize })
    return { ...result, page: params.page }
  }

  async getResource(id: string): Promise<Resource | undefined> {
    const biblio = await this.koha.request<KohaBiblio>(`/biblios/${biblioIdFrom(id)}`)
    return toResource(biblio, this.accessCount(id))
  }

  async getResources(ids: string[]): Promise<Resource[]> {
    const records = await Promise.all(
      ids.map((id) => this.getResource(id).catch(() => undefined)),
    )
    return records.filter((record): record is Resource => Boolean(record))
  }

  async listLoans(user: User): Promise<Loan[]> {
    const checkouts = await this.koha.request<KohaCheckout[]>(
      `/patrons/${user.borrowerNumber}/checkouts`,
    )
    return checkouts.map((checkout) => toLoan(checkout, LOAN_RULES[user.role].renewals))
  }

  async listHolds(user: User): Promise<Hold[]> {
    const holds = await this.koha.request<KohaHold[]>(`/holds?patron_id=${user.borrowerNumber}`)
    return holds.map(toHold)
  }

  async checkout(user: User, resourceId: string): Promise<Loan> {
    const resource = await this.getResource(resourceId)
    if (!resource) throw HttpError.notFound()
    if (resource.copiesAvailable == null) {
      throw HttpError.conflict('This is an electronic resource — open it instead of borrowing.')
    }
    if (resource.copiesAvailable <= 0) {
      throw HttpError.conflict('All copies are out on loan. Place a hold to join the queue.')
    }

    const checkout = await this.koha.request<KohaCheckout>('/checkouts', {
      method: 'POST',
      body: JSON.stringify({
        patron_id: Number(user.borrowerNumber),
        biblio_id: biblioIdFrom(resourceId),
      }),
    })
    return toLoan(checkout, LOAN_RULES[user.role].renewals)
  }

  async renew(user: User, loanId: string): Promise<Loan> {
    const checkout = await this.koha.request<KohaCheckout>(`/checkouts/${loanId}/renewal`, {
      method: 'POST',
    })
    return toLoan(checkout, LOAN_RULES[user.role].renewals)
  }

  async returnLoan(user: User, loanId: string): Promise<Loan> {
    await this.koha.request<void>(`/checkouts/${loanId}`, {
      method: 'PUT',
      body: JSON.stringify({ checkin: true }),
    })
    const loans = await this.listLoans(user)
    const returned = loans.find((loan) => loan.id === loanId)
    if (returned) return returned

    // Koha drops a returned checkout out of the patron's list, so synthesise
    // the confirmation the client expects rather than 404-ing a success.
    return {
      id: loanId,
      resourceId: '',
      checkedOutAt: new Date().toISOString(),
      dueAt: new Date().toISOString(),
      returnedAt: new Date().toISOString(),
      renewals: 0,
      maxRenewals: LOAN_RULES[user.role].renewals,
      status: 'returned',
    }
  }

  async placeHold(user: User, resourceId: string): Promise<Hold> {
    const hold = await this.koha.request<KohaHold>('/holds', {
      method: 'POST',
      body: JSON.stringify({
        patron_id: Number(user.borrowerNumber),
        biblio_id: biblioIdFrom(resourceId),
      }),
    })
    return toHold(hold)
  }

  async cancelHold(_user: User, holdId: string): Promise<void> {
    await this.koha.request<void>(`/holds/${holdId}`, { method: 'DELETE' })
  }
}
