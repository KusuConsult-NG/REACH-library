import { useEffect, useId, useRef, type ReactNode } from 'react'
import { CloseIcon } from './icons'

export function Switch({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description?: string
  checked: boolean
  onChange: (next: boolean) => void
}) {
  const id = useId()
  return (
    <div className="switch">
      <span>
        <label htmlFor={id} className="field__label">
          {label}
        </label>
        {description ? <p className="field__hint">{description}</p> : null}
      </span>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        className="switch__control"
        onClick={() => onChange(!checked)}
      />
    </div>
  )
}

export function Chip({
  children,
  pressed,
  onClick,
}: {
  children: ReactNode
  pressed: boolean
  onClick: () => void
}) {
  return (
    <button type="button" className="chip" aria-pressed={pressed} onClick={onClick}>
      {children}
    </button>
  )
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: ReactNode
  title: string
  body?: string
  action?: ReactNode
}) {
  return (
    <div className="empty">
      {icon}
      <h3>{title}</h3>
      {body ? <p className="small">{body}</p> : null}
      {action}
    </div>
  )
}

export function Skeleton({ height = 16, width = '100%' }: { height?: number; width?: number | string }) {
  return <div className="skeleton" style={{ height, width }} aria-hidden="true" />
}

export function Spinner({ dark = false, label }: { dark?: boolean; label?: string }) {
  return (
    <>
      <span className={dark ? 'spinner spinner--dark' : 'spinner'} />
      {label ? <span className="visually-hidden">{label}</span> : null}
    </>
  )
}

/**
 * Bottom sheet with a focus trap and Escape-to-close, so filter and booking
 * dialogs are operable by keyboard and announced correctly to screen readers.
 */
export function Sheet({
  title,
  onClose,
  children,
  footer,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    panelRef.current?.querySelector<HTMLElement>('button, [href], input, select, textarea')?.focus()

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
        return
      }
      if (event.key !== 'Tab' || !panelRef.current) return

      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
      )
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = overflow
      previous?.focus()
    }
  }, [onClose])

  return (
    <div
      className="sheet"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="sheet__panel" ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="row row--between" style={{ marginBottom: 'var(--space-4)' }}>
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="iconbtn" onClick={onClose} aria-label="Close">
            <CloseIcon size={20} />
          </button>
        </div>
        {children}
        {footer ? <div style={{ marginTop: 'var(--space-4)' }}>{footer}</div> : null}
      </div>
    </div>
  )
}

export function Accordion({ question, answer }: { question: string; answer: string }) {
  return (
    <details className="accordion">
      <summary className="accordion__trigger" style={{ listStyle: 'none' }}>
        {question}
        <span aria-hidden="true">+</span>
      </summary>
      <p className="accordion__body">{answer}</p>
    </details>
  )
}
