import type {
  ConsultationRequest,
  Hold,
  Loan,
  Resource,
  SpaceBooking,
  StudySpace,
  TrendingEntry,
} from '@/types'
import {
  ApiError,
  type IncomingTransfer,
  type LibraryApi,
  type SearchParams,
  type SearchResult,
  type Session,
  type TransferResult,
  type TransferTarget,
} from './types'
import { readJson, writeJson } from '@/services/storage'

/**
 * Live backend adapter.
 *
 * The PWA never talks to Koha directly: Koha's REST API requires credentials
 * that must not reach a browser, and its CORS posture assumes server-to-server
 * use. Instead this adapter calls the REACH Node/Express proxy, which holds the
 * Koha API key, performs the OAuth 2.0 exchange with the university IdP, and
 * normalises MARC-flavoured payloads into the shapes in `src/types.ts`.
 *
 * Proxy routes consumed here (see `docs/BACKEND.md` for the contract):
 *   POST /api/auth/login          -> { user, token, expiresAt }
 *   POST /api/auth/logout
 *   GET  /api/catalogue/search    -> SearchResult      (Koha GET /biblios)
 *   GET  /api/catalogue/:id       -> Resource          (Koha GET /biblios/{biblio_id})
 *   GET  /api/catalogue/trending  -> TrendingEntry[]   (REACH analytics store)
 *   GET  /api/circulation/loans   -> Loan[]            (Koha GET /patrons/{id}/checkouts)
 *   POST /api/circulation/checkout, /renew, /return, /holds
 *   GET/POST /api/spaces, /api/consultations           (space-booking system)
 */
export class KohaLibraryApi implements LibraryApi {
  constructor(private readonly baseUrl: string) {}

  private token(): string | null {
    return readJson<Session | null>('session', null)?.token ?? null
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = this.token()
    let response: Response
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...init.headers,
        },
      })
    } catch {
      throw new ApiError('You appear to be offline. This action will be retried when you reconnect.', 'offline')
    }

    if (response.status === 401) {
      throw new ApiError('Your session has expired. Please sign in again.', 'invalid_credentials')
    }
    if (response.status === 404) {
      throw new ApiError('That record could not be found.', 'not_found')
    }
    if (!response.ok) {
      const detail = await response.json().catch(() => null)
      throw new ApiError(
        (detail as { message?: string } | null)?.message ?? 'The library service is temporarily unavailable.',
        response.status === 409 ? 'unavailable' : 'server_error',
      )
    }
    if (response.status === 204) return undefined as T
    return (await response.json()) as T
  }

  async login(username: string, password: string): Promise<Session> {
    const session = await this.request<Session>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    })
    writeJson('session', session)
    return session
  }

  async logout(): Promise<void> {
    await this.request<void>('/auth/logout', { method: 'POST' }).catch(() => undefined)
    writeJson('session', null)
  }

  async search(params: SearchParams): Promise<SearchResult> {
    const query = new URLSearchParams()
    if (params.query) query.set('q', params.query)
    if (params.types?.length) query.set('type', params.types.join(','))
    if (params.subjects?.length) query.set('subject', params.subjects.join(','))
    if (params.availableOnly) query.set('available', '1')
    if (params.repositoryOnly) query.set('repository', '1')
    if (params.sort) query.set('sort', params.sort)
    query.set('page', String(params.page ?? 1))
    query.set('pageSize', String(params.pageSize ?? 10))
    return this.request<SearchResult>(`/catalogue/search?${query.toString()}`)
  }

  getResource(id: string): Promise<Resource | undefined> {
    return this.request<Resource>(`/catalogue/${encodeURIComponent(id)}`)
  }

  getResources(ids: string[]): Promise<Resource[]> {
    if (!ids.length) return Promise.resolve([])
    return this.request<Resource[]>(`/catalogue/batch?ids=${ids.map(encodeURIComponent).join(',')}`)
  }

  getTrending(department?: string): Promise<TrendingEntry[]> {
    const query = department ? `?department=${encodeURIComponent(department)}` : ''
    return this.request<TrendingEntry[]>(`/catalogue/trending${query}`)
  }

  getLoans(): Promise<Loan[]> {
    return this.request<Loan[]>('/circulation/loans')
  }

  getHolds(): Promise<Hold[]> {
    return this.request<Hold[]>('/circulation/holds')
  }

  checkout(resourceId: string): Promise<Loan> {
    return this.request<Loan>('/circulation/checkout', {
      method: 'POST',
      body: JSON.stringify({ resourceId }),
    })
  }

  renew(loanId: string): Promise<Loan> {
    return this.request<Loan>(`/circulation/loans/${encodeURIComponent(loanId)}/renew`, { method: 'POST' })
  }

  returnLoan(loanId: string): Promise<Loan> {
    return this.request<Loan>(`/circulation/loans/${encodeURIComponent(loanId)}/return`, { method: 'POST' })
  }

  placeHold(resourceId: string): Promise<Hold> {
    return this.request<Hold>('/circulation/holds', {
      method: 'POST',
      body: JSON.stringify({ resourceId }),
    })
  }

  async cancelHold(holdId: string): Promise<void> {
    await this.request<void>(`/circulation/holds/${encodeURIComponent(holdId)}`, { method: 'DELETE' })
  }

  getSpaces(): Promise<StudySpace[]> {
    return this.request<StudySpace[]>('/spaces')
  }

  bookSpace(spaceId: string, date: string, slot: string): Promise<SpaceBooking> {
    return this.request<SpaceBooking>('/spaces/bookings', {
      method: 'POST',
      body: JSON.stringify({ spaceId, date, slot }),
    })
  }

  async cancelBooking(bookingId: string): Promise<void> {
    await this.request<void>(`/spaces/bookings/${encodeURIComponent(bookingId)}`, { method: 'DELETE' })
  }

  getBookings(): Promise<SpaceBooking[]> {
    return this.request<SpaceBooking[]>('/spaces/bookings')
  }

  requestConsultation(
    input: Omit<ConsultationRequest, 'id' | 'submittedAt' | 'status'>,
  ): Promise<ConsultationRequest> {
    return this.request<ConsultationRequest>('/consultations', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  }

  async lookupMember(identifier: string): Promise<TransferTarget | undefined> {
    try {
      return await this.request<TransferTarget>(
        `/activity/members/${encodeURIComponent(identifier)}`,
      )
    } catch (error) {
      // "No such member" is an answer, not a failure the caller should handle.
      if (error instanceof ApiError && error.code === 'not_found') return undefined
      throw error
    }
  }

  sendXp(identifier: string, amount: number, note?: string): Promise<TransferResult> {
    return this.request<TransferResult>('/activity/transfers', {
      method: 'POST',
      body: JSON.stringify({ identifier, amount, note }),
    })
  }

  claimIncomingXp(): Promise<IncomingTransfer[]> {
    return this.request<IncomingTransfer[]>('/activity/transfers/claim', { method: 'POST' })
  }
}
