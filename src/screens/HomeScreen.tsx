import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { XpCard } from '@/components/XpCard'
import { ResourceCard } from '@/components/ResourceCard'
import { EmptyState } from '@/components/primitives'
import { BookIcon, CalendarIcon, ClockIcon, HelpIcon, SearchIcon, TrendIcon } from '@/components/icons'
import { levelFromXp } from '@/features/xp/levels'
import { xpEarnedInWeek } from '@/features/xp/xpSlice'
import { renewWithSync } from '@/features/catalogue/actions'
import { setQuery } from '@/features/catalogue/catalogueSlice'
import { dueLabel } from '@/utils/date'
import { LIBRARY_HOURS } from '@/services/api/seed'

function todayHours() {
  const name = new Date().toLocaleDateString('en-GB', { weekday: 'long' })
  return LIBRARY_HOURS.find((h) => h.day === name)
}

export function HomeScreen() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()

  const xp = useAppSelector((state) => state.xp)
  const loans = useAppSelector((state) => state.circulation.loans)
  const holds = useAppSelector((state) => state.circulation.holds)
  const cache = useAppSelector((state) => state.catalogue.cache)
  const recent = useAppSelector((state) => state.catalogue.recentlyViewed)
  const trending = useAppSelector((state) => state.catalogue.trending)
  const busyId = useAppSelector((state) => state.circulation.busyId)

  const info = useMemo(() => levelFromXp(xp.totalXp), [xp.totalXp])
  const weeklyXp = useMemo(() => xpEarnedInWeek(xp), [xp])

  const activeLoans = loans.filter((l) => l.status !== 'returned')
  const dueSoon = [...activeLoans]
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
    .slice(0, 2)
  const recentResources = recent.map((id) => cache[id]).filter(Boolean).slice(0, 3)
  const hours = todayHours()

  return (
    <div className="stack" style={{ gap: 'var(--space-5)' }}>
      <XpCard
        info={info}
        weeklyXp={weeklyXp}
        weeklyGoal={xp.weeklyGoal}
        streak={xp.streak}
        loans={activeLoans.length}
      />

      <section aria-labelledby="quick-heading">
        <h2 id="quick-heading" className="visually-hidden">
          Quick actions
        </h2>
        <div className="quickgrid">
          <button
            type="button"
            className="quick"
            onClick={() => {
              dispatch(setQuery(''))
              navigate('/search')
            }}
          >
            <span className="quick__icon">
              <SearchIcon size={20} />
            </span>
            <span>
              <span className="quick__label">Search catalogue</span>
              <span className="quick__sub">Books, journals, theses</span>
            </span>
          </button>

          <Link className="quick" to="/search?filter=digital">
            <span className="quick__icon">
              <BookIcon size={20} />
            </span>
            <span>
              <span className="quick__label">E-resources</span>
              <span className="quick__sub">Databases and e-books</span>
            </span>
          </Link>

          <Link className="quick" to="/tools/spaces">
            <span className="quick__icon">
              <CalendarIcon size={20} />
            </span>
            <span>
              <span className="quick__label">Book a space</span>
              <span className="quick__sub">Study and discussion rooms</span>
            </span>
          </Link>

          <Link className="quick" to="/tools/librarian">
            <span className="quick__icon">
              <HelpIcon size={20} />
            </span>
            <span>
              <span className="quick__label">Ask a librarian</span>
              <span className="quick__sub">Research consultation</span>
            </span>
          </Link>
        </div>
      </section>

      <section className="section" aria-labelledby="loans-heading">
        <div className="section__head">
          <h2 id="loans-heading">On loan</h2>
          <Link className="section__link" to="/profile">
            See all
          </Link>
        </div>

        {dueSoon.length === 0 ? (
          <div className="card">
            <EmptyState
              icon={<BookIcon size={28} />}
              title="Nothing on loan"
              body="Borrow a book from the catalogue and it will appear here with its due date."
            />
          </div>
        ) : (
          <ul className="stack stack--tight">
            {dueSoon.map((loan) => {
              const resource = cache[loan.resourceId]
              const overdue = loan.status === 'overdue'
              return (
                <li key={loan.id} className="card">
                  <div className="row row--between" style={{ alignItems: 'flex-start' }}>
                    <div style={{ minWidth: 0 }}>
                      <p className="resource__title">{resource?.title ?? 'Borrowed item'}</p>
                      <p className={overdue ? 'small' : 'small muted'} style={overdue ? { color: 'var(--danger-600)', fontWeight: 650 } : undefined}>
                        {dueLabel(loan.dueAt)}
                        {loan.renewals > 0 ? ` · renewed ${loan.renewals}×` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="btn btn--secondary btn--sm"
                      disabled={busyId === loan.id || loan.renewals >= loan.maxRenewals}
                      onClick={() => void dispatch(renewWithSync(loan.id))}
                    >
                      {loan.renewals >= loan.maxRenewals ? 'Return due' : 'Renew'}
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        {holds.length > 0 ? (
          <p className="small muted" style={{ marginTop: 'var(--space-3)' }}>
            {holds.length} reservation{holds.length === 1 ? '' : 's'} pending collection.
          </p>
        ) : null}
      </section>

      {recentResources.length > 0 ? (
        <section className="section" aria-labelledby="recent-heading">
          <div className="section__head">
            <h2 id="recent-heading">Pick up where you left off</h2>
          </div>
          <ul className="stack stack--tight">
            {recentResources.map((resource) => (
              <li key={resource.id}>
                <ResourceCard resource={resource} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="section" aria-labelledby="trending-heading">
        <div className="section__head">
          <h2 id="trending-heading">Trending in the library</h2>
          <Link className="section__link" to="/community">
            More
          </Link>
        </div>
        <div className="card">
          {trending.length === 0 ? (
            <p className="small muted">Trending resources will appear once the catalogue has been read.</p>
          ) : (
            <ul>
              {trending.slice(0, 4).map((entry, index) => (
                <li key={entry.resourceId}>
                  <Link className="rank" to={`/resource/${entry.resourceId}`}>
                    <span className="rank__num">{index + 1}</span>
                    <span style={{ minWidth: 0, flex: 1 }}>
                      <span className="resource__title">{entry.title}</span>
                      <span className="resource__meta">{entry.department}</span>
                    </span>
                    <span
                      className={`delta ${entry.delta > 0 ? 'delta--up' : entry.delta < 0 ? 'delta--down' : 'delta--flat'}`}
                    >
                      {entry.delta > 0 ? `▲ ${entry.delta}` : entry.delta < 0 ? `▼ ${Math.abs(entry.delta)}` : '—'}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="section" aria-labelledby="hours-heading">
        <h2 id="hours-heading" className="visually-hidden">
          Library hours today
        </h2>
        <Link className="quick" to="/tools">
          <span className="quick__icon">
            <ClockIcon size={20} />
          </span>
          <span>
            <span className="quick__label">
              {hours ? `Open today ${hours.opens} – ${hours.closes}` : 'Library hours'}
            </span>
            <span className="quick__sub">Main Library, Bauchi Road Campus</span>
          </span>
        </Link>
      </section>

      <section className="section">
        <Link className="quick" to="/community">
          <span className="quick__icon">
            <TrendIcon size={20} />
          </span>
          <span>
            <span className="quick__label">What your department is reading</span>
            <span className="quick__sub">Anonymous activity across the university</span>
          </span>
        </Link>
      </section>
    </div>
  )
}
