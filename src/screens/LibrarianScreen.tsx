import { useState, type FormEvent } from 'react'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { requestConsultation, setBusy } from '@/features/circulation/circulationSlice'
import { toast } from '@/features/ui/uiSlice'
import { Spinner } from '@/components/primitives'
import { CheckIcon } from '@/components/icons'
import { formatDate } from '@/utils/date'
import type { ConsultationRequest } from '@/types'

const MODES: { value: ConsultationRequest['preferredMode']; label: string }[] = [
  { value: 'in_person', label: 'In person at the library' },
  { value: 'video', label: 'Video call' },
  { value: 'email', label: 'By email' },
]

export function LibrarianScreen() {
  const dispatch = useAppDispatch()
  const busy = useAppSelector((state) => state.circulation.busyId === 'consultation')
  const consultations = useAppSelector((state) => state.circulation.consultations)
  const online = useAppSelector((state) => state.ui.online)

  const [topic, setTopic] = useState('')
  const [details, setDetails] = useState('')
  const [preferredMode, setPreferredMode] = useState<ConsultationRequest['preferredMode']>('in_person')
  const [preferredDate, setPreferredDate] = useState(new Date().toISOString().slice(0, 10))
  const [touched, setTouched] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setTouched(true)
    if (!topic.trim() || !details.trim()) return
    if (!online) {
      dispatch(toast('You are offline — send the request once you reconnect.', 'error'))
      return
    }

    dispatch(setBusy('consultation'))
    const action = await dispatch(requestConsultation({ topic, details, preferredMode, preferredDate }))
    if (requestConsultation.fulfilled.match(action)) {
      dispatch(toast('Request sent. A subject librarian will reply within one working day.', 'success'))
      setTopic('')
      setDetails('')
      setTouched(false)
    } else {
      dispatch(toast(action.payload ?? 'Your request could not be sent.', 'error'))
    }
  }

  return (
    <div className="stack" style={{ gap: 'var(--space-5)' }}>
      <p className="small muted">
        Subject librarians help with literature searching, referencing, database access and research data.
        Requests are answered within one working day.
      </p>

      <form className="card stack" onSubmit={onSubmit} noValidate>
        <div className="field">
          <label className="field__label" htmlFor="topic">
            What do you need help with?
          </label>
          <input
            id="topic"
            className="input"
            value={topic}
            aria-invalid={touched && !topic.trim()}
            onChange={(event) => setTopic(event.target.value)}
            placeholder="e.g. Systematic search for a public health dissertation"
          />
        </div>

        <div className="field">
          <label className="field__label" htmlFor="details">
            Tell us more
          </label>
          <textarea
            id="details"
            className="textarea"
            value={details}
            aria-invalid={touched && !details.trim()}
            aria-describedby="details-hint"
            onChange={(event) => setDetails(event.target.value)}
            placeholder="Your topic, the databases you have tried, and any deadline."
          />
          <p className="field__hint" id="details-hint">
            Include your department and level so the request reaches the right librarian.
          </p>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="mode">
            Preferred format
          </label>
          <select
            id="mode"
            className="select"
            value={preferredMode}
            onChange={(event) => setPreferredMode(event.target.value as ConsultationRequest['preferredMode'])}
          >
            {MODES.map((mode) => (
              <option key={mode.value} value={mode.value}>
                {mode.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="date">
            Preferred date
          </label>
          <input
            id="date"
            type="date"
            className="input"
            value={preferredDate}
            min={new Date().toISOString().slice(0, 10)}
            onChange={(event) => setPreferredDate(event.target.value)}
          />
        </div>

        {touched && (!topic.trim() || !details.trim()) ? (
          <p className="auth__error" role="alert">
            Please give a topic and a short description.
          </p>
        ) : null}

        <button type="submit" className="btn btn--block" disabled={busy}>
          {busy ? <Spinner label="Sending" /> : null}
          Send request
        </button>
      </form>

      {consultations.length > 0 ? (
        <section aria-labelledby="sent-heading">
          <div className="section__head">
            <h2 id="sent-heading">Your requests</h2>
          </div>
          <ul className="card card--flush list">
            {consultations.map((request) => (
              <li key={request.id} className="listitem">
                <span className="listitem__icon listitem__icon--xp" aria-hidden="true">
                  <CheckIcon size={18} />
                </span>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ fontWeight: 650, fontSize: '0.92rem', display: 'block' }}>{request.topic}</span>
                  <span className="resource__meta">
                    {MODES.find((m) => m.value === request.preferredMode)?.label} ·{' '}
                    {formatDate(request.preferredDate)} · {request.status}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
