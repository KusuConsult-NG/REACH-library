/**
 * The wire contract between the REACH PWA and this proxy.
 *
 * These mirror `src/types.ts` in the web app deliberately: they are the
 * published API shape (see `docs/BACKEND.md`), so the server owns its own copy
 * rather than importing across project boundaries. Change one, change both —
 * and the contract document.
 */

export type ResourceType = 'book' | 'ebook' | 'journal' | 'thesis' | 'article' | 'av'

export type UserRole = 'undergraduate' | 'postgraduate' | 'faculty' | 'staff' | 'visiting'

export interface User {
  id: string
  username: string
  name: string
  email: string
  role: UserRole
  department: string
  faculty: string
  avatarInitials: string
  borrowerNumber: string
  joinedAt: string
}

export interface Resource {
  id: string
  biblionumber?: string
  title: string
  authors: string[]
  type: ResourceType
  subjects: string[]
  year: number
  publisher?: string
  isbn?: string
  language: string
  callNumber?: string
  location?: string
  copiesTotal?: number
  copiesAvailable?: number
  url?: string
  repository?: boolean
  abstract?: string
  coverColor: string
  accessCount: number
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

export type LoanStatus = 'active' | 'returned' | 'overdue'

export interface Loan {
  id: string
  resourceId: string
  checkedOutAt: string
  dueAt: string
  returnedAt?: string
  renewals: number
  maxRenewals: number
  status: LoanStatus
}

export interface Hold {
  id: string
  resourceId: string
  placedAt: string
  queuePosition: number
  status: 'pending' | 'ready' | 'cancelled'
  expiresAt?: string
}

export interface TrendingEntry {
  resourceId: string
  title: string
  department: string
  accessCount: number
  delta: number
}

export interface StudySpace {
  id: string
  name: string
  floor: string
  capacity: number
  amenities: string[]
  bookedSlots: string[]
}

export interface SpaceBooking {
  id: string
  spaceId: string
  spaceName: string
  date: string
  slot: string
  createdAt: string
}

export interface ConsultationRequest {
  id: string
  topic: string
  details: string
  preferredMode: 'in_person' | 'video' | 'email'
  preferredDate: string
  submittedAt: string
  status: 'submitted' | 'scheduled' | 'closed'
}

export type ActivityKind =
  | 'eresource_access'
  | 'resource_download'
  | 'opac_browse'
  | 'reservation'
  | 'physical_borrow'
  | 'weekly_goal_bonus'
  | 'streak_bonus'

export interface Activity {
  id: string
  kind: ActivityKind
  xp: number
  resourceId?: string
  resourceTitle?: string
  at: string
}

export interface Session {
  user: User
  token: string
  expiresAt: string
}
