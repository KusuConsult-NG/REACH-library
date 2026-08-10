import { Link } from 'react-router-dom'
import { Accordion } from '@/components/primitives'
import { FAQS } from '@/services/api/seed'
import { XP_VALUES, DAILY_CAPS, LEVEL_TITLES } from '@/config/xp'
import { REWARDS } from '@/config/rewards'

export function HelpScreen() {
  return (
    <div className="stack" style={{ gap: 'var(--space-5)' }}>
      <section aria-labelledby="faq-heading">
        <div className="section__head">
          <h2 id="faq-heading">Frequently asked</h2>
        </div>
        <div className="card">
          {FAQS.map((entry) => (
            <Accordion key={entry.question} question={entry.question} answer={entry.answer} />
          ))}
        </div>
      </section>

      <section aria-labelledby="xp-help">
        <div className="section__head">
          <h2 id="xp-help">How XP works</h2>
        </div>
        <div className="card stack stack--tight small">
          {(
            [
              ['Browse a catalogue record', XP_VALUES.opac_browse, DAILY_CAPS.opac_browse],
              ['Open an e-resource', XP_VALUES.eresource_access, DAILY_CAPS.eresource_access],
              ['Download a resource', XP_VALUES.resource_download, DAILY_CAPS.resource_download],
              ['Reserve a book', XP_VALUES.reservation, undefined],
              ['Borrow a physical book', XP_VALUES.physical_borrow, undefined],
            ] as [string, number, number | undefined][]
          ).map(([label, xp, cap]) => (
            <div key={label} className="row row--between">
              <span>
                {label}
                {cap ? <span className="muted"> · up to {cap}×/day</span> : null}
              </span>
              <span className="tag tag--award">+{xp} XP</span>
            </div>
          ))}
          <hr className="divider" />
          <p className="muted">
            Meeting your weekly goal pays a bonus of {XP_VALUES.weekly_goal_bonus} XP. There are{' '}
            {LEVEL_TITLES.length} levels, from {LEVEL_TITLES[0]} to {LEVEL_TITLES[LEVEL_TITLES.length - 1]}.
            Daily caps exist so XP reflects real engagement rather than repeated taps.
          </p>
        </div>
      </section>

      <section aria-labelledby="spend-help">
        <div className="section__head">
          <h2 id="spend-help">Spending your XP</h2>
        </div>
        <div className="card stack stack--tight small">
          <p>
            You have two figures. <strong>Total XP</strong> is everything you have ever earned — it only
            goes up, and it is what sets your level. <strong>Available to spend</strong> rises with the
            same activity and falls when you redeem something, so redeeming never costs you a level.
          </p>
          <hr className="divider" />
          {REWARDS.map((reward) => (
            <div key={reward.id} className="row row--between">
              <span>{reward.name}</span>
              <span className="tag tag--award">{reward.cost.toLocaleString()} XP</span>
            </div>
          ))}
          <hr className="divider" />
          <p className="muted">
            Redeeming issues a voucher code. Show it at the circulation desk before it expires. A voucher
            belongs to whoever presents it, so you can give one to a friend — use “Give to someone” to send
            them the code. XP itself cannot be transferred: it records your own use of the library.
          </p>
        </div>
      </section>

      <section aria-labelledby="offline-help">
        <div className="section__head">
          <h2 id="offline-help">Using REACH offline</h2>
        </div>
        <div className="card small stack stack--tight">
          <p>
            Install REACH from your browser menu (“Add to Home screen”) to open it like an app. Your loans,
            saved records and recently viewed items stay readable without a connection.
          </p>
          <p className="muted">
            Renewals and reservations made offline are queued and sent automatically when you reconnect.
            Borrowing a physical copy always needs a connection.
          </p>
        </div>
      </section>

      <section aria-labelledby="contact-help">
        <div className="section__head">
          <h2 id="contact-help">Still stuck?</h2>
        </div>
        <Link className="btn btn--block" to="/tools/librarian">
          Ask a librarian
        </Link>
      </section>
    </div>
  )
}
