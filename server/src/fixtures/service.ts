import { randomUUID } from 'node:crypto'
import { HttpError } from '../errors.js'
import { LOAN_RULES, addDays, searchRecords, type LibraryService, type SearchParams } from '../service.js'
import type { Store } from '../store.js'
import type { Hold, Loan, Resource, SearchResult, User } from '../types.js'
import { FIXTURE_RESOURCES } from './catalogue.js'

/**
 * In-memory circulation over the fixture catalogue, for running the proxy
 * before Koha credentials exist. It enforces the same policy Koha would —
 * loan limits, renewal caps, availability — so the client's error paths are
 * exercisable end to end.
 *
 * Loans and holds live in memory only: this backend is for development, and
 * restarting it should give a clean slate.
 */
export class FixtureLibraryService implements LibraryService {
  private loans = new Map<string, Loan[]>()
  private holds = new Map<string, Hold[]>()
  /** Availability deltas applied over the fixture's baseline counts. */
  private availability = new Map<string, number>()

  constructor(private readonly store: Store) {}

  private resource(id: string): Resource | undefined {
    const base = FIXTURE_RESOURCES.find((record) => record.id === id)
    if (!base) return undefined
    return this.decorate(base)
  }

  private decorate(base: Resource): Resource {
    const accessCount = base.accessCount + (this.store.data.accessCounts[base.id] ?? 0)
    if (base.copiesAvailable == null) return { ...base, accessCount }
    const delta = this.availability.get(base.id) ?? 0
    return {
      ...base,
      copiesAvailable: Math.max(0, Math.min(base.copiesTotal ?? 0, base.copiesAvailable + delta)),
      accessCount,
    }
  }

  private loansFor(user: User): Loan[] {
    return this.loans.get(user.borrowerNumber) ?? []
  }

  private holdsFor(user: User): Hold[] {
    return this.holds.get(user.borrowerNumber) ?? []
  }

  async search(params: SearchParams): Promise<SearchResult> {
    return searchRecords(FIXTURE_RESOURCES.map((record) => this.decorate(record)), params)
  }

  async getResource(id: string): Promise<Resource | undefined> {
    return this.resource(id)
  }

  async getResources(ids: string[]): Promise<Resource[]> {
    return ids.map((id) => this.resource(id)).filter((record): record is Resource => Boolean(record))
  }

  async listLoans(user: User): Promise<Loan[]> {
    const now = Date.now()
    const loans = this.loansFor(user).map((loan) =>
      loan.status === 'active' && new Date(loan.dueAt).getTime() < now
        ? { ...loan, status: 'overdue' as const }
        : loan,
    )
    this.loans.set(user.borrowerNumber, loans)
    return loans
  }

  async listHolds(user: User): Promise<Hold[]> {
    return this.holdsFor(user)
  }

  async checkout(user: User, resourceId: string): Promise<Loan> {
    const resource = this.resource(resourceId)
    if (!resource) throw HttpError.notFound()
    if (resource.copiesAvailable == null) {
      throw HttpError.conflict('This is an electronic resource — open it instead of borrowing.')
    }
    if (resource.copiesAvailable <= 0) {
      throw HttpError.conflict('All copies are out on loan. Place a hold to join the queue.')
    }

    const rules = LOAN_RULES[user.role]
    const loans = this.loansFor(user)
    if (loans.filter((loan) => loan.status !== 'returned').length >= rules.limit) {
      throw HttpError.conflict(
        `You already have ${rules.limit} items on loan, the maximum for your borrower category.`,
      )
    }
    if (loans.some((loan) => loan.resourceId === resourceId && loan.status !== 'returned')) {
      throw HttpError.conflict('You already have this item on loan.')
    }

    const now = new Date()
    const loan: Loan = {
      id: randomUUID(),
      resourceId,
      checkedOutAt: now.toISOString(),
      dueAt: addDays(now, rules.days).toISOString(),
      renewals: 0,
      maxRenewals: rules.renewals,
      status: 'active',
    }
    this.loans.set(user.borrowerNumber, [loan, ...loans])
    this.availability.set(resourceId, (this.availability.get(resourceId) ?? 0) - 1)
    return loan
  }

  async renew(user: User, loanId: string): Promise<Loan> {
    const loans = this.loansFor(user)
    const loan = loans.find((entry) => entry.id === loanId)
    if (!loan) throw HttpError.notFound('That loan is no longer on your record.')
    if (loan.status === 'returned') {
      throw HttpError.conflict('This item has already been returned.')
    }
    if (loan.renewals >= loan.maxRenewals) {
      throw HttpError.conflict('This item has reached its renewal limit — please return it to the desk.')
    }

    const renewed: Loan = {
      ...loan,
      renewals: loan.renewals + 1,
      dueAt: addDays(new Date(), LOAN_RULES[user.role].days).toISOString(),
      status: 'active',
    }
    this.loans.set(user.borrowerNumber, loans.map((entry) => (entry.id === loanId ? renewed : entry)))
    return renewed
  }

  async returnLoan(user: User, loanId: string): Promise<Loan> {
    const loans = this.loansFor(user)
    const loan = loans.find((entry) => entry.id === loanId)
    if (!loan) throw HttpError.notFound('That loan is no longer on your record.')
    if (loan.status === 'returned') return loan

    const returned: Loan = { ...loan, status: 'returned', returnedAt: new Date().toISOString() }
    this.loans.set(user.borrowerNumber, loans.map((entry) => (entry.id === loanId ? returned : entry)))
    this.availability.set(loan.resourceId, (this.availability.get(loan.resourceId) ?? 0) + 1)
    this.promoteNextHold(loan.resourceId)
    return returned
  }

  /** A returned copy satisfies the front of the queue, as Koha would. */
  private promoteNextHold(resourceId: string) {
    for (const [borrower, holds] of this.holds) {
      const next = holds.find((hold) => hold.resourceId === resourceId && hold.status === 'pending')
      if (!next) continue
      this.holds.set(
        borrower,
        holds.map((hold) =>
          hold.id === next.id
            ? {
                ...hold,
                status: 'ready' as const,
                queuePosition: 0,
                expiresAt: addDays(new Date(), 7).toISOString(),
              }
            : hold,
        ),
      )
      return
    }
  }

  async placeHold(user: User, resourceId: string): Promise<Hold> {
    if (!this.resource(resourceId)) throw HttpError.notFound()
    const holds = this.holdsFor(user)
    if (holds.some((hold) => hold.resourceId === resourceId && hold.status !== 'cancelled')) {
      throw HttpError.conflict('You already have a hold on this item.')
    }

    const queueAhead = [...this.holds.values()]
      .flat()
      .filter((hold) => hold.resourceId === resourceId && hold.status === 'pending').length

    const hold: Hold = {
      id: randomUUID(),
      resourceId,
      placedAt: new Date().toISOString(),
      queuePosition: queueAhead + 1,
      status: 'pending',
      expiresAt: addDays(new Date(), 21).toISOString(),
    }
    this.holds.set(user.borrowerNumber, [hold, ...holds])
    return hold
  }

  async cancelHold(user: User, holdId: string): Promise<void> {
    const holds = this.holdsFor(user)
    if (!holds.some((hold) => hold.id === holdId)) throw HttpError.notFound()
    this.holds.set(user.borrowerNumber, holds.filter((hold) => hold.id !== holdId))
  }
}
