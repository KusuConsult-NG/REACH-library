import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { logout, setNotificationPrefs, setPrivacy, toggleInterest } from '@/features/auth/authSlice'
import { setTheme, toast } from '@/features/ui/uiSlice'
import { setWeeklyGoal } from '@/features/xp/xpSlice'
import { Chip, Switch } from '@/components/primitives'
import { SUBJECT_AREAS } from '@/services/api/seed'
import { clearAll as clearAllStorage } from '@/services/storage'
import { resetLocalBackend } from '@/services/api'
import { promptInstall } from '@/pwa'

export function SettingsScreen() {
  const dispatch = useAppDispatch()
  const privacy = useAppSelector((state) => state.auth.privacy)
  const prefs = useAppSelector((state) => state.auth.notifications)
  const theme = useAppSelector((state) => state.ui.theme)
  const installAvailable = useAppSelector((state) => state.ui.installAvailable)
  const weeklyGoal = useAppSelector((state) => state.xp.weeklyGoal)
  const queued = useAppSelector((state) => state.ui.queue.length)

  return (
    <div className="stack" style={{ gap: 'var(--space-5)' }}>
      <section aria-labelledby="privacy-heading">
        <div className="section__head">
          <h2 id="privacy-heading">Privacy</h2>
        </div>
        <div className="card">
          <Switch
            label="Discoverable profile"
            description="Allow other members to find and follow you."
            checked={privacy.profileVisible}
            onChange={(profileVisible) => dispatch(setPrivacy({ profileVisible }))}
          />
          <Switch
            label="Contribute to trending lists"
            description="Your reads count towards de-identified departmental trends. Your name is never attached."
            checked={privacy.shareActivity}
            onChange={(shareActivity) => dispatch(setPrivacy({ shareActivity }))}
          />
        </div>
        <p className="small muted" style={{ marginTop: 'var(--space-2)' }}>
          Borrowing records are personal data under the university data protection policy and are never shown
          to other users.
        </p>
      </section>

      <section aria-labelledby="notify-heading">
        <div className="section__head">
          <h2 id="notify-heading">Notifications</h2>
        </div>
        <div className="card">
          <Switch
            label="Due-date reminders"
            description="Three days before, on the day, and while overdue."
            checked={prefs.dueDateReminders}
            onChange={(dueDateReminders) => dispatch(setNotificationPrefs({ dueDateReminders }))}
          />
          <Switch
            label="New resources in my subjects"
            checked={prefs.newResourceAlerts}
            onChange={(newResourceAlerts) => dispatch(setNotificationPrefs({ newResourceAlerts }))}
          />
          <Switch
            label="XP milestones and levels"
            checked={prefs.xpMilestones}
            onChange={(xpMilestones) => dispatch(setNotificationPrefs({ xpMilestones }))}
          />
          <Switch
            label="Library announcements and events"
            checked={prefs.libraryAnnouncements}
            onChange={(libraryAnnouncements) => dispatch(setNotificationPrefs({ libraryAnnouncements }))}
          />
          <Switch
            label="Return confirmations"
            checked={prefs.returnConfirmations}
            onChange={(returnConfirmations) => dispatch(setNotificationPrefs({ returnConfirmations }))}
          />
        </div>
      </section>

      <section aria-labelledby="interests-heading">
        <div className="section__head">
          <h2 id="interests-heading">Subject interests</h2>
        </div>
        <p className="small muted" style={{ marginBottom: 'var(--space-3)' }}>
          New-resource alerts follow the areas you pick here.
        </p>
        <div className="wrap">
          {SUBJECT_AREAS.map((subject) => (
            <Chip
              key={subject}
              pressed={prefs.interests.includes(subject)}
              onClick={() => dispatch(toggleInterest(subject))}
            >
              {subject}
            </Chip>
          ))}
        </div>
      </section>

      <section aria-labelledby="goal-heading">
        <div className="section__head">
          <h2 id="goal-heading">Weekly XP goal</h2>
        </div>
        <div className="card">
          <label className="field__label" htmlFor="goal">
            Target: {weeklyGoal} XP per week
          </label>
          <input
            id="goal"
            type="range"
            min={50}
            max={500}
            step={10}
            value={weeklyGoal}
            style={{ width: '100%', marginTop: 'var(--space-3)' }}
            onChange={(event) => dispatch(setWeeklyGoal(Number(event.target.value)))}
          />
          <p className="field__hint">
            Meeting the goal pays a bonus. Around 150 XP is a comfortable week for most students.
          </p>
        </div>
      </section>

      <section aria-labelledby="appearance-heading">
        <div className="section__head">
          <h2 id="appearance-heading">Appearance</h2>
        </div>
        <p className="small muted" style={{ marginBottom: 'var(--space-3)' }}>
          There is also a quick toggle in the header, next to notifications.
        </p>
        <div className="wrap">
          {(['system', 'light', 'dark'] as const).map((option) => (
            <Chip key={option} pressed={theme === option} onClick={() => dispatch(setTheme(option))}>
              {option === 'system' ? 'Match device' : option === 'light' ? 'Light' : 'Dark'}
            </Chip>
          ))}
        </div>
      </section>

      <section aria-labelledby="app-heading">
        <div className="section__head">
          <h2 id="app-heading">App</h2>
        </div>
        <div className="stack stack--tight">
          {installAvailable ? (
            <button type="button" className="btn btn--secondary btn--block" onClick={() => void promptInstall()}>
              Install REACH on this device
            </button>
          ) : (
            <p className="small muted">
              To install, use your browser menu and choose “Add to Home screen”.
            </p>
          )}
          {queued > 0 ? (
            <p className="small muted">{queued} action(s) waiting to sync.</p>
          ) : null}
        </div>
      </section>

      <section aria-labelledby="account-heading">
        <div className="section__head">
          <h2 id="account-heading">Account</h2>
        </div>
        <div className="stack stack--tight">
          <button
            type="button"
            className="btn btn--ghost btn--block"
            onClick={() => {
              void dispatch(logout())
            }}
          >
            Sign out
          </button>
          <button
            type="button"
            className="btn btn--danger btn--block"
            onClick={() => {
              if (!window.confirm('Remove all REACH data stored on this device? Your library record is not affected.')) {
                return
              }
              clearAllStorage()
              resetLocalBackend()
              dispatch(toast('Local data cleared. Sign in again to resync.', 'info'))
              void dispatch(logout()).then(() => window.location.reload())
            }}
          >
            Clear data on this device
          </button>
        </div>
      </section>
    </div>
  )
}
