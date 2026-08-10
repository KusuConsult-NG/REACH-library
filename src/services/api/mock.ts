import { readJson, writeJson } from '@/services/storage'
import type {
  ConsultationRequest,
  Hold,
  Loan,
  Resource,
  SpaceBooking,
  StudySpace,
  TrendingEntry,
  User,
  UserRole,
} from '@/types'
import { ApiError, type LibraryApi, type SearchParams, type SearchResult, type Session } from './types'
import { RESOURCES, STUDY_SPACES } from './seed'

/** Loan allowances by borrower category, mirroring the circulation policy. */
const LOAN_RULES: Record<UserRole, { limit: number; days: number; renewals: number }> = {
  undergraduate: { limit: 4, days: 14, renewals: 2 },
  postgraduate: { limit: 8, days: 21, renewals: 3 },
  faculty: { limit: 12, days: 30, renewals: 4 },
  staff: { limit: 6, days: 21, renewals: 3 },
  visiting: { limit: 2, days: 7, renewals: 1 },
}

interface MockState {
  loans: Loan[]
  holds: Hold[]
  bookings: SpaceBooking[]
  consultations: ConsultationRequest[]
  /** Per-resource availability deltas applied on top of the seed data. */
  availability: Record<string, number>
  accessCounts: Record<string, number>
}

/**
 * Built fresh on every call. A shared constant would hand every instance the
 * same nested `availability` / `accessCounts` objects, and in-place writes to
 * them would leak across sessions (and across tests).
 */
function emptyState(): MockState {
  return {
    loans: [],
    holds: [],
    bookings: [],
    consultations: [],
    availability: {},
    accessCounts: {},
  }
}

const STATE_KEY = 'mock-backend'
const SESSION_KEY = 'mock-session'

function loadState(): MockState {
  return { ...emptyState(), ...readJson<Partial<MockState>>(STATE_KEY, {}) }
}

