import type { Resource } from '@/types'

/**
 * Catalogue records as text you can take away.
 *
 * The library does not own the full text of most of what it catalogues — that
 * sits with publishers behind the institutional subscription — but it does own
 * the record, and a record is what a student actually needs to cite, paste into
 * a reading list, or hand to a supervisor. So this is deliberately about the
 * record, not the book: everything here is generated from data the app already
 * holds, which is why it works offline and why nothing here is invented.
 */

/** RIS type codes, as understood by Zotero, Mendeley and EndNote. */
const RIS_TYPES: Record<Resource['type'], string> = {
  book: 'BOOK',
  ebook: 'EBOOK',
  journal: 'JOUR',
  article: 'JOUR',
  thesis: 'THES',
  av: 'ADVS',
}

function surnameFirst(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length < 2) return name.trim()
  const surname = parts[parts.length - 1]
  return `${surname}, ${parts.slice(0, -1).join(' ')}`
}

/**
 * An APA-shaped reference. Deliberately not a full CSL implementation: getting
 * one style right and saying which it is beats getting five subtly wrong.
 */
export function citationFor(resource: Resource): string {
  const authors = resource.authors.length
    ? resource.authors.map(surnameFirst).join('; ')
    : 'University of Jos Library'
  const title = resource.title.endsWith('.') ? resource.title : `${resource.title}.`
  const publisher = resource.publisher ? ` ${resource.publisher}.` : ''
  const thesis = resource.type === 'thesis' ? ' [Thesis]. University of Jos.' : ''
  return `${authors} (${resource.year}). ${title}${thesis}${publisher}`.replace(/\s+/g, ' ').trim()
}

/** The whole record as a citation-manager import file. */
export function risFor(resource: Resource): string {
  const lines: string[] = [`TY  - ${RIS_TYPES[resource.type]}`]
  for (const author of resource.authors) lines.push(`AU  - ${surnameFirst(author)}`)
  lines.push(`TI  - ${resource.title}`)
  lines.push(`PY  - ${resource.year}`)
  if (resource.publisher) lines.push(`PB  - ${resource.publisher}`)
  if (resource.isbn) lines.push(`SN  - ${resource.isbn}`)
  lines.push(`LA  - ${resource.language}`)
  for (const subject of resource.subjects) lines.push(`KW  - ${subject}`)
  if (resource.abstract) lines.push(`AB  - ${resource.abstract}`)
  if (resource.callNumber) lines.push(`CN  - ${resource.callNumber}`)
  if (resource.url) lines.push(`UR  - ${resource.url}`)
  lines.push('DP  - University of Jos Library')
  lines.push('ER  - ')
  // RIS is a CRLF format; some managers reject LF-only files.
  return `${lines.join('\r\n')}\r\n`
}

/** Everything on the record, as plain readable text. */
export function recordTextFor(resource: Resource): string {
  const rows: [string, string | undefined][] = [
    ['Title', resource.title],
    ['Authors', resource.authors.join(', ')],
    ['Year', String(resource.year)],
    ['Publisher', resource.publisher],
    ['Type', resource.type],
    ['Subjects', resource.subjects.join(', ')],
    ['Language', resource.language],
    ['ISBN', resource.isbn],
    ['Call number', resource.callNumber],
    ['Shelf location', resource.location],
    ['Koha record', resource.biblionumber],
    ['Copies', resource.copiesTotal == null ? undefined : `${resource.copiesAvailable} of ${resource.copiesTotal} available`],
  ]

  const body = rows
    .filter((row): row is [string, string] => Boolean(row[1]))
    .map(([label, value]) => `${label}: ${value}`)
    .join('\n')

  return [
    'UNIVERSITY OF JOS LIBRARY — CATALOGUE RECORD',
    '',
    body,
    '',
    resource.abstract ? `Abstract\n${resource.abstract}\n` : '',
    `Citation\n${citationFor(resource)}`,
    '',
    'Retrieved from REACH, the University of Jos Library app.',
  ]
    .filter(Boolean)
    .join('\n')
}

/** A filename that survives a download folder: no slashes, no surprises. */
export function fileNameFor(resource: Resource, extension: string): string {
  const stem = `${resource.authors[0]?.split(/\s+/).pop() ?? 'unijos'}-${resource.year}-${resource.title}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
  return `${stem}.${extension}`
}
