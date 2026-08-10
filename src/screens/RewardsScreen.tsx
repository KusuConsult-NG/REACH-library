import { useEffect } from 'react'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { CHEAPEST_REWARD, REWARDS } from '@/config/rewards'
import { redeemReward, shareVoucher } from '@/features/rewards/actions'
import { expireStale, markUsed, removeVoucher } from '@/features/rewards/rewardsSlice'
import { EmptyState } from '@/components/primitives'
import { SendXpCard } from '@/components/SendXpCard'
import { CheckIcon, StarIcon } from '@/components/icons'
import { formatDate, relativeTime } from '@/utils/date'

export function RewardsScreen() {
  const dispatch = useAppDispatch()
  const { balance, totalXp } = useAppSelector((state) => state.xp)
  const vouchers = useAppSelector((state) => state.rewards.vouchers)
  const transfers = useAppSelector((state) => state.xp.transfers)

  // Anything past its date should say so the moment the screen opens.
  useEffect(() => {
    dispatch(expireStale())
  }, [dispatch])

  const received = transfers
    .filter((transfer) => transfer.direction === 'received')
    .reduce((sum, transfer) => sum + transfer.amount, 0)
  const active = vouchers.filter((voucher) => voucher.status === 'active')
  const past = vouchers.filter((voucher) => voucher.status !== 'active')
  const shortfall = CHEAPEST_REWARD.cost - balance

  return (
    <div className="stack" style={{ gap: 'var(--space-5)' }}>
      <section className="xpcard" aria-labelledby="balance-heading">
        <p className="xpcard__title" style={{ margin: 0 }}>
          Available to spend
        </p>
        <h2 id="balance-heading" className="xpcard__level" style={{ fontSize: '2.25rem' }}>
          {balance.toLocaleString()} XP
        </h2>
        <p className="small" style={{ opacity: 0.85 }}>
          {totalXp.toLocaleString()} XP earned in total — that is what sets your level, and spending never
          lowers it.
          {received > 0
            ? ` The ${received.toLocaleString()} XP sent to you adds to what you can spend, not to your level.`
            : ''}
        </p>
        {balance < CHEAPEST_REWARD.cost ? (
          <p className="small" style={{ marginTop: 'var(--space-3)', fontWeight: 650 }}>
            {shortfall.toLocaleString()} XP more unlocks {CHEAPEST_REWARD.name.toLowerCase()}.
          </p>
        ) : null}
      </section>

      <SendXpCard />

      {transfers.length > 0 ? (
        <section aria-labelledby="transfers-heading">
          <div className="section__head">
            <h2 id="transfers-heading">Transfers</h2>
          </div>
          <ul className="card card--flush list">
            {transfers.slice(0, 8).map((transfer) => (
              <li key={transfer.id} className="listitem">
                <span className="listitem__icon listitem__icon--xp" aria-hidden="true">
                  <StarIcon size={18} />
                </span>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ fontWeight: 650, fontSize: '0.92rem', display: 'block' }}>
                    {transfer.direction === 'sent' ? 'Sent to' : 'Received from'}{' '}
                    {transfer.counterpartyName}
                  </span>
                  <span className="resource__meta">
                    {relativeTime(transfer.at)}
                    {transfer.note ? ` · “${transfer.note}”` : ''}
                  </span>
                </span>
                <span className={transfer.direction === 'sent' ? 'tag' : 'tag tag--available'}>
                  {transfer.direction === 'sent' ? '−' : '+'}
                  {transfer.amount.toLocaleString()} XP
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="catalogue-heading">
        <div className="section__head">
          <h2 id="catalogue-heading">What you can redeem</h2>
        </div>
        <ul className="rewardgrid">
          {REWARDS.map((reward) => {
            const affordable = balance >= reward.cost
            return (
              <li key={reward.id} className="card stack stack--tight">
                <div className="row row--between" style={{ alignItems: 'flex-start' }}>
                  <h3>{reward.name}</h3>
                  <span className={affordable ? 'tag tag--award' : 'tag'}>
                    {reward.cost.toLocaleString()} XP
                  </span>
                </div>
                <p className="small muted">{reward.description}</p>
                <p className="field__hint">Valid {reward.validForDays} days once redeemed.</p>
                <button
                  type="button"
                  className={affordable ? 'btn btn--sm' : 'btn btn--secondary btn--sm'}
                  disabled={!affordable}
                  onClick={() => dispatch(redeemReward(reward))}
                >
                  {affordable ? 'Redeem' : `Need ${(reward.cost - balance).toLocaleString()} more`}
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      <section aria-labelledby="vouchers-heading">
        <div className="section__head">
          <h2 id="vouchers-heading">Your vouchers</h2>
        </div>

        {active.length === 0 ? (
          <div className="card">
            <EmptyState
              icon={<StarIcon size={26} />}
              title="No vouchers yet"
              body="Redeem a reward and the code appears here. Show it at the circulation desk."
            />
          </div>
        ) : (
          <ul className="stack stack--tight">
            {active.map((voucher) => (
              <li key={voucher.id} className="card stack stack--tight">
                <div className="row row--between" style={{ alignItems: 'flex-start' }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontWeight: 650 }}>{voucher.name}</p>
                    <p className="small muted">Expires {formatDate(voucher.expiresAt)}</p>
                  </div>
                  <span className="tag tag--available">Active</span>
                </div>

                <p
                  className="tabular"
                  style={{
                    fontSize: '1.35rem',
                    fontWeight: 750,
                    letterSpacing: '0.06em',
                    padding: 'var(--space-3)',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--surface-sunken)',
                    textAlign: 'center',
                  }}
                >
                  {voucher.code}
                </p>

                {voucher.sharedAt ? (
                  <p className="field__hint">Shared {relativeTime(voucher.sharedAt)}.</p>
                ) : null}

                <div className="row" style={{ gap: 'var(--space-2)' }}>
                  <button
                    type="button"
                    className="btn btn--secondary btn--sm"
                    onClick={() => void dispatch(shareVoucher(voucher.id))}
                  >
                    Give to someone
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={() => dispatch(markUsed(voucher.id))}
                  >
                    Mark as used
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <p className="small muted" style={{ marginTop: 'var(--space-3)' }}>
          A voucher belongs to whoever presents the code, so giving one away is another way to share —
          useful when you want to hand over something specific rather than credit.
        </p>
      </section>

      {past.length > 0 ? (
        <section aria-labelledby="past-heading">
          <div className="section__head">
            <h2 id="past-heading">Past vouchers</h2>
          </div>
          <ul className="card card--flush list">
            {past.map((voucher) => (
              <li key={voucher.id} className="listitem">
                <span className="listitem__icon listitem__icon--xp" aria-hidden="true">
                  <CheckIcon size={18} />
                </span>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ fontWeight: 650, fontSize: '0.92rem', display: 'block' }}>
                    {voucher.name}
                  </span>
                  <span className="resource__meta">
                    {voucher.status === 'used'
                      ? `Used ${voucher.usedAt ? relativeTime(voucher.usedAt) : ''}`
                      : `Expired ${formatDate(voucher.expiresAt)}`}{' '}
                    · {voucher.cost.toLocaleString()} XP
                  </span>
                </span>
                <button
                  type="button"
                  className="section__link"
                  onClick={() => dispatch(removeVoucher(voucher.id))}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
