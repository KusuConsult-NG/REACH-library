import { developmentProfile, devBorrowerNumber } from './idp.js'
import type { KohaClient } from './koha/client.js'

/**
 * Looking a member up by the number printed on their card.
 *
 * Used only to name the person before XP is sent to them. It returns the
 * minimum needed to recognise a colleague — borrower number, name, department —
 * and never an email, phone number or address, so the endpoint cannot be walked
 * to build a contact list out of the borrower file.
 */

export interface MemberRef {
  id: string
  name: string
  department: string
}

export interface MemberDirectory {
  lookup(identifier: string): Promise<MemberRef | undefined>
}

interface KohaPatron {
  patron_id: number
  cardnumber?: string
  firstname?: string
  surname?: string
  library_id?: string
}

export function kohaDirectory(koha: KohaClient): MemberDirectory {
  return {
    async lookup(identifier) {
      const patrons = await koha
        .request<KohaPatron[]>(`/patrons?cardnumber=${encodeURIComponent(identifier)}`)
        .catch(() => [])
      const patron = patrons[0]
      if (!patron) return undefined

      const name = [patron.firstname, patron.surname].filter(Boolean).join(' ').trim()
      return {
        id: String(patron.patron_id),
        name: name || patron.cardnumber || String(patron.patron_id),
        department: patron.library_id ?? 'University of Jos',
      }
    },
  }
}

/** Development directory: the same derivation the dev IdP uses, minus the password. */
export function devDirectory(): MemberDirectory {
  return {
    async lookup(identifier) {
      const trimmed = identifier.trim()
      // Too short to be a card number; treat as no match rather than inventing one.
      if (trimmed.length < 3) return undefined

      const claims = developmentProfile(trimmed)
      return {
        id: devBorrowerNumber(trimmed),
        name: claims.name ?? trimmed,
        department: claims.department ?? 'University of Jos',
      }
    },
  }
}
