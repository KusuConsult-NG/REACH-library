import { Link } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { toggleFollow } from '@/features/social/socialSlice'
import { EmptyState } from '@/components/primitives'
import { CommunityIcon, TrendIcon } from '@/components/icons'
import { ROLE_LABELS } from '@/utils/labels'
import { relativeTime } from '@/utils/date'

/**
 * Community keeps the social surface deliberately thin (PRD §3.5): trending
 * lists, an anonymous activity feed, and following. Nothing here attributes a
 * specific read to a named person.
 */
export function CommunityScreen() {
  const dispatch = useAppDispatch()
  const trending = useAppSelector((state) => state.catalogue.trending)
  const { following, suggestions, feed } = useAppSelector((state) => state.social)
  const shareActivity = useAppSelector((state) => state.auth.privacy.shareActivity)
  const department = useAppSelector((state) => state.auth.user?.department)

  return (
    <div className="stack" style={{ gap: 'var(--space-5)' }}>
      <section aria-labelledby="trending-heading">
        <div className="section__head">
          <h2 id="trending-heading">Trending {department ? `near ${department}` : 'this week'}</h2>
        </div>
        <div className="card">
          {trending.length === 0 ? (
            <EmptyState icon={<TrendIcon size={28} />} title="Nothing trending yet" />
          ) : (
            <ul>
              {trending.map((entry, index) => (
                <li key={entry.resourceId}>
                  <Link className="rank" to={`/resource/${entry.resourceId}`}>
                    <span className="rank__num">{index + 1}</span>
                    <span style={{ minWidth: 0, flex: 1 }}>
                      <span className="resource__title">{entry.title}</span>
                      <span className="resource__meta">
                        {entry.department} · {entry.accessCount.toLocaleString()} uses
                      </span>
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

      <section aria-labelledby="feed-heading">
        <div className="section__head">
          <h2 id="feed-heading">Around the library</h2>
        </div>
        <p className="small muted" style={{ marginBottom: 'var(--space-3)' }}>
          Activity is shown by cohort only — never by name.
          {shareActivity ? '' : ' Your own activity is not being shared.'}{' '}
          <Link to="/settings">Change in settings</Link>
        </p>
        <ul className="card card--flush list">
          {feed.map((item) => (
            <li key={item.id}>
              <Link className="listitem" to={`/resource/${item.resourceId}`}>
                <span className="listitem__icon" aria-hidden="true">
                  <CommunityIcon size={18} />
                </span>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ fontSize: '0.92rem' }}>
                    {item.cohort} {item.action} <strong>{item.resourceTitle}</strong>
                  </span>
                  <span className="resource__meta">{relativeTime(item.at)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="follow-heading">
        <div className="section__head">
          <h2 id="follow-heading">People to follow</h2>
        </div>
        <ul className="card card--flush list">
          {suggestions.map((person) => {
            const isFollowing = following.includes(person.id)
            return (
              <li key={person.id} className="listitem">
                <span className="avatar" aria-hidden="true">
                  {person.avatarInitials}
                </span>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ fontWeight: 650, fontSize: '0.92rem', display: 'block' }}>{person.name}</span>
                  <span className="resource__meta">
                    {ROLE_LABELS[person.role]} · {person.department} · Level {person.level}
                  </span>
                </span>
                <button
                  type="button"
                  className={isFollowing ? 'btn btn--ghost btn--sm' : 'btn btn--secondary btn--sm'}
                  aria-pressed={isFollowing}
                  onClick={() => dispatch(toggleFollow(person.id))}
                >
                  {isFollowing ? 'Following' : 'Follow'}
                </button>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
