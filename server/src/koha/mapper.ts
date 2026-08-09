import type { Hold, Loan, Resource, ResourceType } from '../types.js'

/** The subset of Koha's biblio payload this proxy reads. */
export interface KohaBiblio {
  biblio_id: number
  title?: string
  subtitle?: string
  author?: string
  isbn?: string
  publisher?: string
  copyright_date?: number | string
  publication_year?: number | string
  material_type?: string
  language?: string
  abstract?: string
  subjects?: string[] | string
  items?: KohaItem[]
  /** 856$u in MARC — an online location, if the record has one. */
  url?: string
}

export interface KohaItem {
  item_id: number
  home_library_id?: string
  location?: string
  callnumber?: string
  checked_out_date?: string | null
  lost_status?: number
  withdrawn?: number
  not_for_loan_status?: number
}

export interface KohaCheckout {
  checkout_id: number
  biblio_id: number
  checkout_date: string
  due_date: string
  checkin_date?: string | null
  renewals_count?: number
  /** Koha exposes the remaining allowance on the renewability endpoint. */
  max_renewals?: number
}

export interface KohaHold {
  hold_id: number
  biblio_id: number
  hold_date: string
  priority?: number
  status?: string
  expiration_date?: string | null
  waiting_date?: string | null
}

/** Deterministic spine colour, so a record looks the same on every device. */
const COVER_COLOURS = ['#0E6BA8', '#0A3B5E', '#A9761A', '#8C3A2B', '#2E3A76', '#0F5B63', '#5B2C57']

export function coverColourFor(id: string): string {
  let hash = 0
  for (const character of id) hash = (hash * 31 + character.charCodeAt(0)) >>> 0
  return COVER_COLOURS[hash % COVER_COLOURS.length]
}

/**
 * Koha's `material_type` follows the MARC leader, which is coarser than the
 * facets the app offers. Anything unrecognised falls back to `book`, which is
 * the safe default: it makes the record borrowable rather than hiding it.
 */
export function resourceTypeFrom(materialType: string | undefined, hasItems: boolean): ResourceType {
  switch ((materialType ?? '').toLowerCase()) {
    case 'continuing_resource':
    case 'serial':
      return 'journal'
    case 'computer_file':
    case 'electronic':
      return hasItems ? 'book' : 'ebook'
    case 'mixed_materials':
    case 'visual_material':
    case 'sound_recording':
    case 'audio':
      return 'av'
    case 'manuscript':
    case 'thesis':
      return 'thesis'
    default:
      return hasItems ? 'book' : 'ebook'
  }
}

function toArray(subjects: string[] | string | undefined): string[] {
  if (!subjects) return []
  if (Array.isArray(subjects)) return subjects.filter(Boolean)
  return subjects
    .split(/[;|]/)
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function year(biblio: KohaBiblio): number {
  const raw = biblio.copyright_date ?? biblio.publication_year
  const parsed = Number(String(raw ?? '').replace(/\D/g, '').slice(0, 4))
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

/** An item counts as available when it is on the shelf and loanable. */
export function isAvailable(item: KohaItem): boolean {
  return !item.checked_out_date && !item.lost_status && !item.withdrawn && !item.not_for_loan_status
}

export function toResource(biblio: KohaBiblio, accessCount = 0): Resource {
  const items = biblio.items ?? []
  const hasItems = items.length > 0
  const id = `koha-${biblio.biblio_id}`
  const title = [biblio.title, biblio.subtitle].filter(Boolean).join(': ') || 'Untitled record'

  return {
    id,
    biblionumber: String(biblio.biblio_id),
    title,
    authors: biblio.author ? [biblio.author] : [],
    type: resourceTypeFrom(biblio.material_type, hasItems),
    subjects: toArray(biblio.subjects),
    year: year(biblio),
    publisher: biblio.publisher,
    isbn: biblio.isbn,
    language: biblio.language ?? 'English',
    callNumber: items[0]?.callnumber,
    location: items[0]?.location ?? items[0]?.home_library_id,
    // Digital-only records carry no copy counts, which is how the app decides
    // between "borrow" and "open".
    copiesTotal: hasItems ? items.length : undefined,
    copiesAvailable: hasItems ? items.filter(isAvailable).length : undefined,
    url: biblio.url,
    abstract: biblio.abstract,
    coverColor: coverColourFor(id),
    accessCount,
  }
}

export function toLoan(checkout: KohaCheckout, maxRenewals: number): Loan {
  const returned = Boolean(checkout.checkin_date)
  const overdue = !returned && new Date(checkout.due_date).getTime() < Date.now()

  return {
    id: String(checkout.checkout_id),
    resourceId: `koha-${checkout.biblio_id}`,
    checkedOutAt: checkout.checkout_date,
    dueAt: checkout.due_date,
    returnedAt: checkout.checkin_date ?? undefined,
    renewals: checkout.renewals_count ?? 0,
    maxRenewals: checkout.max_renewals ?? maxRenewals,
    status: returned ? 'returned' : overdue ? 'overdue' : 'active',
  }
}

export function toHold(hold: KohaHold): Hold {
  // Koha marks a hold waiting for collection with status "W" / a waiting date.
  const ready = hold.status === 'W' || Boolean(hold.waiting_date)
  const cancelled = hold.status === 'C'

  return {
    id: String(hold.hold_id),
    resourceId: `koha-${hold.biblio_id}`,
    placedAt: hold.hold_date,
    queuePosition: ready ? 0 : (hold.priority ?? 1),
    status: cancelled ? 'cancelled' : ready ? 'ready' : 'pending',
    expiresAt: hold.expiration_date ?? undefined,
  }
}

/** `koha-123` back to the biblio id Koha expects. */
export function biblioIdFrom(resourceId: string): number {
  const parsed = Number(resourceId.replace(/^koha-/, ''))
  if (!Number.isFinite(parsed)) throw new Error(`Not a Koha resource id: ${resourceId}`)
  return parsed
}
