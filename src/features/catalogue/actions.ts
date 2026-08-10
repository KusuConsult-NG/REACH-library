import type { AppDispatch, RootState } from '@/app/store'
import { checkoutResource, placeHold, renewLoan, setBusy, applyOfflineRenewal } from '@/features/circulation/circulationSlice'
import { push } from '@/features/notifications/notificationsSlice'
import { enqueue, toast } from '@/features/ui/uiSlice'
import { recordEngagement } from '@/features/xp/engagement'
import { api } from '@/services/api'
import type { Resource } from '@/types'
import { citationFor, fileNameFor, recordTextFor, risFor } from '@/utils/citation'
import { formatDate } from '@/utils/date'
import { applyResourceUpdate } from './catalogueSlice'

/**
 * True when the record points at a file the app can genuinely hand over.
 *
 * REACH-hosted repository paths (`/repository/...`) are served by the
 * institutional repository in a real deployment and are not bundled into this
 * build, so promising a download for one would open a dead link.
 */
function hasRetrievableFile(resource: Resource): boolean {
  return Boolean(resource.url && /^https?:/i.test(resource.url))
}

function proxied(url: string): string {
  const proxyBase = import.meta.env.VITE_PROXY_BASE as string | undefined
  return proxyBase && /^https?:/i.test(url) ? `${proxyBase}${encodeURIComponent(url)}` : url
}

/** Push a generated file at the browser and clean up after it. */
function saveFile(name: string, contents: string, mime: string) {
  const url = URL.createObjectURL(new Blob([contents], { type: `${mime};charset=utf-8` }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  // Revoking immediately can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

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
    if (!hasRetrievableFile(resource)) {
      // A repository path with no repository behind it: say so rather than
      // opening a blank tab and calling it access.
      dispatch(
        toast(
          'The full text is held in the University of Jos repository, which is not connected to this build.',
          'info',
        ),
      )
      return
    }

    window.open(proxied(resource.url), '_blank', 'noopener,noreferrer')

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
/**
 * Download the full text where the library can actually supply it.
 *
 * This used to award the XP and do nothing at all — the button reported a
 * download that never happened. It now either hands over the file or says why
 * it cannot, and the XP follows the file rather than the tap.
 */
export function downloadResource(resource: Resource) {
  return (dispatch: AppDispatch) => {
    if (!hasRetrievableFile(resource)) {
      dispatch(
        toast(
          'No downloadable file for this record. You can still save the catalogue record.',
          'info',
        ),
      )
      return
    }

    window.open(proxied(resource.url!), '_blank', 'noopener,noreferrer')
    dispatch(
      recordEngagement({
        kind: 'resource_download',
        resourceId: resource.id,
        resourceTitle: resource.title,
      }),
    )
  }
}

/**
 * Save the catalogue record itself.
 *
 * Always available, works offline, and earns nothing — it is generated from
 * data already on the device, so paying XP for it would reward tapping rather
 * than reading.
 */
export function downloadRecord(resource: Resource, format: 'ris' | 'txt') {
  return (dispatch: AppDispatch) => {
    if (format === 'ris') {
      saveFile(fileNameFor(resource, 'ris'), risFor(resource), 'application/x-research-info-systems')
      dispatch(toast('Citation file saved — import it into Zotero, Mendeley or EndNote.', 'success'))
      return
    }
    saveFile(fileNameFor(resource, 'txt'), recordTextFor(resource), 'text/plain')
    dispatch(toast('Record saved as text.', 'success'))
  }
}

/** Put the reference on the clipboard, with a fallback for insecure contexts. */
export function copyCitation(resource: Resource) {
  return async (dispatch: AppDispatch) => {
    const reference = citationFor(resource)
    try {
      await navigator.clipboard.writeText(reference)
      dispatch(toast('Citation copied.', 'success'))
    } catch {
      // execCommand is deprecated but is the only route without a secure
      // context, which a campus http:// deployment may well be.
      const field = document.createElement('textarea')
      field.value = reference
      field.setAttribute('readonly', '')
      field.style.position = 'fixed'
      field.style.opacity = '0'
      document.body.appendChild(field)
      field.select()
      const copied = document.execCommand?.('copy')
      field.remove()
      dispatch(
        copied
          ? toast('Citation copied.', 'success')
          : toast('Could not copy automatically — select the citation and copy it.', 'error'),
      )
    }
  }
}

/**
 * Re-read one record from the backend and push it everywhere it is shown.
 *
 * Borrowing the last copy changes what every other member should see. Without
 * this the cached record still advertises a copy on the shelf, and the next
 * person taps Borrow and is refused by the server — the shelf count has to
 * follow the transaction that changed it.
 */
export function refreshResource(resourceId: string) {
  return async (dispatch: AppDispatch) => {
    try {
      const fresh = await api.getResource(resourceId)
      if (fresh) dispatch(applyResourceUpdate([fresh]))
    } catch {
      // A stale count is better than a blank screen; the next load corrects it.
    }
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
