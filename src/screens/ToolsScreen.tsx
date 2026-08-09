import { Link } from 'react-router-dom'
import { LIBRARY_HOURS } from '@/services/api/seed'
import { CalendarIcon, HelpIcon, MapIcon, SettingsIcon } from '@/components/icons'

const CONTACT = [
  { label: 'Circulation desk', value: '+234 803 000 0000' },
  { label: 'Email', value: 'library@unijos.edu.ng' },
  { label: 'Address', value: 'University of Jos Main Library, Bauchi Road Campus, Jos, Plateau State' },
]

export function ToolsScreen() {
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long' })

  return (
    <div className="stack" style={{ gap: 'var(--space-5)' }}>
      <div className="quickgrid">
        <Link className="quick" to="/tools/spaces">
          <span className="quick__icon">
            <CalendarIcon size={20} />
          </span>
          <span>
            <span className="quick__label">Study spaces</span>
            <span className="quick__sub">Check and book</span>
          </span>
        </Link>
        <Link className="quick" to="/tools/librarian">
          <span className="quick__icon">
            <HelpIcon size={20} />
          </span>
          <span>
            <span className="quick__label">Ask a librarian</span>
            <span className="quick__sub">Research support</span>
          </span>
        </Link>
        <Link className="quick" to="/tools/map">
          <span className="quick__icon">
            <MapIcon size={20} />
          </span>
          <span>
            <span className="quick__label">Library map</span>
            <span className="quick__sub">Floors and collections</span>
          </span>
        </Link>
        <Link className="quick" to="/tools/help">
          <span className="quick__icon">
            <HelpIcon size={20} />
          </span>
          <span>
            <span className="quick__label">Help & FAQs</span>
            <span className="quick__sub">Policies and how-tos</span>
          </span>
        </Link>
      </div>

      <section aria-labelledby="hours-heading">
        <div className="section__head">
          <h2 id="hours-heading">Opening hours</h2>
        </div>
        <ul className="card card--flush list">
          {LIBRARY_HOURS.map((entry) => (
            <li
              key={entry.day}
              className="listitem"
              style={entry.day === today ? { background: 'var(--brand-050)' } : undefined}
            >
              <span style={{ flex: 1, fontWeight: entry.day === today ? 700 : 500 }}>
                {entry.day}
                {entry.day === today ? ' · today' : ''}
              </span>
              <span className="small muted">
                {entry.opens} – {entry.closes}
              </span>
            </li>
          ))}
        </ul>
        <p className="small muted" style={{ marginTop: 'var(--space-2)' }}>
          Hours are extended during examination periods — check announcements.
        </p>
      </section>

      <section aria-labelledby="contact-heading">
        <div className="section__head">
          <h2 id="contact-heading">Contact the library</h2>
        </div>
        <dl className="card stack stack--tight small">
          {CONTACT.map(({ label, value }) => (
            <div key={label}>
              <dt className="muted">{label}</dt>
              <dd style={{ margin: 0, fontWeight: 600 }}>{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <Link className="quick" to="/settings">
        <span className="quick__icon">
          <SettingsIcon size={20} />
        </span>
        <span>
          <span className="quick__label">Settings</span>
          <span className="quick__sub">Privacy, notifications, appearance</span>
        </span>
      </Link>
    </div>
  )
}
