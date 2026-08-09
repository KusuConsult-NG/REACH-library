import type { AppDispatch, RootState } from '@/app/store'
import { api } from '@/services/api'
import { loadCirculation } from '@/features/circulation/circulationSlice'
import { dequeue, setSyncing, toast } from '@/features/ui/uiSlice'

/**
 * Replay everything captured while offline, oldest first.
 *
 * Operations are removed from the queue only when the server accepts them (or
 * rejects them for a reason that a retry cannot fix, such as a renewal limit),
 * so a dropped connection mid-flush leaves the remainder queued.
 */
export function flushQueue() {
  return async (dispatch: AppDispatch, getState: () => RootState) => {
    const { queue, syncing, online } = getState().ui
    if (syncing || !online || queue.length === 0) return

    dispatch(setSyncing(true))
    let succeeded = 0
    let failed = 0

    for (const op of [...queue].sort((a, b) => a.at.localeCompare(b.at))) {
      try {
        if (op.kind === 'renew') await api.renew(op.loanId)
        else if (op.kind === 'return') await api.returnLoan(op.loanId)
        else if (op.kind === 'hold') await api.placeHold(op.resourceId)
        dispatch(dequeue(op.id))
        succeeded += 1
      } catch (error) {
        const code = (error as { code?: string }).code
        if (code === 'offline' || code === 'server_error') {
          // Transient — leave it queued and stop; the next reconnect retries.
          break
        }
        // Permanent rejection: drop it so the queue cannot wedge.
        dispatch(dequeue(op.id))
        failed += 1
      }
    }

    dispatch(setSyncing(false))

    if (succeeded > 0) {
      await dispatch(loadCirculation())
      dispatch(
        toast(
          `${succeeded} offline action${succeeded === 1 ? '' : 's'} synced${failed ? `, ${failed} could not be applied` : ''}.`,
          failed ? 'info' : 'success',
        ),
      )
    } else if (failed > 0) {
      dispatch(toast('Some offline actions could not be applied. Check your loans.', 'error'))
    }
  }
}
