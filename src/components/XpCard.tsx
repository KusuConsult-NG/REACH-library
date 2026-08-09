import type { LevelInfo } from '@/types'

function Ring({ progress, level }: { progress: number; level: number }) {
  const radius = 36
  const circumference = 2 * Math.PI * radius
  const dash = Math.max(0, Math.min(1, progress)) * circumference

  return (
    <div className="ring">
      <svg viewBox="0 0 84 84" width="84" height="84" aria-hidden="true" focusable="false">
        <circle cx="42" cy="42" r={radius} fill="none" stroke="var(--hero-track)" strokeWidth="7" />
        {dash > 0 ? (
          // A round cap on a zero-length arc would draw a stray dot at 0 XP.
          <circle
            cx="42"
            cy="42"
            r={radius}
            fill="none"
            stroke="var(--hero-accent)"
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference}`}
            transform="rotate(-90 42 42)"
            style={{ transition: 'stroke-dasharray 500ms cubic-bezier(0.2,0,0.2,1)' }}
          />
        ) : null}
      </svg>
      <div className="ring__value">
        {level}
        <span>Level</span>
      </div>
    </div>
  )
}

/**
 * The XP hero shown on Home and Profile: level, progress to the next level,
 * and the three counters the PRD asks to keep visible (weekly progress,
 * streak, items on loan).
 */
export function XpCard({
  info,
  weeklyXp,
  weeklyGoal,
  streak,
  loans,
}: {
  info: LevelInfo
  weeklyXp: number
  weeklyGoal: number
  streak: number
  loans: number
}) {
  const weeklyPct = Math.min(100, Math.round((weeklyXp / Math.max(1, weeklyGoal)) * 100))

  return (
    <section className="xpcard" aria-labelledby="xp-heading">
      <div className="xpcard__top">
        <Ring progress={info.progress} level={info.level} />
        <div className="xpcard__meta">
          <h2 id="xp-heading" className="xpcard__level">
            {info.currentXp.toLocaleString()} XP
          </h2>
          <p className="xpcard__title">{info.title}</p>
          <p className="small" style={{ marginTop: 6, opacity: 0.9 }}>
            {info.isMax
              ? 'Highest level reached'
              : `${info.xpToNext.toLocaleString()} XP to level ${info.level + 1}`}
          </p>
        </div>
      </div>

      <div style={{ marginTop: 'var(--space-4)' }}>
        <div className="row row--between small" style={{ marginBottom: 6 }}>
          <span>Weekly goal</span>
          <span>
            {weeklyXp} / {weeklyGoal} XP
          </span>
        </div>
        <div
          className="meter"
          role="progressbar"
          aria-valuenow={weeklyPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Weekly goal progress: ${weeklyPct} percent`}
        >
          <div className="meter__fill" style={{ width: `${weeklyPct}%` }} />
        </div>
      </div>

      <div className="statgrid">
        <div className="stat">
          <div className="stat__value">{streak}</div>
          <div className="stat__label">Day streak</div>
        </div>
        <div className="stat">
          <div className="stat__value">{loans}</div>
          <div className="stat__label">On loan</div>
        </div>
        <div className="stat">
          <div className="stat__value">{weeklyPct}%</div>
          <div className="stat__label">Weekly goal</div>
        </div>
      </div>
    </section>
  )
}
