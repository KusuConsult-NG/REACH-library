import { config, usingLiveIdp } from './config.js'
import { HttpError } from './errors.js'
import type { User, UserRole } from './types.js'

/**
 * Identity: exchange university credentials for a REACH user record.
 *
 * With `IDP_TOKEN_URL` set, this performs an OAuth 2.0 password-grant exchange
 * against the university IdP and reads the profile claims. The borrower number
 * comes from Koha, looked up by card number, because the IdP does not know it.
 *
 * With the IdP unset, a development identity is synthesised from the username.
 * `assertDevIdentityAllowed` refuses to do that in production.
 */

export interface PatronLookup {
  (cardNumber: string): Promise<{ patronId: string; category?: string } | undefined>
}

interface IdpClaims {
  sub?: string
  name?: string
  email?: string
  department?: string
  faculty?: string
  /** Institutional affiliation, e.g. "student" / "staff" / "faculty". */
  affiliation?: string
  card_number?: string
}

function initialsFor(name: string): string {
  return (
    name
      .split(/\s+/)
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'RL'
  )
}

function roleFrom(affiliation: string | undefined, category: string | undefined): UserRole {
  const value = `${affiliation ?? ''} ${category ?? ''}`.toLowerCase()
  if (/(faculty|academic|lecturer|professor)/.test(value)) return 'faculty'
  if (/(postgrad|pg|masters|phd|research)/.test(value)) return 'postgraduate'
  if (/(staff|admin)/.test(value)) return 'staff'
  if (/(visit|affiliate|guest)/.test(value)) return 'visiting'
  return 'undergraduate'
}

export function assertDevIdentityAllowed() {
  if (!usingLiveIdp && config.nodeEnv === 'production') {
    throw new Error('IDP_TOKEN_URL must be set in production — refusing to accept development identities')
  }
}

export async function authenticate(
  username: string,
  password: string,
  lookupPatron?: PatronLookup,
): Promise<User> {
  const trimmed = username.trim()
  if (!trimmed || !password.trim()) {
    throw HttpError.badRequest('Enter your university username and password.')
  }

  const claims = usingLiveIdp
    ? await exchangeWithIdp(trimmed, password)
    : developmentClaims(trimmed, password)

  const cardNumber = claims.card_number ?? trimmed
  const patron = lookupPatron ? await lookupPatron(cardNumber) : undefined

  if (usingLiveIdp && !patron) {
    // Authenticated at the university but not registered with the library.
    throw HttpError.conflict(
      'Your university account is not linked to a library borrower record. Please register at the circulation desk.',
    )
  }

  const name = claims.name ?? trimmed
  return {
    id: claims.sub ?? trimmed,
    username: trimmed,
    name,
    email: claims.email ?? `${trimmed.replace(/\s+/g, '').toLowerCase()}@unijos.edu.ng`,
    role: roleFrom(claims.affiliation, patron?.category),
    department: claims.department ?? 'University of Jos',
    faculty: claims.faculty ?? 'University of Jos',
    avatarInitials: initialsFor(name),
    borrowerNumber: patron?.patronId ?? devBorrowerNumber(trimmed),
    joinedAt: new Date().toISOString(),
  }
}

async function exchangeWithIdp(username: string, password: string): Promise<IdpClaims> {
  const body = new URLSearchParams({
    grant_type: 'password',
    username,
    password,
    client_id: config.idp.clientId,
    client_secret: config.idp.clientSecret,
    scope: 'openid profile email',
  })

  let response: Response
  try {
    response = await fetch(config.idp.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })
  } catch {
    throw HttpError.upstream('The university sign-in service could not be reached.')
  }

  if (response.status === 400 || response.status === 401) {
    throw HttpError.unauthorized('That username and password combination was not recognised.')
  }
  if (!response.ok) throw HttpError.upstream('The university sign-in service could not be reached.')

  const token = (await response.json()) as { access_token?: string }
  if (!token.access_token) throw HttpError.upstream('The university sign-in service returned no token.')

  if (!config.idp.userInfoUrl) return {}

  const profile = await fetch(config.idp.userInfoUrl, {
    headers: { Authorization: `Bearer ${token.access_token}` },
  }).catch(() => null)

  if (!profile?.ok) return {}
  return (await profile.json()) as IdpClaims
}

/** Deterministic development identity — never reached in production. */
function developmentClaims(username: string, password: string): IdpClaims {
  if (password.trim().length < 4) {
    throw HttpError.unauthorized('That username and password combination was not recognised.')
  }

  const normalised = username.toLowerCase()
  const affiliation = normalised.startsWith('pg')
    ? 'postgraduate'
    : /^(dr|prof|staff)/.test(normalised)
      ? 'faculty'
      : 'student'

  // A matriculation number carries no name or department, so development
  // identities get a stable, plausible profile derived from the credential.
  // A live IdP supplies these as claims instead.
  const NAMES = [
    'Amina Bello',
    'Terhemba Iorlaha',
    'Chidera Okafor',
    'Gyang Pam',
    'Fatima Sani',
    'Nanle Dashe',
    'Oluwaseun Adebayo',
    'Rahila Musa',
  ]
  const HOMES = [
    { department: 'Public Health', faculty: 'Medical Sciences' },
    { department: 'Civil Engineering', faculty: 'Engineering' },
    { department: 'Private & Property Law', faculty: 'Law' },
    { department: 'Curriculum Studies', faculty: 'Education' },
    { department: 'Geography & Planning', faculty: 'Environmental Sciences' },
    { department: 'Accounting', faculty: 'Management Sciences' },
  ]

  const hash = hashOf(normalised)
  const words = normalised
    .replace(/[^a-z]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((part) => part.length >= 3)
  const home = HOMES[hash % HOMES.length]

  return {
    sub: `dev-${normalised}`,
    // Two or more usable words look like a name; a lone department code
    // ("ENG" out of pg/2023/eng/0042) does not.
    name:
      words.length >= 2
        ? words.map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')
        : NAMES[hash % NAMES.length],
    affiliation,
    department: home.department,
    faculty: home.faculty,
  }
}

function hashOf(value: string): number {
  let hash = 0
  for (const character of value) hash = (hash * 31 + character.charCodeAt(0)) >>> 0
  return hash
}

function devBorrowerNumber(username: string): string {
  return String(20000 + (hashOf(username.toLowerCase()) % 9000))
}
