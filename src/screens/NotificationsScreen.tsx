import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { clearAll, markAllRead, markRead } from '@/features/notifications/notificationsSlice'
import { EmptyState, Chip } from '@/components/primitives'
import { BellIcon, BookIcon, CheckIcon, ClockIcon, StarIcon } from '@/components/icons'
import { NOTIFICATION_ICON_CLASS } from '@/utils/labels'
import { relativeTime } from '@/utils/date'
import type { NotificationKind } from '@/types'

const FILTERS: { id: 'all' | NotificationKind; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'due_soon', label: 'Due dates' },
  { id: 'xp_milestone', label: 'XP' },
  { id: 'new_resource', label: 'New resources' },
  { id: 'announcement', label: 'Library' },
]

function iconFor(kind: NotificationKind) {
  if (kind === 'xp_milestone') return <StarIcon size={18} />
  if (kind === 'due_soon' || kind === 'overdue') return <ClockIcon size={18} />
  if (kind === 'new_resource' || kind === 'hold_ready') return <BookIcon size={18} />
  if (kind === 'return_confirmed') return <CheckIcon size={18} />
  return <BellIcon size={18} />
}

export function NotificationsScreen() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const items = useAppSelector((state) => state.notifications.items)
  const [filter, setFilter] = useState<'all' | NotificationKind>('all')

  const visible = useMemo(() => {
    if (filter === 'all') return items
    if (filter === 'due_soon') return items.filter((n) => n.kind === 'due_soon' || n.kind === 'overdue')
    return items.filter((n) => n.kind === filter)
  }, [items, filter])

  const unread = items.filter((n) => !n.read).length

  return (
    <div className="stack" style={{ gap: 'var(--space-4)' }}>
      <div className="row row--between">
        <p className="small muted">
          {unread > 0 ? `${unread} unread` : 'All caught up'}
        </p>
        <div className="row" style={{ gap: 'var(--space-2)' }}>
          {unread > 0 ? (
            <button type="button" className="section__link" onClick={() => dispatch(markAllRead())}>
              Mark all read
            </button>
          ) : null}
          {items.length > 0 ? (
            <button type="button" className="section__link" onClick={() => dispatch(clearAll())}>
              Clear
            </button>
          ) : null}
        </div>
      </div>

      <div className="wrap">
        {FILTERS.map(({ id, label }) => (
          <Chip key={id} pressed={filter === id} onClick={() => setFilter(id)}>
            {label}
          </Chip>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<BellIcon size={28} />}
            title="No notifications"
            body="Due-date reminders, new resources in your subject areas and XP milestones will appear here."
          />
        </div>
      ) : (
        <ul className="card card--flush list">
          {visible.map((notification) => (
            <li key={notification.id}>
              <button
                type="button"
                className={notification.read ? 'listitem' : 'listitem listitem--unread'}
                style={{ width: '100%', border: 0, cursor: 'pointer' }}
                onClick={() => {
                  dispatch(markRead(notification.id))
                  if (notification.link) navigate(notification.link)
                }}
              >
                <span
                  className={`listitem__icon ${NOTIFICATION_ICON_CLASS[notification.kind]}`}
                  aria-hidden="true"
                >
                  {iconFor(notification.kind)}
                </span>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span className="row row--between" style={{ gap: 'var(--space-2)' }}>
                    <span style={{ fontWeight: 650, fontSize: '0.92rem' }}>{notification.title}</span>
                    <span className="small muted" style={{ flex: 'none' }}>
                      {relativeTime(notification.at)}
                    </span>
                  </span>
                  <span className="small muted" style={{ display: 'block', marginTop: 2 }}>
                    {notification.body}
                  </span>
                  {!notification.read ? <span className="visually-hidden">Unread</span> : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
