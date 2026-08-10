import { Link } from 'react-router-dom'
import type { Resource } from '@/types'

export const TYPE_LABELS: Record<Resource['type'], string> = {
  book: 'Book',
  ebook: 'E-book',
  journal: 'Journal',
  thesis: 'Thesis',
  article: 'Article',
  av: 'Audio/Visual',
}

export function initialsFor(title: string) {
  return title
    .replace(/^(the|a|an)\s+/i, '')
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase()
}

/**
 * What is on the shelf, at a glance.
 *
 * The count matters more than the word: "available" tells a student nothing
 * about whether to hurry, and a title down to its last copy is the case where
 * they most need to know before walking across campus.
 */
export function AvailabilityTag({ resource }: { resource: Resource }) {
  const available = resource.copiesAvailable
  if (available == null) {
    return <span className="tag tag--digital">Online access</span>
  }
  if (available === 0) {
    return (
      <span className="tag tag--out">
        All {resource.copiesTotal} on loan
      </span>
    )
  }
  if (available === 1) {
    return <span className="tag tag--last">Last copy on the shelf</span>
  }
  return (
    <span className="tag tag--available">
      {available} of {resource.copiesTotal} on the shelf
    </span>
  )
}

export function ResourceCard({ resource }: { resource: Resource }) {
  return (
    <Link className="resource" to={`/resource/${resource.id}`}>
      <div className="cover" style={{ background: resource.coverColor }} aria-hidden="true">
        {initialsFor(resource.title)}
      </div>
      <div className="resource__body">
        <p className="resource__title">{resource.title}</p>
        <p className="resource__meta">
          {resource.authors.join(', ')} · {resource.year}
        </p>
        <div className="resource__tags">
          <span className="tag">{TYPE_LABELS[resource.type]}</span>
          <AvailabilityTag resource={resource} />
          {resource.repository ? <span className="tag tag--award">Repository</span> : null}
        </div>
      </div>
    </Link>
  )
}
