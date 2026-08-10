import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { XpCard } from '@/components/XpCard'
import { ResourceCard } from '@/components/ResourceCard'
import { EmptyState } from '@/components/primitives'
import { BookIcon, SettingsIcon, StarIcon } from '@/components/icons'
import { ACTIVITY_LABELS } from '@/config/xp'
import { levelFromXp } from '@/features/xp/levels'
import { xpEarnedInWeek } from '@/features/xp/xpSlice'
import { cancelHold, returnLoan, setBusy } from '@/features/circulation/circulationSlice'
import { renewWithSync } from '@/features/catalogue/actions'
import { dueLabel, formatDate, relativeTime } from '@/utils/date'
import { ROLE_LABELS } from '@/utils/labels'

type Tab = 'loans' | 'history' | 'saved' | 'activity'

export function ProfileScreen() {
  const dispatch = useAppDispatch()
  const [tab, setTab] = useState<Tab>('loans')

  const user = useAppSelector((state) => state.auth.user)
  const xp = useAppSelector((state) => state.xp)
  const balance = useAppSelector((state) => state.xp.balance)
  const { loans, holds, busyId } = useAppSelector((state) => state.circulation)
  const cache = useAppSelector((state) => state.catalogue.cache)
  const saved = useAppSelector((state) => state.catalogue.saved)

  const info = useMemo(() => levelFromXp(xp.totalXp), [xp.totalXp])
  const weeklyXp = useMemo(() => xpEarnedInWeek(xp), [xp])

  const active = loans.filter((l) => l.status !== 'returned')
  const history = loans.filter((l) => l.status === 'returned')
  const savedResources = saved.map((id) => cache[id]).filter(Boolean)

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'loans', label: 'On loan', count: active.length },
    { id: 'history', label: 'History', count: history.length },
    { id: 'saved', label: 'Saved', count: savedResources.length },
    { id: 'activity', label: 'XP log', count: xp.activities.length },
  ]

  return (
    <div className="stack" style={{ gap: 'var(--space-5)' }}>
      <section className="card">
        <div className="row">
          <span className="avatar avatar--lg" aria-hidden="true">
            {user?.avatarInitials ?? 'RL'}
          </span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h1 style={{ fontSize: '1.15rem' }}>{user?.name}</h1>
            <p className="small muted">
              {user ? ROLE_LABELS[user.role] : ''} · {user?.department}
            </p>
            {user && user.faculty !== user.department ? (
              <p className="small muted">{user.faculty}</p>
            ) : null}
          </div>
          <Link to="/settings" className="iconbtn" aria-label="Settings">
            <SettingsIcon size={20} />
          </Link>
        </div>
        {user ? (
          <p className="small muted" style={{ marginTop: 'var(--space-3)' }}>
            Borrower {user.borrowerNumber} · member since {formatDate(user.joinedAt)}
          </p>
        ) : null}
      </section>

      <XpCard
        info={info}
        weeklyXp={weeklyXp}
        weeklyGoal={xp.weeklyGoal}
        streak={xp.streak}
        loans={active.length}
      />

      <Link className="quick" to="/rewards">
        <span className="quick__icon">
          <StarIcon size={20} />
        </span>
        <span>
          <span className="quick__label">{balance.toLocaleString()} XP to spend</span>
          <span className="quick__sub">Extra loans, printing, room priority</span>
        </span>
      </Link>

      {holds.length > 0 ? (
        <section className="section" aria-labelledby="holds-heading">
          <div className="section__head">
            <h2 id="holds-heading">Reservations</h2>
          </div>
          <ul className="stack stack--tight">
            {holds.map((hold) => (
              <li key={hold.id} className="card">
                <div className="row row--between" style={{ alignItems: 'flex-start' }}>
                  <div style={{ minWidth: 0 }}>
                    <p className="resource__title">{cache[hold.resourceId]?.title ?? 'Reserved item'}</p>
                    <p className="small muted">
                      Position {hold.queuePosition} in queue · placed {relativeTime(hold.placedAt)}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn--danger btn--sm"
                    disabled={busyId === hold.id}
                    onClick={() => {
                      dispatch(setBusy(hold.id))
                      void dispatch(cancelHold(hold.id))
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="section">
        <div className="wrap" role="tablist" aria-label="Profile sections">
          {tabs.map(({ id, label, count }) => (
            <button
              key={id}
              type="button"
              role="tab"
              id={`tab-${id}`}
              aria-selected={tab === id}
              aria-controls={`panel-${id}`}
              className="chip"
              onClick={() => setTab(id)}
            >
              {label} {count > 0 ? `(${count})` : ''}
            </button>
          ))}
        </div>

        <div
          role="tabpanel"
          id={`panel-${tab}`}
          aria-labelledby={`tab-${tab}`}
          style={{ marginTop: 'var(--space-4)' }}
        >
          {tab === 'loans' ? (
            active.length === 0 ? (
              <div className="card">
                <EmptyState
                  icon={<BookIcon size={28} />}
                  title="No items on loan"
                  body="Books you borrow appear here with their due dates and renewal options."
                  action={
                    <Link className="btn btn--secondary btn--sm" to="/search">
                      Browse the catalogue
                    </Link>
                  }
                />
              </div>
            ) : (
              <ul className="stack stack--tight">
                {active.map((loan) => {
                  const resource = cache[loan.resourceId]
                  const overdue = loan.status === 'overdue'
                  return (
                    <li key={loan.id} className="card">
                      <p className="resource__title">{resource?.title ?? 'Borrowed item'}</p>
                      <p
                        className="small"
                        style={{ color: overdue ? 'var(--danger-600)' : 'var(--text-muted)', fontWeight: overdue ? 650 : 400 }}
                      >
                        Due {formatDate(loan.dueAt)} — {dueLabel(loan.dueAt)}
                      </p>
                      <div className="row" style={{ marginTop: 'var(--space-3)', gap: 'var(--space-2)' }}>
                        <button
                          type="button"
                          className="btn btn--secondary btn--sm"
                          disabled={busyId === loan.id || loan.renewals >= loan.maxRenewals}
                          onClick={() => void dispatch(renewWithSync(loan.id))}
                        >
                          {loan.renewals >= loan.maxRenewals
                            ? 'Renewal limit reached'
                            : `Renew (${loan.maxRenewals - loan.renewals} left)`}
                        </button>
                        <button
                          type="button"
                          className="btn btn--ghost btn--sm"
                          disabled={busyId === loan.id}
                          onClick={() => {
                            dispatch(setBusy(loan.id))
                            void dispatch(returnLoan(loan.id))
                          }}
                        >
                          Mark returned
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )
          ) : null}

          {tab === 'history' ? (
            history.length === 0 ? (
              <div className="card">
                <EmptyState title="No borrowing history yet" body="Returned items are listed here." />
              </div>
            ) : (
              <ul className="stack stack--tight">
                {history.map((loan) => (
                  <li key={loan.id} className="card">
                    <p className="resource__title">{cache[loan.resourceId]?.title ?? 'Item'}</p>
                    <p className="small muted">
                      Borrowed {formatDate(loan.checkedOutAt)} · returned{' '}
                      {loan.returnedAt ? formatDate(loan.returnedAt) : '—'}
                    </p>
                  </li>
                ))}
              </ul>
            )
          ) : null}

          {tab === 'saved' ? (
            savedResources.length === 0 ? (
              <div className="card">
                <EmptyState
                  title="Nothing saved"
                  body="Tap the bookmark on any record to keep it here for later — saved records stay readable offline."
                />
              </div>
            ) : (
              <ul className="stack stack--tight">
                {savedResources.map((resource) => (
                  <li key={resource.id}>
                    <ResourceCard resource={resource} />
                  </li>
                ))}
              </ul>
            )
          ) : null}

          {tab === 'activity' ? (
            xp.activities.length === 0 ? (
              <div className="card">
                <EmptyState
                  icon={<StarIcon size={28} />}
                  title="No XP yet"
                  body="Open a resource or borrow a book to start earning."
                />
              </div>
            ) : (
              <ul className="card card--flush list">
                {xp.activities.slice(0, 40).map((activity) => (
                  <li key={activity.id} className="listitem">
                    <span className="listitem__icon listitem__icon--xp" aria-hidden="true">
                      <StarIcon size={18} />
                    </span>
                    <span style={{ minWidth: 0, flex: 1 }}>
                      <span className="resource__title">{ACTIVITY_LABELS[activity.kind]}</span>
                      <span className="resource__meta">
                        {activity.resourceTitle ?? 'REACH'} · {relativeTime(activity.at)}
                        {activity.pending ? ' · pending sync' : ''}
                      </span>
                    </span>
                    <span className={activity.xp > 0 ? 'tag tag--award' : 'tag'}>
                      {activity.xp > 0 ? `+${activity.xp}` : '0'} XP
                    </span>
                  </li>
                ))}
              </ul>
            )
          ) : null}
        </div>
      </section>
    </div>
  )
}
