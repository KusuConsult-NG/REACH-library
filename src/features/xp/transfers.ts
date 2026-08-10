import { flushPersistence, type AppDispatch, type RootState } from '@/app/store'
import { MIN_TRANSFER, WEEKLY_TRANSFER_LIMIT } from '@/config/transfers'
import { push } from '@/features/notifications/notificationsSlice'
import { toast } from '@/features/ui/uiSlice'
import { api, ApiError, type TransferTarget } from '@/services/api'
import { debug } from '@/services/debug'
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

    debug('transfer', 'send requested', {
      identifier,
      amount: whole,
      balance: state.xp.balance,
      sentThisWeek: sentThisWeek(state.xp),
      remainingByClient: remaining,
    })

    try {
      const result = await api.sendXp(identifier, whole, note)
      debug('transfer', 'send confirmed', { transferId: result.transferId, to: result.recipient.id })
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
      // The server's reason is the one that counts: a client-side allowance that
      // disagrees with it is the bug, and this line is where you see the gap.
      debug('transfer', 'send rejected', {
        code: error instanceof ApiError ? error.code : 'unknown',
        message: (error as Error)?.message,
      })
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
 * Delivery is at-least-once and application is idempotent, which is the only
 * combination that is safe here. Reading the inbox does not consume it; the
 * credit is applied, persisted, and only then acknowledged. A crash anywhere in
 * that sequence redelivers, and `recordTransfer` ignores an id it has already
 * seen — so the failure mode is a repeated read, never lost XP.
 */
export function claimIncomingXp() {
  return async (dispatch: AppDispatch, getState: () => RootState) => {
    let incoming
    try {
      incoming = await api.listIncomingXp()
    } catch {
      return
    }
    if (!incoming.length) return

    const before = new Set(getState().xp.transfers.map((transfer) => transfer.id))
    debug('transfer', 'inbox read', {
      waiting: incoming.map((transfer) => transfer.id),
      alreadyCredited: incoming.filter((transfer) => before.has(transfer.id)).map((t) => t.id),
      balanceBefore: getState().xp.balance,
    })
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

    // Acknowledge only what is now in the store, and only after the write is on
    // disk — an ack for XP that was never persisted is XP thrown away.
    flushPersistence()
    debug('transfer', 'acknowledging', {
      ids: incoming.map((transfer) => transfer.id),
      balanceAfter: getState().xp.balance,
    })
    await api.acknowledgeXp(incoming.map((transfer) => transfer.id)).catch((error) => {
      // Unacknowledged is safe — it redelivers. Silence here would make a
      // repeatedly-redelivered transfer look like a duplicate-credit bug.
      debug('transfer', 'acknowledge failed, will redeliver', { message: (error as Error)?.message })
    })

    // Announce only what was genuinely new, so a redelivery is silent.
    const fresh = incoming.filter((transfer) => !before.has(transfer.id))
    if (!fresh.length) return
    incoming = fresh

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
