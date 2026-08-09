import { useEffect, useMemo, useRef } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { loadResource, toggleSaved } from '@/features/catalogue/catalogueSlice'
import {
  borrowResource,
  downloadResource,
  openEresource,
  recordBrowse,
  reserveResource,
} from '@/features/catalogue/actions'
import { AvailabilityTag, ResourceCard, TYPE_LABELS, initialsFor } from '@/components/ResourceCard'
import { Skeleton, Spinner } from '@/components/primitives'
import { BookmarkIcon, DownloadIcon, ExternalIcon, MapIcon } from '@/components/icons'
import { XP_VALUES } from '@/config/xp'
import { dueLabel, formatDate } from '@/utils/date'

export function ResourceScreen() {
  const { id = '' } = useParams()
  const dispatch = useAppDispatch()

  const resource = useAppSelector((state) => state.catalogue.cache[id])
  const saved = useAppSelector((state) => state.catalogue.saved.includes(id))
  const loans = useAppSelector((state) => state.circulation.loans)
  const holds = useAppSelector((state) => state.circulation.holds)
  const busyId = useAppSelector((state) => state.circulation.busyId)
  const online = useAppSelector((state) => state.ui.online)
  const cache = useAppSelector((state) => state.catalogue.cache)

  const browsed = useRef<string | null>(null)

  useEffect(() => {
    if (!id) return
    void dispatch(loadResource(id))
  }, [dispatch, id])

  // Award the browse XP once per record per visit, after the record resolves.
  useEffect(() => {
    if (!resource || browsed.current === resource.id) return
    browsed.current = resource.id
    dispatch(recordBrowse(resource))
  }, [dispatch, resource])

  const loan = loans.find((l) => l.resourceId === id && l.status !== 'returned')
  const hold = holds.find((h) => h.resourceId === id && h.status !== 'cancelled')
  const busy = busyId === id

  const related = useMemo(() => {
    if (!resource) return []
    return Object.values(cache)
      .filter((r) => r.id !== resource.id && r.subjects.some((s) => resource.subjects.includes(s)))
      .slice(0, 3)
  }, [cache, resource])

  if (!resource) {
    return (
      <div className="stack">
        <div className="hero">
          <Skeleton height={132} width={96} />
          <div className="stack stack--tight" style={{ flex: 1 }}>
            <Skeleton height={18} width="90%" />
            <Skeleton height={14} width="60%" />
            <Skeleton height={24} width="45%" />
          </div>
        </div>
        <Skeleton height={46} />
        <Skeleton height={120} />
      </div>
    )
  }

  const isDigital = resource.copiesAvailable == null
  const available = (resource.copiesAvailable ?? 0) > 0

  return (
    <div className="stack" style={{ gap: 'var(--space-5)' }}>
      <div className="hero">
        <div className="cover cover--lg" style={{ background: resource.coverColor }} aria-hidden="true">
          {initialsFor(resource.title)}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h1 style={{ fontSize: '1.25rem' }}>{resource.title}</h1>
          <p className="muted small" style={{ marginTop: 4 }}>
            {resource.authors.join(', ')}
          </p>
          <p className="muted small">
            {resource.publisher ? `${resource.publisher}, ` : ''}
            {resource.year}
          </p>
          <div className="resource__tags">
            <span className="tag">{TYPE_LABELS[resource.type]}</span>
            <AvailabilityTag resource={resource} />
          </div>
        </div>
      </div>

      {loan ? (
        <div className="card" style={{ borderColor: 'var(--brand-700)' }}>
          <p style={{ fontWeight: 650 }}>You have this on loan</p>
          <p className="small muted">
            Due {formatDate(loan.dueAt)} — {dueLabel(loan.dueAt)}. Renewals used: {loan.renewals} of{' '}
            {loan.maxRenewals}.
          </p>
        </div>
      ) : null}

      {hold ? (
        <div className="card" style={{ borderColor: 'var(--gold-600)' }}>
          <p style={{ fontWeight: 650 }}>Reservation placed</p>
          <p className="small muted">
            You are number {hold.queuePosition} in the queue. We will notify you when it is ready for
            collection.
          </p>
        </div>
      ) : null}

      <div className="stack stack--tight">
        {isDigital ? (
          <>
            <button type="button" className="btn btn--block" onClick={() => dispatch(openEresource(resource))}>
              <ExternalIcon size={18} />
              Open resource (+{XP_VALUES.eresource_access} XP)
            </button>
            <button
              type="button"
              className="btn btn--secondary btn--block"
              onClick={() => dispatch(downloadResource(resource))}
            >
              <DownloadIcon size={18} />
              Download (+{XP_VALUES.resource_download} XP)
            </button>
          </>
        ) : available ? (
          <button
            type="button"
            className="btn btn--block"
            disabled={busy || Boolean(loan) || !online}
            onClick={() => void dispatch(borrowResource(resource))}
          >
            {busy ? <Spinner label="Issuing" /> : null}
            {loan ? 'Already on loan to you' : `Borrow this book (+${XP_VALUES.physical_borrow} XP)`}
          </button>
        ) : (
          <button
            type="button"
            className="btn btn--block"
            disabled={busy || Boolean(hold)}
            onClick={() => void dispatch(reserveResource(resource))}
          >
            {busy ? <Spinner label="Placing hold" /> : null}
            {hold ? 'Reservation already placed' : `Place a hold (+${XP_VALUES.reservation} XP)`}
          </button>
        )}

        <div className="row" style={{ gap: 'var(--space-2)' }}>
          <button
            type="button"
            className="iconbtn"
            aria-pressed={saved}
            aria-label={saved ? 'Remove from saved' : 'Save this record'}
            onClick={() => dispatch(toggleSaved(resource.id))}
          >
            <BookmarkIcon size={20} />
          </button>
          <span className="small muted">{saved ? 'Saved to your list' : 'Save for later'}</span>
        </div>

        {!online && !isDigital ? (
          <p className="small muted">Borrowing needs a connection. Reservations placed offline are queued.</p>
        ) : null}
      </div>

      {resource.abstract ? (
        <section aria-labelledby="about-heading">
          <h2 id="about-heading" style={{ marginBottom: 'var(--space-2)' }}>
            About this resource
          </h2>
          <p className="small">{resource.abstract}</p>
        </section>
      ) : null}

      <section aria-labelledby="details-heading" className="card">
        <h2 id="details-heading" style={{ marginBottom: 'var(--space-3)' }}>
          Catalogue record
        </h2>
        <dl className="stack stack--tight small">
          {[
            ['Type', TYPE_LABELS[resource.type]],
            ['Subjects', resource.subjects.join(', ')],
            ['Language', resource.language],
            resource.isbn ? ['ISBN', resource.isbn] : null,
            resource.callNumber ? ['Call number', resource.callNumber] : null,
            resource.biblionumber ? ['Koha record', resource.biblionumber] : null,
            ['Times accessed', resource.accessCount.toLocaleString()],
          ]
            .filter(Boolean)
            .map((entry) => {
              const [label, value] = entry as [string, string]
              return (
                <div key={label} className="row row--between" style={{ alignItems: 'flex-start', gap: 'var(--space-4)' }}>
                  <dt className="muted" style={{ flex: 'none', minWidth: 110 }}>
                    {label}
                  </dt>
                  <dd style={{ margin: 0, textAlign: 'right' }}>{value}</dd>
                </div>
              )
            })}
        </dl>
      </section>

      {resource.location ? (
        <Link className="quick" to="/tools/map">
          <span className="quick__icon">
            <MapIcon size={20} />
          </span>
          <span>
            <span className="quick__label">{resource.location}</span>
            <span className="quick__sub">Find it on the library map</span>
          </span>
        </Link>
      ) : null}

      {related.length > 0 ? (
        <section className="section" aria-labelledby="related-heading">
          <div className="section__head">
            <h2 id="related-heading">Related in the same subject</h2>
          </div>
          <ul className="stack stack--tight">
            {related.map((item) => (
              <li key={item.id}>
                <ResourceCard resource={item} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
