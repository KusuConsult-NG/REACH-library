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

export function AvailabilityTag({ resource }: { resource: Resource }) {
  if (resource.copiesAvailable == null) {
    return <span className="tag tag--digital">Online access</span>
  }
  if (resource.copiesAvailable > 0) {
    return (
      <span className="tag tag--available">
        {resource.copiesAvailable} of {resource.copiesTotal} available
      </span>
    )
  }
  return <span className="tag tag--out">All copies on loan</span>
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
          {resource.repository ? <span className="tag tag--gold">Repository</span> : null}
        </div>
      </div>
    </Link>
  )
}
