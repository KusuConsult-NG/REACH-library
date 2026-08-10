import { describe, expect, it } from 'vitest'
import { citationFor, fileNameFor, recordTextFor, risFor } from './citation'
import type { Resource } from '@/types'

const book: Resource = {
  id: 'r-005',
  biblionumber: '103771',
  title: 'Structural Analysis for Civil Engineers',
  authors: ['Ibrahim Sule', 'Peter Oyelaran'],
  type: 'book',
  subjects: ['Engineering', 'Civil Engineering'],
  year: 2020,
  publisher: 'University Press PLC',
  isbn: '9789781234567',
  language: 'English',
  callNumber: 'TA645 .S85 2020',
  location: 'Level 2, Science',
  copiesTotal: 4,
  copiesAvailable: 2,
  coverColor: '#0077b6',
  accessCount: 812,
  abstract: 'An introduction to determinate and indeterminate structures.',
}

describe('citationFor', () => {
  it('puts surnames first and ends the title with a stop', () => {
    expect(citationFor(book)).toBe(
      'Sule, Ibrahim; Oyelaran, Peter (2020). Structural Analysis for Civil Engineers. University Press PLC.',
    )
  })

  it('does not double the full stop on a title that already has one', () => {
    expect(citationFor({ ...book, title: 'Why buildings stand up.' })).toContain(
      'Why buildings stand up. University Press PLC.',
    )
  })

  it('marks a thesis as one, and attributes it to the university', () => {
    const reference = citationFor({ ...book, type: 'thesis', publisher: undefined })
    expect(reference).toContain('[Thesis]. University of Jos.')
  })

  it('falls back to the library when a record carries no author', () => {
    expect(citationFor({ ...book, authors: [] })).toContain('University of Jos Library (2020)')
  })

  it('handles a mononym without inventing a surname', () => {
    expect(citationFor({ ...book, authors: ['Aristotle'] })).toContain('Aristotle (2020)')
  })
})

describe('risFor', () => {
  const ris = risFor(book)

  it('opens with the right type and closes the record', () => {
    expect(ris.startsWith('TY  - BOOK')).toBe(true)
    expect(ris.trimEnd().endsWith('ER  -')).toBe(true)
  })

  it('uses CRLF, which is what citation managers expect', () => {
    expect(ris).toContain('\r\n')
    expect(ris.split('\r\n').length).toBeGreaterThan(8)
  })

  it('emits one AU line per author and one KW per subject', () => {
    expect(ris.match(/^AU {2}- /gm)).toHaveLength(2)
    expect(ris.match(/^KW {2}- /gm)).toHaveLength(2)
  })

  it('maps each resource type to its RIS code', () => {
    expect(risFor({ ...book, type: 'thesis' })).toContain('TY  - THES')
    expect(risFor({ ...book, type: 'journal' })).toContain('TY  - JOUR')
    expect(risFor({ ...book, type: 'ebook' })).toContain('TY  - EBOOK')
  })

  it('leaves out fields the record does not have', () => {
    const sparse = risFor({ ...book, isbn: undefined, publisher: undefined, url: undefined })
    expect(sparse).not.toContain('SN  -')
    expect(sparse).not.toContain('PB  -')
    expect(sparse).not.toContain('UR  -')
  })
})

describe('recordTextFor', () => {
  it('carries the shelf mark and copy count a borrower actually needs', () => {
    const text = recordTextFor(book)
    expect(text).toContain('Call number: TA645 .S85 2020')
    expect(text).toContain('Shelf location: Level 2, Science')
    expect(text).toContain('Copies: 2 of 4 available')
  })

  it('omits the copies line for a record with no physical stock', () => {
    const text = recordTextFor({ ...book, copiesTotal: undefined, copiesAvailable: undefined })
    expect(text).not.toContain('Copies:')
  })
})

describe('fileNameFor', () => {
  it('builds a safe, recognisable filename', () => {
    expect(fileNameFor(book, 'ris')).toBe('sule-2020-structural-analysis-for-civil-engineers.ris')
  })

  it('strips characters that would break a download folder', () => {
    const name = fileNameFor({ ...book, title: 'Law/Policy: a review (2nd ed.)' }, 'txt')
    expect(name).not.toMatch(/[/\\:()]/)
    expect(name.endsWith('.txt')).toBe(true)
  })
})
