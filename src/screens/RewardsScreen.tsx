import { useEffect } from 'react'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { CHEAPEST_REWARD, REWARDS } from '@/config/rewards'
import { redeemReward, shareVoucher } from '@/features/rewards/actions'
import { expireStale, markUsed, removeVoucher } from '@/features/rewards/rewardsSlice'
import { EmptyState } from '@/components/primitives'
import { CheckIcon, StarIcon } from '@/components/icons'
import { formatDate, relativeTime } from '@/utils/date'

export function RewardsScreen() {
  const dispatch = useAppDispatch()
  const { balance, totalXp } = useAppSelector((state) => state.xp)
  const vouchers = useAppSelector((state) => state.rewards.vouchers)

  // Anything past its date should say so the moment the screen opens.
  useEffect(() => {
    dispatch(expireStale())
  }, [dispatch])

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
          {totalXp.toLocaleString()} XP earned in total. Spending never reduces your level — the two are
          counted separately.
        </p>
        {balance < CHEAPEST_REWARD.cost ? (
          <p className="small" style={{ marginTop: 'var(--space-3)', fontWeight: 650 }}>
            {shortfall.toLocaleString()} XP more unlocks {CHEAPEST_REWARD.name.toLowerCase()}.
          </p>
        ) : null}
      </section>

      <section aria-labelledby="catalogue-heading">
        <div className="section__head">
          <h2 id="catalogue-heading">What you can redeem</h2>
        </div>
        <ul className="quickgrid">
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
          A voucher belongs to whoever presents the code, so giving one away is how you share credit. XP
          itself stays on your account — it measures your own use of the library.
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
