import type {
  ConsultationRequest,
  Hold,
  Loan,
  Resource,
  ResourceType,
  SpaceBooking,
  StudySpace,
  TrendingEntry,
  User,
} from '@/types'

export interface SearchParams {
  query?: string
  types?: ResourceType[]
  subjects?: string[]
  availableOnly?: boolean
  repositoryOnly?: boolean
  sort?: 'relevance' | 'year' | 'popular' | 'title'
  page?: number
  pageSize?: number
}

export interface SearchResult {
  items: Resource[]
  total: number
  page: number
  pageSize: number
  facets: {
    types: { value: ResourceType; count: number }[]
    subjects: { value: string; count: number }[]
  }
}

export interface Session {
  user: User
  /** Bearer token minted by the university IdP, held only in memory + storage. */
  token: string
  expiresAt: string
}

/**
 * The contract every backend must satisfy.
 *
 * `MockLibraryApi` implements it against seeded local data so the PWA is fully
 * usable without a server; `KohaLibraryApi` implements it against the Node/Express
 * proxy that fronts Koha's REST API and the university IdP. Screens and slices
 * only ever depend on this interface, so swapping the two changes no UI code.
 */
export interface LibraryApi {
  login(username: string, password: string): Promise<Session>
  logout(): Promise<void>

  search(params: SearchParams): Promise<SearchResult>
  getResource(id: string): Promise<Resource | undefined>
  getResources(ids: string[]): Promise<Resource[]>
  getTrending(department?: string): Promise<TrendingEntry[]>

  getLoans(): Promise<Loan[]>
  getHolds(): Promise<Hold[]>
  checkout(resourceId: string): Promise<Loan>
  renew(loanId: string): Promise<Loan>
  returnLoan(loanId: string): Promise<Loan>
  placeHold(resourceId: string): Promise<Hold>
  cancelHold(holdId: string): Promise<void>

  getSpaces(): Promise<StudySpace[]>
  bookSpace(spaceId: string, date: string, slot: string): Promise<SpaceBooking>
  cancelBooking(bookingId: string): Promise<void>
  getBookings(): Promise<SpaceBooking[]>

  requestConsultation(
    input: Omit<ConsultationRequest, 'id' | 'submittedAt' | 'status'>,
  ): Promise<ConsultationRequest>
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'invalid_credentials'
      | 'not_found'
      | 'unavailable'
      | 'limit_reached'
      | 'offline'
      | 'server_error',
  ) {
    super(message)
    this.name = 'ApiError'
  }
}
