import { useState } from 'react'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { completeOnboarding, setPrivacy, toggleInterest } from '@/features/auth/authSlice'
import { Chip, Switch } from '@/components/primitives'
import { BookIcon, StarIcon, CommunityIcon } from '@/components/icons'
import { SUBJECT_AREAS } from '@/services/api/seed'
import { XP_VALUES } from '@/config/xp'

/**
 * First-run flow (PRD §5.2). Three short steps: what REACH is for, the subjects
 * to watch, and the privacy choices — asked up front rather than buried in
 * settings, because activity sharing defaults to off and users should know it.
 */
export function OnboardingScreen() {
  const dispatch = useAppDispatch()
  const interests = useAppSelector((state) => state.auth.notifications.interests)
  const privacy = useAppSelector((state) => state.auth.privacy)
  const [step, setStep] = useState(0)

  const steps = [
    {
      title: 'Your library, in your pocket',
      body: 'Search the catalogue, borrow and renew books, and open every e-resource the University of Jos subscribes to — on or off campus.',
      icon: <BookIcon size={40} />,
      content: null,
    },
    {
      title: 'Earn XP as you research',
      body: 'Every genuine interaction with a library resource earns experience points and moves you up the levels.',
      icon: <StarIcon size={40} />,
      content: (
        <ul className="stack stack--tight small" style={{ marginTop: 'var(--space-4)' }}>
          {[
            ['Browse the catalogue', XP_VALUES.opac_browse],
            ['Open an e-resource', XP_VALUES.eresource_access],
            ['Download a resource', XP_VALUES.resource_download],
            ['Reserve a book', XP_VALUES.reservation],
            ['Borrow a physical book', XP_VALUES.physical_borrow],
          ].map(([label, xp]) => (
            <li key={label as string} className="row row--between">
              <span>{label}</span>
              <span className="tag tag--award">+{xp} XP</span>
            </li>
          ))}
        </ul>
      ),
    },
    {
      title: 'Choose what you follow',
      body: 'Pick the subject areas you want alerts for, and decide what — if anything — you share.',
      icon: <CommunityIcon size={40} />,
      content: (
        <div className="stack" style={{ marginTop: 'var(--space-4)' }}>
          <div className="wrap">
            {SUBJECT_AREAS.map((subject) => (
              <Chip
                key={subject}
                pressed={interests.includes(subject)}
                onClick={() => dispatch(toggleInterest(subject))}
              >
                {subject}
              </Chip>
            ))}
          </div>
          <div className="card">
            <Switch
              label="Contribute to trending lists"
              description="Your reads help build de-identified departmental trends. Your name is never shown."
              checked={privacy.shareActivity}
              onChange={(shareActivity) => dispatch(setPrivacy({ shareActivity }))}
            />
            <Switch
              label="Discoverable profile"
              description="Let other members find and follow you."
              checked={privacy.profileVisible}
              onChange={(profileVisible) => dispatch(setPrivacy({ profileVisible }))}
            />
          </div>
        </div>
      ),
    },
  ]

  const current = steps[step]
  const last = step === steps.length - 1

  return (
    <div className="auth">
      <div className="auth__inner">
        <div className="auth__card stack">
          <div className="quick__icon" style={{ width: 64, height: 64, borderRadius: 'var(--radius)' }}>
            {current.icon}
          </div>
          <h1>{current.title}</h1>
          <p className="muted">{current.body}</p>
          {current.content}

          <div className="onboard__dots" aria-hidden="true">
            {steps.map((_, index) => (
              <span key={index} className={index === step ? 'onboard__dot onboard__dot--on' : 'onboard__dot'} />
            ))}
          </div>

          <p className="visually-hidden" aria-live="polite">
            Step {step + 1} of {steps.length}
          </p>

          <button
            type="button"
            className="btn btn--block"
            onClick={() => (last ? dispatch(completeOnboarding()) : setStep(step + 1))}
          >
            {last ? 'Start exploring' : 'Continue'}
          </button>

          {!last ? (
            <button type="button" className="section__link" onClick={() => dispatch(completeOnboarding())}>
              Skip introduction
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
