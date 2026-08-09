import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import {
  clearFilters,
  clearRecentSearches,
  rememberSearch,
  runSearch,
  setFilters,
  setQuery,
  toggleSubject,
  toggleType,
} from '@/features/catalogue/catalogueSlice'
import { ResourceCard, TYPE_LABELS } from '@/components/ResourceCard'
import { Chip, EmptyState, Sheet, Skeleton, Switch } from '@/components/primitives'
import { CloseIcon, FilterIcon, SearchIcon } from '@/components/icons'
import { SUBJECT_AREAS } from '@/services/api/seed'
import type { ResourceType } from '@/types'

const TYPES: ResourceType[] = ['book', 'ebook', 'journal', 'thesis', 'article', 'av']

export function SearchScreen() {
  const dispatch = useAppDispatch()
  const [params, setParams] = useSearchParams()
  const { query, filters, results, total, page, status, error, recentSearches } = useAppSelector(
    (state) => state.catalogue,
  )
  const [showFilters, setShowFilters] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const initialised = useRef(false)

  // Honour deep links: /search?q=… and the home screen's e-resources shortcut.
  useEffect(() => {
    if (initialised.current) return
    initialised.current = true

    const q = params.get('q')
    const filter = params.get('filter')
    if (q) dispatch(setQuery(q))
    if (filter === 'digital') dispatch(setFilters({ types: ['ebook', 'journal', 'article'] }))
    if (filter === 'repository') dispatch(setFilters({ repositoryOnly: true }))
    if (filter === 'available') dispatch(setFilters({ availableOnly: true }))
    void dispatch(runSearch())
  }, [dispatch, params])

  // Re-run whenever a filter changes; typing is submitted explicitly.
  useEffect(() => {
    if (!initialised.current) return
    void dispatch(runSearch())
  }, [dispatch, filters])

  const activeFilters =
    filters.types.length +
    filters.subjects.length +
    (filters.availableOnly ? 1 : 0) +
    (filters.repositoryOnly ? 1 : 0)

  const pages = Math.ceil(total / 10)

  function submit(event: React.FormEvent) {
    event.preventDefault()
    dispatch(rememberSearch(query))
    const next = new URLSearchParams(params)
    if (query) next.set('q', query)
    else next.delete('q')
    setParams(next, { replace: true })
    void dispatch(runSearch())
    inputRef.current?.blur()
  }

  return (
    <div className="stack" style={{ gap: 'var(--space-4)' }}>
      <form onSubmit={submit} role="search">
        <label className="visually-hidden" htmlFor="catalogue-search">
          Search the library catalogue
        </label>
        <div className="searchbar">
          <SearchIcon size={20} />
          <input
            id="catalogue-search"
            ref={inputRef}
            type="search"
            enterKeyHint="search"
            placeholder="Title, author, subject or ISBN"
            value={query}
            onChange={(e) => dispatch(setQuery(e.target.value))}
          />
          {query ? (
            <button
              type="button"
              className="iconbtn"
              style={{ width: 34, height: 34, border: 0 }}
              aria-label="Clear search"
              onClick={() => {
                dispatch(setQuery(''))
                void dispatch(runSearch())
                inputRef.current?.focus()
              }}
            >
              <CloseIcon size={18} />
            </button>
          ) : null}
        </div>
      </form>

      <div className="row row--between">
        <button type="button" className="chip" aria-pressed={activeFilters > 0} onClick={() => setShowFilters(true)}>
          <FilterIcon size={16} />
          Filters{activeFilters > 0 ? ` (${activeFilters})` : ''}
        </button>

        <label className="visually-hidden" htmlFor="sort">
          Sort results
        </label>
        <select
          id="sort"
          className="select"
          style={{ width: 'auto', minHeight: 36, padding: '0 var(--space-3)' }}
          value={filters.sort}
          onChange={(e) => dispatch(setFilters({ sort: e.target.value as typeof filters.sort }))}
        >
          <option value="relevance">Most relevant</option>
          <option value="popular">Most used</option>
          <option value="year">Newest first</option>
          <option value="title">Title A–Z</option>
        </select>
      </div>

      {activeFilters > 0 ? (
        <div className="wrap">
          {filters.types.map((type) => (
            <Chip key={type} pressed onClick={() => dispatch(toggleType(type))}>
              {TYPE_LABELS[type]} ✕
            </Chip>
          ))}
          {filters.subjects.map((subject) => (
            <Chip key={subject} pressed onClick={() => dispatch(toggleSubject(subject))}>
              {subject} ✕
            </Chip>
          ))}
          {filters.availableOnly ? (
            <Chip pressed onClick={() => dispatch(setFilters({ availableOnly: false }))}>
              Available now ✕
            </Chip>
          ) : null}
          {filters.repositoryOnly ? (
            <Chip pressed onClick={() => dispatch(setFilters({ repositoryOnly: false }))}>
              Repository ✕
            </Chip>
          ) : null}
          <button type="button" className="section__link" onClick={() => dispatch(clearFilters())}>
            Clear all
          </button>
        </div>
      ) : null}

      {!query && recentSearches.length > 0 && status !== 'loading' ? (
        <section aria-labelledby="recent-searches">
          <div className="section__head">
            <h2 id="recent-searches" className="small muted">
              Recent searches
            </h2>
            <button type="button" className="section__link" onClick={() => dispatch(clearRecentSearches())}>
              Clear
            </button>
          </div>
          <div className="wrap">
            {recentSearches.map((term) => (
              <Chip
                key={term}
                pressed={false}
                onClick={() => {
                  dispatch(setQuery(term))
                  void dispatch(runSearch())
                }}
              >
                {term}
              </Chip>
            ))}
          </div>
        </section>
      ) : null}

      <p className="small muted" aria-live="polite">
        {status === 'loading'
          ? 'Searching…'
          : status === 'error'
            ? ''
            : `${total} result${total === 1 ? '' : 's'}${query ? ` for “${query}”` : ''}`}
      </p>

      {status === 'error' ? (
        <div className="card">
          <EmptyState title="Search unavailable" body={error ?? undefined} />
        </div>
      ) : null}

      {status === 'loading' ? (
        <ul className="stack stack--tight">
          {[0, 1, 2, 3].map((i) => (
            <li key={i} className="resource">
              <Skeleton height={72} width={52} />
              <div className="resource__body stack stack--tight">
                <Skeleton height={14} width="80%" />
                <Skeleton height={12} width="55%" />
                <Skeleton height={20} width="40%" />
              </div>
            </li>
          ))}
        </ul>
      ) : results.length === 0 && status === 'ready' ? (
        <div className="card">
          <EmptyState
            icon={<SearchIcon size={28} />}
            title="No matching records"
            body="Try a broader term, check the spelling, or clear some filters. Subject librarians can also run the search for you."
            action={
              activeFilters > 0 ? (
                <button type="button" className="btn btn--secondary btn--sm" onClick={() => dispatch(clearFilters())}>
                  Clear filters
                </button>
              ) : null
            }
          />
        </div>
      ) : (
        <ul className="stack stack--tight">
          {results.map((resource) => (
            <li key={resource.id}>
              <ResourceCard resource={resource} />
            </li>
          ))}
        </ul>
      )}

      {pages > 1 ? (
        <nav className="row row--between" aria-label="Search results pages">
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            disabled={page <= 1}
            onClick={() => void dispatch(runSearch({ page: page - 1 }))}
          >
            Previous
          </button>
          <span className="small muted">
            Page {page} of {pages}
          </span>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            disabled={page >= pages}
            onClick={() => void dispatch(runSearch({ page: page + 1 }))}
          >
            Next
          </button>
        </nav>
      ) : null}

      {showFilters ? (
        <Sheet
          title="Filter results"
          onClose={() => setShowFilters(false)}
          footer={
            <div className="row" style={{ gap: 'var(--space-2)' }}>
              <button type="button" className="btn btn--ghost" onClick={() => dispatch(clearFilters())}>
                Reset
              </button>
              <button type="button" className="btn btn--block" onClick={() => setShowFilters(false)}>
                Show {total} result{total === 1 ? '' : 's'}
              </button>
            </div>
          }
        >
          <div className="stack">
            <div>
              <h3 style={{ marginBottom: 'var(--space-2)' }}>Resource type</h3>
              <div className="wrap">
                {TYPES.map((type) => (
                  <Chip key={type} pressed={filters.types.includes(type)} onClick={() => dispatch(toggleType(type))}>
                    {TYPE_LABELS[type]}
                  </Chip>
                ))}
              </div>
            </div>

            <div>
              <h3 style={{ marginBottom: 'var(--space-2)' }}>Subject area</h3>
              <div className="wrap">
                {SUBJECT_AREAS.map((subject) => (
                  <Chip
                    key={subject}
                    pressed={filters.subjects.includes(subject)}
                    onClick={() => dispatch(toggleSubject(subject))}
                  >
                    {subject}
                  </Chip>
                ))}
              </div>
            </div>

            <div className="card">
              <Switch
                label="Available now"
                description="Hide records with no copy on the shelf."
                checked={filters.availableOnly}
                onChange={(availableOnly) => dispatch(setFilters({ availableOnly }))}
              />
              <Switch
                label="Institutional repository only"
                description="Theses, datasets and articles published by the university."
                checked={filters.repositoryOnly}
                onChange={(repositoryOnly) => dispatch(setFilters({ repositoryOnly }))}
              />
            </div>
          </div>
        </Sheet>
      ) : null}
    </div>
  )
}
