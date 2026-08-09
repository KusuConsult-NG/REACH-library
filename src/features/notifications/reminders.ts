import type { AppDispatch, RootState } from '@/app/store'
import { ANNOUNCEMENTS, RESOURCES } from '@/services/api/seed'
import { daysUntil, dayKey } from '@/utils/date'
import { push } from './notificationsSlice'

/**
 * Derive the notifications the PRD calls for from current state.
 *
 * Everything is keyed for de-duplication, so running this on every launch (and
 * after each circulation refresh) never produces repeats. In production the
 * same reminders are also delivered as push messages by the backend via FCM;
 * this pass is what keeps the in-app centre correct offline.
 */
export function refreshReminders() {
  return (dispatch: AppDispatch, getState: () => RootState) => {
    const state = getState()
    const prefs = state.auth.notifications
    const today = dayKey()

    if (prefs.dueDateReminders) {
      for (const loan of state.circulation.loans) {
        if (loan.status === 'returned') continue
        const resource = state.catalogue.cache[loan.resourceId]
        const title = resource?.title ?? 'A borrowed item'
        const days = daysUntil(loan.dueAt)

        if (days < 0) {
          dispatch(
            push({
              kind: 'overdue',
              title: 'Item overdue',
              body: `${title} was due ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago. Fines accrue daily until it is returned.`,
              link: '/profile',
              dedupeKey: `overdue:${loan.id}:${today}`,
            }),
          )
        } else if (days <= 3) {
          dispatch(
            push({
              kind: 'due_soon',
              title: days === 0 ? 'Due today' : `Due in ${days} day${days === 1 ? '' : 's'}`,
              body: `${title} — renew it in REACH if you need longer.`,
              link: '/profile',
              dedupeKey: `due:${loan.id}:${days}`,
            }),
          )
        }
      }

      for (const loan of state.circulation.loans) {
        if (loan.status === 'returned' && loan.returnedAt && prefs.returnConfirmations) {
          const resource = state.catalogue.cache[loan.resourceId]
          dispatch(
            push({
              kind: 'return_confirmed',
              title: 'Return confirmed',
              body: `${resource?.title ?? 'Your item'} is back on the shelf. Thank you.`,
              at: loan.returnedAt,
              dedupeKey: `returned:${loan.id}`,
            }),
          )
        }
      }
    }

    for (const hold of state.circulation.holds) {
      if (hold.status === 'ready') {
        const resource = state.catalogue.cache[hold.resourceId]
        dispatch(
          push({
            kind: 'hold_ready',
            title: 'Reserved item ready for collection',
            body: `${resource?.title ?? 'Your reserved item'} is waiting at the circulation desk.`,
            link: `/resource/${hold.resourceId}`,
            dedupeKey: `hold-ready:${hold.id}`,
          }),
        )
      }
    }

    if (prefs.newResourceAlerts && prefs.interests.length) {
      const matches = RESOURCES.filter(
        (r) => r.year >= new Date().getFullYear() - 1 && r.subjects.some((s) => prefs.interests.includes(s)),
      ).slice(0, 3)

      for (const resource of matches) {
        dispatch(
          push({
            kind: 'new_resource',
            title: `New in ${resource.subjects[0]}`,
            body: resource.title,
            link: `/resource/${resource.id}`,
            dedupeKey: `new:${resource.id}`,
          }),
        )
      }
    }

    if (prefs.libraryAnnouncements) {
      for (const announcement of ANNOUNCEMENTS) {
        dispatch(
          push({
            kind: 'announcement',
            title: announcement.title,
            body: announcement.body,
            dedupeKey: `announce:${announcement.title}`,
          }),
        )
      }
    }
  }
}