function saveState(state: MockState) {
  writeJson(STATE_KEY, state)
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Simulated round-trip; kept small so the UI still feels native-quick. */
const latency = () => wait(120 + Math.random() * 180)

function id(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

/** Derive a plausible profile from the credential the user signed in with. */
function profileFor(username: string): User {
  const normalised = username.trim().toLowerCase()
  const role: UserRole = normalised.startsWith('pg')
    ? 'postgraduate'
    : normalised.startsWith('dr') || normalised.startsWith('prof') || normalised.startsWith('staff')
      ? 'faculty'
      : 'undergraduate'

  const departments = [
    { department: 'Public Health', faculty: 'Medical Sciences' },
    { department: 'Civil Engineering', faculty: 'Engineering' },
    { department: 'Private & Property Law', faculty: 'Law' },
    { department: 'Curriculum Studies', faculty: 'Education' },
    { department: 'Geography & Planning', faculty: 'Environmental Sciences' },
    { department: 'Accounting', faculty: 'Management Sciences' },
  ]

  /**
   * Matriculation numbers carry a faculty code — UJ/2021/CVE/0142 is a civil
   * engineer. Honouring it keeps a demo account coherent with the number typed
   * to create it; anything unrecognised still falls back to the hash.
   */
  const DEPARTMENT_CODES: Record<string, { department: string; faculty: string }> = {
    cve: { department: 'Civil Engineering', faculty: 'Engineering' },
    eng: { department: 'Electrical Engineering', faculty: 'Engineering' },
    csc: { department: 'Computer Science', faculty: 'Natural Sciences' },
    med: { department: 'Community Medicine', faculty: 'Medical Sciences' },
    mbbs: { department: 'Community Medicine', faculty: 'Medical Sciences' },
    nur: { department: 'Nursing Science', faculty: 'Medical Sciences' },
    pha: { department: 'Pharmacology', faculty: 'Pharmaceutical Sciences' },
    law: { department: 'Private & Property Law', faculty: 'Law' },
    edu: { department: 'Curriculum Studies', faculty: 'Education' },
    agr: { department: 'Agronomy', faculty: 'Agriculture' },
    geo: { department: 'Geography & Planning', faculty: 'Environmental Sciences' },
    acc: { department: 'Accounting', faculty: 'Management Sciences' },
    mgt: { department: 'Business Management', faculty: 'Management Sciences' },
    sci: { department: 'Chemistry', faculty: 'Natural Sciences' },
    art: { department: 'English & Literary Studies', faculty: 'Arts' },
    lib: { department: 'Library & Information Science', faculty: 'Education' },
  }

  let hash = 0
  for (const ch of normalised) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0

  const codeMatch = normalised
    .split(/[^a-z]+/)
    .find((part) => part.length >= 3 && part in DEPARTMENT_CODES)
  const home = codeMatch ? DEPARTMENT_CODES[codeMatch] : departments[hash % departments.length]

  // A matriculation number carries no name, so the demo backend assigns a
  // stable one from the credential's hash. A real deployment takes the name
  // from the IdP's profile claim instead.
  const DEMO_NAMES = [
    'Amina Bello',
    'Terhemba Iorlaha',
    'Chidera Okafor',
    'Gyang Pam',
    'Fatima Sani',
    'Nanle Dashe',
    'Oluwaseun Adebayo',
    'Rahila Musa',
  ]
  // Honorifics and faculty codes are not names: "STAFF/LIB/0031" should not
  // produce a member called "Staff Lib".
  const NOT_A_NAME = new Set(['dr', 'prof', 'mr', 'mrs', 'ms', 'staff', 'pg', 'ug', ...Object.keys(DEPARTMENT_CODES)])
  const words = normalised
    .replace(/[^a-z]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((part) => part.length >= 3 && !NOT_A_NAME.has(part))
  // Two or more usable words look like a real name; a lone department code
  // ("CVE" out of UJ/2021/CVE/0142) does not.
  const name =
    words.length >= 2
      ? words.map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')
      : DEMO_NAMES[hash % DEMO_NAMES.length]

  return {
    id: `u-${hash.toString(16)}`,
    username: username.trim(),
    name,
    email: `${normalised.replace(/\s+/g, '')}@unijos.edu.ng`,
    role,
    department: home.department,
    faculty: home.faculty,
    avatarInitials:
      name
        .split(' ')
        .map((p) => p[0])
        .slice(0, 2)
        .join('')
        .toUpperCase() || 'RL',
    borrowerNumber: String(20000 + (hash % 9000)),
    joinedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 240).toISOString(),
  }
}

function resourceById(id: string): Resource | undefined {
  return RESOURCES.find((r) => r.id === id)
}

function withAvailability(state: MockState, resource: Resource): Resource {
  const delta = state.availability[resource.id] ?? 0
  if (resource.copiesAvailable == null) {
    return { ...resource, accessCount: resource.accessCount + (state.accessCounts[resource.id] ?? 0) }
  }
  return {
    ...resource,
    copiesAvailable: Math.max(0, Math.min(resource.copiesTotal ?? 0, resource.copiesAvailable + delta)),
    accessCount: resource.accessCount + (state.accessCounts[resource.id] ?? 0),
  }
}

export class MockLibraryApi implements LibraryApi {
  private state: MockState = loadState()

  private session(): Session {
    const session = readJson<Session | null>(SESSION_KEY, null)
    if (!session) throw new ApiError('Your session has expired. Please sign in again.', 'invalid_credentials')
    return session
  }

  private commit() {
    saveState(this.state)
  }

  /**
   * Drop in-memory state and re-read from storage. The app holds one instance
   * for the life of the page, so this is what makes "clear data on this device"
   * and per-test isolation take effect without a reload.
   */
  reload() {
    this.state = loadState()
  }

  async login(username: string, password: string): Promise<Session> {
    await latency()
    if (!username.trim() || !password.trim()) {
      throw new ApiError('Enter your university username and password.', 'invalid_credentials')
    }
    if (password.trim().length < 4) {
      throw new ApiError('That username and password combination was not recognised.', 'invalid_credentials')
    }
    const session: Session = {
      user: profileFor(username),
      token: `demo.${btoa(username.trim()).replace(/=+$/, '')}.${Date.now().toString(36)}`,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 12).toISOString(),
    }
    writeJson(SESSION_KEY, session)
    return session
  }

  async logout(): Promise<void> {
    writeJson(SESSION_KEY, null)
  }

  async search(params: SearchParams): Promise<SearchResult> {
    await latency()
    const {
      query = '',
      types = [],
      subjects = [],
      availableOnly = false,
      repositoryOnly = false,
      sort = 'relevance',
      page = 1,
      pageSize = 10,
    } = params

    const terms = query.toLowerCase().split(/\s+/).filter(Boolean)

    const scored = RESOURCES.map((raw) => {
      const resource = withAvailability(this.state, raw)
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
    }).filter((entry) => entry.score >= 0)

    const filtered = scored.filter(({ resource }) => {
      if (types.length && !types.includes(resource.type)) return false
      if (subjects.length && !resource.subjects.some((s) => subjects.includes(s))) return false
      if (repositoryOnly && !resource.repository) return false
      if (availableOnly) {
        const digital = resource.copiesAvailable == null
        if (!digital && (resource.copiesAvailable ?? 0) <= 0) return false
      }
      return true
    })

    const sorted = [...filtered].sort((a, b) => {
      switch (sort) {
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

    const typeCounts = new Map<Resource['type'], number>()
    const subjectCounts = new Map<string, number>()
    for (const { resource } of filtered) {
      typeCounts.set(resource.type, (typeCounts.get(resource.type) ?? 0) + 1)
      for (const subject of resource.subjects) {
        subjectCounts.set(subject, (subjectCounts.get(subject) ?? 0) + 1)
      }
    }

    const start = (page - 1) * pageSize
    return {
      items: sorted.slice(start, start + pageSize).map((entry) => entry.resource),
      total: sorted.length,
      page,
      pageSize,
      facets: {
        types: [...typeCounts.entries()]
          .map(([value, count]) => ({ value, count }))
          .sort((a, b) => b.count - a.count),
        subjects: [...subjectCounts.entries()]
          .map(([value, count]) => ({ value, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 8),
      },
    }
  }

  async getResource(resourceId: string): Promise<Resource | undefined> {
    await latency()
    const raw = resourceById(resourceId)
    if (!raw) return undefined
    this.state.accessCounts[resourceId] = (this.state.accessCounts[resourceId] ?? 0) + 1
    this.commit()
    return withAvailability(this.state, raw)
  }

  async getResources(ids: string[]): Promise<Resource[]> {
    await wait(40)
    return ids
      .map((rid) => resourceById(rid))
      .filter((r): r is Resource => Boolean(r))
      .map((r) => withAvailability(this.state, r))
  }

  async getTrending(department?: string): Promise<TrendingEntry[]> {
    await wait(60)
    const pool = RESOURCES.map((r) => withAvailability(this.state, r))
      .filter((r) => (department ? r.subjects.some((s) => s.includes(department.split(' ')[0])) : true))
    const source = pool.length >= 5 ? pool : RESOURCES.map((r) => withAvailability(this.state, r))
    return [...source]
      .sort((a, b) => b.accessCount - a.accessCount)
      .slice(0, 6)
      .map((r, index) => ({
        resourceId: r.id,
        title: r.title,
        department: r.subjects[0],
        accessCount: r.accessCount,
        delta: [2, -1, 3, 0, 1, -2][index] ?? 0,
      }))
  }

  async getLoans(): Promise<Loan[]> {
    await wait(60)
    const now = Date.now()
    let mutated = false
    this.state.loans = this.state.loans.map((loan) => {
      if (loan.status === 'active' && new Date(loan.dueAt).getTime() < now) {
        mutated = true
        return { ...loan, status: 'overdue' as const }
      }
      return loan
    })
    if (mutated) this.commit()
    return this.state.loans
  }

  async getHolds(): Promise<Hold[]> {
    await wait(60)
    return this.state.holds
  }

  async checkout(resourceId: string): Promise<Loan> {
    await latency()
    const { user } = this.session()
    const resource = resourceById(resourceId)
    if (!resource) throw new ApiError('That record could not be found in the catalogue.', 'not_found')

    const current = withAvailability(this.state, resource)
    if (current.copiesAvailable == null) {
      throw new ApiError('This is an electronic resource — open it instead of borrowing.', 'unavailable')
    }
    if (current.copiesAvailable <= 0) {
      throw new ApiError('All copies are out on loan. Place a hold to join the queue.', 'unavailable')
    }

    const rules = LOAN_RULES[user.role]
    const activeCount = this.state.loans.filter((l) => l.status !== 'returned').length
    if (activeCount >= rules.limit) {
      throw new ApiError(
        `You already have ${rules.limit} items on loan, the maximum for your borrower category.`,
        'limit_reached',
      )
    }
    if (this.state.loans.some((l) => l.resourceId === resourceId && l.status !== 'returned')) {
      throw new ApiError('You already have this item on loan.', 'limit_reached')
    }

    const now = new Date()
    const loan: Loan = {
      id: id('loan'),
      resourceId,
      checkedOutAt: now.toISOString(),
      dueAt: addDays(now, rules.days).toISOString(),
      renewals: 0,
      maxRenewals: rules.renewals,
      status: 'active',
    }
    this.state.loans = [loan, ...this.state.loans]
    this.state.availability[resourceId] = (this.state.availability[resourceId] ?? 0) - 1
    this.state.holds = this.state.holds.filter((h) => h.resourceId !== resourceId)
    this.commit()
    return loan
  }

  async renew(loanId: string): Promise<Loan> {
    await latency()
    const loan = this.state.loans.find((l) => l.id === loanId)
    if (!loan) throw new ApiError('That loan is no longer on your record.', 'not_found')
    if (loan.status === 'returned') throw new ApiError('This item has already been returned.', 'unavailable')
    if (loan.renewals >= loan.maxRenewals) {
      throw new ApiError('This item has reached its renewal limit — please return it to the desk.', 'limit_reached')
    }
    const rules = LOAN_RULES[this.session().user.role]
    const renewed: Loan = {
      ...loan,
      renewals: loan.renewals + 1,
      dueAt: addDays(new Date(), rules.days).toISOString(),
      status: 'active',
    }
    this.state.loans = this.state.loans.map((l) => (l.id === loanId ? renewed : l))
    this.commit()
    return renewed
  }

  async returnLoan(loanId: string): Promise<Loan> {
    await latency()
    const loan = this.state.loans.find((l) => l.id === loanId)
    if (!loan) throw new ApiError('That loan is no longer on your record.', 'not_found')
    const returned: Loan = { ...loan, status: 'returned', returnedAt: new Date().toISOString() }
    this.state.loans = this.state.loans.map((l) => (l.id === loanId ? returned : l))
    this.state.availability[loan.resourceId] = (this.state.availability[loan.resourceId] ?? 0) + 1
    this.promoteNextHold(loan.resourceId)
    this.commit()
    return returned
  }

  /**
   * A returned copy satisfies the front of the reservation queue.
   *
   * Koha does this itself; the demo backend mirrors it so the hold-ready
   * notification is reachable without a live ILMS behind the app.
   */
  private promoteNextHold(resourceId: string) {
    const queue = this.state.holds
      .filter((h) => h.resourceId === resourceId && h.status === 'pending')
      .sort((a, b) => a.queuePosition - b.queuePosition || a.placedAt.localeCompare(b.placedAt))

    const next = queue[0]
    if (!next) return

    this.state.holds = this.state.holds.map((hold) =>
      hold.id === next.id
        ? {
            ...hold,
            status: 'ready' as const,
            queuePosition: 0,
            // Collection window: uncollected items go back on the shelf.
            expiresAt: addDays(new Date(), 7).toISOString(),
          }
        : hold.resourceId === resourceId && hold.status === 'pending'
          ? { ...hold, queuePosition: Math.max(1, hold.queuePosition - 1) }
          : hold,
    )
  }

  async placeHold(resourceId: string): Promise<Hold> {
    await latency()
    this.session()
    const resource = resourceById(resourceId)
    if (!resource) throw new ApiError('That record could not be found in the catalogue.', 'not_found')
    if (this.state.holds.some((h) => h.resourceId === resourceId && h.status !== 'cancelled')) {
      throw new ApiError('You already have a hold on this item.', 'limit_reached')
    }
    const hold: Hold = {
      id: id('hold'),
      resourceId,
      placedAt: new Date().toISOString(),
      queuePosition: 1 + Math.floor(Math.random() * 3),
      status: 'pending',
      expiresAt: addDays(new Date(), 21).toISOString(),
    }
    this.state.holds = [hold, ...this.state.holds]
    this.commit()
    return hold
  }

  async cancelHold(holdId: string): Promise<void> {
    await latency()
    this.state.holds = this.state.holds.filter((h) => h.id !== holdId)
    this.commit()
  }

  async getSpaces(): Promise<StudySpace[]> {
    await wait(60)
    const today = new Date().toISOString().slice(0, 10)
    return STUDY_SPACES.map((space) => ({
      ...space,
      bookedSlots: [
        ...space.bookedSlots,
        ...this.state.bookings.filter((b) => b.spaceId === space.id && b.date === today).map((b) => b.slot),
      ],
    }))
  }

  async bookSpace(spaceId: string, date: string, slot: string): Promise<SpaceBooking> {
    await latency()
    this.session()
    const space = STUDY_SPACES.find((s) => s.id === spaceId)
    if (!space) throw new ApiError('That space is not bookable.', 'not_found')
    const clash = this.state.bookings.some(
      (b) => b.spaceId === spaceId && b.date === date && b.slot === slot,
    )
    const today = new Date().toISOString().slice(0, 10)
    if (clash || (date === today && space.bookedSlots.includes(slot))) {
      throw new ApiError('That slot has just been taken. Choose another time.', 'unavailable')
    }
    const booking: SpaceBooking = {
      id: id('bk'),
      spaceId,
      spaceName: space.name,
      date,
      slot,
      createdAt: new Date().toISOString(),
    }
    this.state.bookings = [booking, ...this.state.bookings]
    this.commit()
    return booking
  }

  async cancelBooking(bookingId: string): Promise<void> {
    await latency()
    this.state.bookings = this.state.bookings.filter((b) => b.id !== bookingId)
    this.commit()
  }

  async getBookings(): Promise<SpaceBooking[]> {
    await wait(40)
    return this.state.bookings
  }

  async requestConsultation(
    input: Omit<ConsultationRequest, 'id' | 'submittedAt' | 'status'>,
  ): Promise<ConsultationRequest> {
    await latency()
    this.session()
    const request: ConsultationRequest = {
      ...input,
      id: id('con'),
      submittedAt: new Date().toISOString(),
      status: 'submitted',
    }
    this.state.consultations = [request, ...this.state.consultations]
    this.commit()
    return request
  }
}
