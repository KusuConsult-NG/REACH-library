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
/** Bounds one member's inbox so an uncollected pile cannot grow without end. */
export const MAX_INBOX = 100

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

    const inbox = (state.inbox[recipient.id] ??= [])
    // Refuse rather than trim. Dropping the oldest to make room would destroy
    // XP that a member had already been told was sent.
    if (inbox.length >= MAX_INBOX) {
      throw HttpError.conflict(
        'That member has too much uncollected XP waiting. Ask them to open REACH, then try again.',
      )
    }

    state.sentByWeek[key] = alreadySent + whole
    inbox.push({
      id: transferId,
      fromName: sender.name,
      fromId: sender.borrowerNumber,
      amount: whole,
      note: note?.slice(0, 80),
      at,
    })
    return { transferId, recipient, amount: whole, at }
  })
}

/**
 * What is waiting for this member. Reading does not consume it.
 *
 * Delivery is at-least-once: the recipient's device applies the credit, makes it
 * durable, and only then acknowledges. Clearing on read would be at-most-once,
 * and a tab closed in the wrong half-second would destroy the XP with no copy
 * left anywhere.
 */
export function listIncoming(store: Store, user: User): IncomingTransfer[] {
  return store.data.inbox[user.borrowerNumber] ?? []
}

/** Drop the transfers a recipient has confirmed they have credited. */
export async function acknowledge(store: Store, user: User, ids: string[]): Promise<void> {
  const done = new Set(ids)
  const waiting = store.data.inbox[user.borrowerNumber] ?? []
  if (!waiting.some((transfer) => done.has(transfer.id))) return

  await store.update((state) => {
    const inbox = state.inbox[user.borrowerNumber] ?? []
    state.inbox[user.borrowerNumber] = inbox.filter((transfer) => !done.has(transfer.id))
  })
}
