import type { AppDispatch, RootState } from '@/app/store'
import { checkoutResource, placeHold, renewLoan, setBusy, applyOfflineRenewal } from '@/features/circulation/circulationSlice'
import { push } from '@/features/notifications/notificationsSlice'
import { enqueue, toast } from '@/features/ui/uiSlice'
import { recordEngagement } from '@/features/xp/engagement'
import type { Resource } from '@/types'
import { formatDate } from '@/utils/date'

/**
 * Open an electronic resource.
 *
 * Off-campus access goes through the library proxy, so the outbound link is
 * rewritten unless the resource is openly accessible. The window is opened
 * synchronously from the user gesture — deferring it past an await would get
 * the popup blocked.
 */
export function openEresource(resource: Resource) {
  return (dispatch: AppDispatch) => {
    if (!resource.url) {
      dispatch(toast('No online copy is available for this record.', 'error'))
      return
    }
    const proxyBase = import.meta.env.VITE_PROXY_BASE as string | undefined
    const isExternal = /^https?:/i.test(resource.url)
    const target = proxyBase && isExternal ? `${proxyBase}${encodeURIComponent(resource.url)}` : resource.url

    if (isExternal || !proxyBase) {
      window.open(target, '_blank', 'noopener,noreferrer')
    }

    dispatch(
      recordEngagement({
        kind: 'eresource_access',
        resourceId: resource.id,
        resourceTitle: resource.title,
      }),
    )
  }
}

/** Record a download. The file transfer itself is handled by the resource host. */
export function downloadResource(resource: Resource) {
  return (dispatch: AppDispatch) => {
    dispatch(
      recordEngagement({
        kind: 'resource_download',
        resourceId: resource.id,
        resourceTitle: resource.title,
      }),
    )
  }
}

/** OPAC browsing is silent — it should not interrupt with a toast on every record. */
export function recordBrowse(resource: Resource) {
  return recordEngagement({
    kind: 'opac_browse',
    resourceId: resource.id,
    resourceTitle: resource.title,
    silent: true,
  })
}

export function borrowResource(resource: Resource) {
  return async (dispatch: AppDispatch, getState: () => RootState) => {
    if (!getState().ui.online) {
      dispatch(toast('Borrowing needs a connection — the item must be issued at the desk.', 'error'))
      return
    }
    dispatch(setBusy(resource.id))
    const action = await dispatch(checkoutResource(resource.id))
    if (checkoutResource.fulfilled.match(action)) {
      const loan = action.payload
      dispatch(
        recordEngagement({
          kind: 'physical_borrow',
          resourceId: resource.id,
          resourceTitle: resource.title,
        }),
      )
      dispatch(
        push({
          kind: 'announcement',
          title: 'Item issued',
          body: `${resource.title} is due back on ${formatDate(loan.dueAt)}.`,
          link: '/profile',
        }),
      )
    } else {
      dispatch(toast(action.payload ?? 'The item could not be issued.', 'error'))
    }
  }
}

export function reserveResource(resource: Resource) {
  return async (dispatch: AppDispatch, getState: () => RootState) => {
    if (!getState().ui.online) {
      dispatch(enqueue({ kind: 'hold', resourceId: resource.id }))
      dispatch(toast('Offline — your reservation will be placed when you reconnect.', 'info'))
      return
    }
    dispatch(setBusy(resource.id))
    const action = await dispatch(placeHold(resource.id))
    if (placeHold.fulfilled.match(action)) {
      dispatch(
        recordEngagement({
          kind: 'reservation',
          resourceId: resource.id,
          resourceTitle: resource.title,
        }),
      )
      dispatch(
        push({
          kind: 'announcement',
          title: 'Hold placed',
          body: `You are number ${action.payload.queuePosition} in the queue for ${resource.title}.`,
          link: '/profile',
        }),
      )
    } else {
      dispatch(toast(action.payload ?? 'The hold could not be placed.', 'error'))
    }
  }
}

/**
 * Renew a loan. Renewals are safe to replay, so when offline the new due date is
 * applied locally and the operation is queued for the next sync.
 */
export function renewWithSync(loanId: string) {
  return async (dispatch: AppDispatch, getState: () => RootState) => {
    const state = getState()
    const loan = state.circulation.loans.find((l) => l.id === loanId)
    if (!loan) return

    if (loan.renewals >= loan.maxRenewals) {
      dispatch(toast('This item has reached its renewal limit — please return it to the desk.', 'error'))
      return
    }

    if (!state.ui.online) {
      const dueAt = new Date(Date.now() + 14 * 86_400_000).toISOString()
      dispatch(applyOfflineRenewal({ loanId, dueAt }))
      dispatch(enqueue({ kind: 'renew', loanId }))
      dispatch(toast('Offline — renewal saved and will sync when you reconnect.', 'info'))
      return
    }

    dispatch(setBusy(loanId))
    const action = await dispatch(renewLoan(loanId))
    if (renewLoan.fulfilled.match(action)) {
      dispatch(toast(`Renewed — now due ${formatDate(action.payload.dueAt)}.`, 'success'))
    } else {
      dispatch(toast(action.payload ?? 'The renewal could not be completed.', 'error'))
    }
  }
}
