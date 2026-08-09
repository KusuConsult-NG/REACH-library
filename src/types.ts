/** Shared domain types for REACH. */

export type ResourceType = 'book' | 'ebook' | 'journal' | 'thesis' | 'article' | 'av'

export type UserRole = 'undergraduate' | 'postgraduate' | 'faculty' | 'staff' | 'visiting'

export interface User {
  id: string
  /** University matriculation / staff number used for SSO. */
  username: string
  name: string
  email: string
  role: UserRole
  department: string
  faculty: string
  avatarInitials: string
  /** Koha borrower number, used for circulation calls. */
  borrowerNumber: string
  joinedAt: string
}

export interface PrivacySettings {
  /** Others may find and follow this profile. */
  profileVisible: boolean
  /** Reading activity contributes to trending / feed (always de-identified). */
  shareActivity: boolean
}

export interface NotificationPrefs {
  dueDateReminders: boolean
  newResourceAlerts: boolean
  xpMilestones: boolean
  libraryAnnouncements: boolean
  returnConfirmations: boolean
  /** Subject areas that drive "new resource" alerts. */
  interests: string[]
}

export interface Resource {
  id: string
  /** Koha biblionumber where the record originates in the ILMS. */
  biblionumber?: string
  title: string
  authors: string[]
  type: ResourceType
  subjects: string[]
  year: number
  publisher?: string
  isbn?: string
  language: string
  /** Shelf location for physical items. */
  callNumber?: string
  location?: string
  /** Physical copy counts; absent for born-digital items. */
  copiesTotal?: number
  copiesAvailable?: number
  /** Deep link for electronic resources, proxied for off-campus access. */
  url?: string
  /** True when the item lives in the institutional repository. */
  repository?: boolean
  abstract?: string
  coverColor: string
  /** Rolling popularity signal used for trending lists. */
  accessCount: number
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
  /** Position in the reservation queue reported by Koha. */
  queuePosition: number
  status: 'pending' | 'ready' | 'cancelled'
  expiresAt?: string
}

/** Every XP-bearing interaction the app records. */
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
  /** Recorded while offline and not yet accepted by the server. */
  pending?: boolean
}

export interface LevelInfo {
  level: number
  title: string
  currentXp: number
  xpIntoLevel: number
  xpForLevel: number
  xpToNext: number
  progress: number
  isMax: boolean
}

export type NotificationKind =
  | 'due_soon'
  | 'overdue'
  | 'hold_ready'
  | 'new_resource'
  | 'xp_milestone'
  | 'announcement'
  | 'return_confirmed'

export interface AppNotification {
  id: string
  kind: NotificationKind
  title: string
  body: string
  at: string
  read: boolean
  /** In-app route opened when the notification is tapped. */
  link?: string
}

export interface FollowedUser {
  id: string
  name: string
  department: string
  role: UserRole
  level: number
  avatarInitials: string
}

export interface TrendingEntry {
  resourceId: string
  title: string
  department: string
  accessCount: number
  /** Change in rank versus the previous period. */
  delta: number
}

export interface FeedItem {
  id: string
  /** De-identified by design — cohort only, never a name. */
  cohort: string
  action: string
  resourceTitle: string
  resourceId: string
  at: string
}

export interface StudySpace {
  id: string
  name: string
  floor: string
  capacity: number
  amenities: string[]
  /** ISO hour slots that are already taken today. */
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

export interface LibraryHours {
  day: string
  opens: string
  closes: string
}

export interface FaqEntry {
  question: string
  answer: string
}
