import type { NotificationKind, UserRole } from '@/types'

export const ROLE_LABELS: Record<UserRole, string> = {
  undergraduate: 'Undergraduate',
  postgraduate: 'Postgraduate',
  faculty: 'Faculty',
  staff: 'Library staff',
  visiting: 'Visiting scholar',
}

export const NOTIFICATION_ICON_CLASS: Record<NotificationKind, string> = {
  due_soon: 'listitem__icon--due',
  overdue: 'listitem__icon--overdue',
  hold_ready: 'listitem__icon--info',
  new_resource: 'listitem__icon--info',
  xp_milestone: 'listitem__icon--xp',
  announcement: '',
  return_confirmed: 'listitem__icon--xp',
}
