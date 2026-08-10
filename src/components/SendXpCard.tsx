import { useState, type FormEvent } from 'react'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { MIN_TRANSFER, WEEKLY_TRANSFER_LIMIT } from '@/config/transfers'
import { findMember, sendXp } from '@/features/xp/transfers'
import { sentThisWeek } from '@/features/xp/xpSlice'
import { Spinner } from './primitives'
import type { TransferTarget } from '@/services/api'

/**
 * Send XP to another member.
 *
 * Two steps on purpose: the recipient is resolved and shown by name before any
 * amount is confirmed, because a mistyped matriculation number would otherwise
 * send credit to a stranger with no way back.
 */
export function SendXpCard() {
  const dispatch = useAppDispatch()
  const xp = useAppSelector((state) => state.xp)

  const [identifier, setIdentifier] = useState('')
  const [amount, setAmount] = useState(String(MIN_TRANSFER))
  const [note, setNote] = useState('')
  const [recipient, setRecipient] = useState<TransferTarget | null>(null)
  const [checking, setChecking] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const remaining = Math.max(0, WEEKLY_TRANSFER_LIMIT - sentThisWeek(xp))
  const ceiling = Math.min(xp.balance, remaining)
  /**
   * Below the minimum there is no valid amount to type, and a number field
   * whose max is under its min silently rejects every keystroke. Say so instead.
   */
  const blocked =
    xp.balance < MIN_TRANSFER
      ? `You need at least ${MIN_TRANSFER} XP to send any. You have ${xp.balance.toLocaleString()}.`
      : remaining < MIN_TRANSFER
        ? 'You have reached your transfer limit for this week. It resets on Monday.'
        : null

  async function check(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setChecking(true)
    const found = await findMember(identifier)
    setChecking(false)

    if (!found) {
      setError('No member matches that number. Check it and try again.')
      setRecipient(null)
      return
    }
    setRecipient(found)
  }

  async function confirm() {
    if (!recipient) return
    setSending(true)
    const ok = await dispatch(sendXp(identifier, Number(amount), note.trim() || undefined))
    setSending(false)
    if (ok) {
      setRecipient(null)
      setIdentifier('')
      setNote('')
      setAmount(String(MIN_TRANSFER))
    }
  }

  return (
    <section className="card stack" aria-labelledby="send-heading">
      <div>
        <h2 id="send-heading">Send XP to another member</h2>
        <p className="small muted" style={{ marginTop: 4 }}>
          Sends from your spendable balance. Your total XP and level are unaffected — those stay with
          whoever earned them.
        </p>
      </div>

      {blocked ? (
        <p className="field__hint" role="status">
          {blocked}
        </p>
      ) : !recipient ? (
        <form className="stack stack--tight" onSubmit={check}>
          <div className="field">
            <label className="field__label" htmlFor="recipient">
              Recipient’s matriculation or staff number
            </label>
            <input
              id="recipient"
              className="input"
              value={identifier}
              autoCapitalize="none"
              spellCheck={false}
              placeholder="UJ/2021/CVE/0142"
              onChange={(event) => {
                setIdentifier(event.target.value)
                setError(null)
              }}
            />
          </div>

          {error ? (
            <p className="auth__error" role="alert">
              {error}
            </p>
          ) : null}

          <button type="submit" className="btn btn--block" disabled={checking || identifier.trim().length < 3}>
            {checking ? <Spinner label="Checking" /> : null}
            Find member
          </button>
        </form>
      ) : (
        <div className="stack stack--tight">
          <div className="row" style={{ padding: 'var(--space-3)', background: 'var(--surface-sunken)', borderRadius: 'var(--radius-sm)' }}>
            <span className="avatar" aria-hidden="true">
              {recipient.name
                .split(' ')
                .map((part) => part[0])
                .slice(0, 2)
                .join('')
                .toUpperCase()}
            </span>
            <span style={{ minWidth: 0 }}>
              <span style={{ fontWeight: 650, display: 'block' }}>{recipient.name}</span>
              <span className="resource__meta">
                {recipient.department} · borrower {recipient.id}
              </span>
            </span>
          </div>

          <div className="field">
            <label className="field__label" htmlFor="amount">
              Amount
            </label>
            <input
              id="amount"
              className="input tabular"
              type="number"
              inputMode="numeric"
              min={MIN_TRANSFER}
              max={ceiling}
              step={10}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
            <p className="field__hint">
              {xp.balance.toLocaleString()} XP available · {remaining.toLocaleString()} XP left to send this
              week · minimum {MIN_TRANSFER}
            </p>
          </div>

          <div className="field">
            <label className="field__label" htmlFor="note">
              Message (optional)
            </label>
            <input
              id="note"
              className="input"
              maxLength={80}
              value={note}
              placeholder="For the group project"
              onChange={(event) => setNote(event.target.value)}
            />
          </div>

          <div className="row" style={{ gap: 'var(--space-2)' }}>
            <button
              type="button"
              className="btn"
              disabled={sending || Number(amount) < MIN_TRANSFER || Number(amount) > ceiling}
              onClick={() => void confirm()}
            >
              {sending ? <Spinner label="Sending" /> : null}
              Send {Number(amount) > 0 ? Number(amount).toLocaleString() : ''} XP
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              disabled={sending}
              onClick={() => setRecipient(null)}
            >
              Change recipient
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
