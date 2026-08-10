import type { AppDispatch, RootState } from '@/app/store'
import { MIN_TRANSFER, WEEKLY_TRANSFER_LIMIT } from '@/config/transfers'
import { push } from '@/features/notifications/notificationsSlice'
import { toast } from '@/features/ui/uiSlice'
import { api, ApiError, type TransferTarget } from '@/services/api'
import { recordTransfer, sentThisWeek } from './xpSlice'

/**
 * Send spendable XP to another member.
 *
 * Only the wallet moves. Lifetime XP stays with whoever earned it, so a
 * transfer can never invent library engagement that did not happen — which is
 * what keeps levels and the §6 reporting meaningful.
 *
 * The balance is debited only after the backend confirms, because the backend
 * owns the weekly ceiling and the recipient's inbox.
 */
export function sendXp(identifier: string, amount: number, note?: string) {
  return async (dispatch: AppDispatch, getState: () => RootState) => {
    const state = getState()
    const whole = Math.floor(amount)

    if (!Number.isFinite(whole) || whole < MIN_TRANSFER) {
      dispatch(toast(`The smallest transfer is ${MIN_TRANSFER} XP.`, 'error'))
      return false
    }
    if (whole > state.xp.balance) {
      dispatch(toast('That is more than you have available to spend.', 'error'))
      return false
    }

    const remaining = WEEKLY_TRANSFER_LIMIT - sentThisWeek(state.xp)
    if (whole > remaining) {
      dispatch(
        toast(
          remaining > 0
            ? `You can send ${remaining.toLocaleString()} more XP this week.`
            : 'You have reached your weekly transfer limit.',
          'error',
        ),
      )
      return false
    }

    try {
      const result = await api.sendXp(identifier, whole, note)
      dispatch(
        recordTransfer({
          id: result.transferId,
          direction: 'sent',
          counterpartyName: result.recipient.name,
          counterpartyId: result.recipient.id,
          amount: result.amount,
          note,
          at: result.at,
        }),
      )
      dispatch(toast(`${result.amount.toLocaleString()} XP sent to ${result.recipient.name}.`, 'success'))
      return true
    } catch (error) {
      dispatch(
        toast(error instanceof ApiError ? error.message : 'The transfer could not be completed.', 'error'),
      )
      return false
    }
  }
}

/** Confirm a recipient before any XP moves, so nobody types a digit wrong. */
export async function findMember(identifier: string): Promise<TransferTarget | undefined> {
  try {
    return await api.lookupMember(identifier)
  } catch {
    return undefined
  }
}

/**
 * Collect XP other members have sent, and credit it.
 *
 * Claiming clears the inbox server-side, so a reload cannot credit the same
 * transfer twice.
 */
export function claimIncomingXp() {
  return async (dispatch: AppDispatch) => {
    let incoming
    try {
      incoming = await api.claimIncomingXp()
    } catch {
      return
    }
    if (!incoming.length) return

    for (const transfer of incoming) {
      dispatch(
        recordTransfer({
          id: transfer.id,
          direction: 'received',
          counterpartyName: transfer.fromName,
          counterpartyId: transfer.fromId,
          amount: transfer.amount,
          note: transfer.note,
          at: transfer.at,
        }),
      )
    }

    const total = incoming.reduce((sum, transfer) => sum + transfer.amount, 0)
    dispatch(toast(`${total.toLocaleString()} XP received.`, 'xp', total))
    dispatch(
      push({
        kind: 'xp_milestone',
        title: `You received ${total.toLocaleString()} XP`,
        body:
          incoming.length === 1
            ? `${incoming[0].fromName} sent you ${incoming[0].amount.toLocaleString()} XP.`
            : `From ${incoming.map((t) => t.fromName).join(', ')}.`,
        link: '/rewards',
      }),
    )
  }
}
