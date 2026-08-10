import { randomUUID } from 'node:crypto'
import { HttpError } from './errors.js'
import type { MemberRef } from './directory.js'
import type { Store } from './store.js'
import type { User } from './types.js'
import { weekKey } from './xp.js'

/**
 * Member-to-member XP transfers.
 *
 * Only the *spendable* balance moves. Lifetime XP — what levels and the
 * library's engagement reporting are built on — stays in the activity ledger
 * with whoever earned it, so a transfer can never manufacture engagement that
 * did not happen.
 *
 * The ceilings live here rather than in the browser because a limit a client
 * enforces is not a limit. Keep these in step with `src/config/transfers.ts`.
 */

export const MIN_TRANSFER = 50
export const WEEKLY_TRANSFER_LIMIT = 1000
/** Bounds one member's inbox so an unclaimed pile cannot grow without end. */
const MAX_INBOX = 100

export interface IncomingTransfer {
  id: string
  fromName: string
  fromId: string
  amount: number
  note?: string
  at: string
}

export interface TransferResult {
  transferId: string
  recipient: MemberRef
  amount: number
  at: string
}

export async function sendXp(
  store: Store,
  sender: User,
  recipient: MemberRef,
  amount: number,
  note?: string,
): Promise<TransferResult> {
  if (!Number.isFinite(amount) || amount < MIN_TRANSFER) {
    throw HttpError.badRequest(`The smallest transfer is ${MIN_TRANSFER} XP.`)
  }
  if (recipient.id === sender.borrowerNumber) {
    throw HttpError.conflict('That is your own account.')
  }

  const whole = Math.floor(amount)
  const key = `${sender.borrowerNumber}:${weekKey()}`
  const at = new Date().toISOString()
  const transferId = randomUUID()

  return store.update((state) => {
    const alreadySent = state.sentByWeek[key] ?? 0
    if (alreadySent + whole > WEEKLY_TRANSFER_LIMIT) {
      throw HttpError.conflict(
        `That would pass your weekly limit of ${WEEKLY_TRANSFER_LIMIT} XP. You have ${
          WEEKLY_TRANSFER_LIMIT - alreadySent
        } XP left to send this week.`,
      )
    }

    state.sentByWeek[key] = alreadySent + whole
    const inbox = (state.inbox[recipient.id] ??= [])
    inbox.push({
      id: transferId,
      fromName: sender.name,
      fromId: sender.borrowerNumber,
      amount: whole,
      note: note?.slice(0, 80),
      at,
    })
    if (inbox.length > MAX_INBOX) inbox.splice(0, inbox.length - MAX_INBOX)

    return { transferId, recipient, amount: whole, at }
  })
}

/**
 * Hand over everything waiting for this member and clear it.
 *
 * Clearing on collection is what stops a reload from crediting the same
 * transfer twice — the recipient's device applies each one exactly once.
 */
export async function claimIncoming(store: Store, user: User): Promise<IncomingTransfer[]> {
  const waiting = store.data.inbox[user.borrowerNumber] ?? []
  if (waiting.length === 0) return []

  return store.update((state) => {
    const claimed = state.inbox[user.borrowerNumber] ?? []
    state.inbox[user.borrowerNumber] = []
    return claimed
  })
}
