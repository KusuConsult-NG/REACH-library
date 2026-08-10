import { Component, type ReactNode } from 'react'
import { clearAll } from '@/services/storage'

interface Props {
  children: ReactNode
  /** Changing this remounts the boundary — used to clear it on navigation. */
  resetKey?: string
}

interface State {
  error: Error | null
}

/**
 * Contain a screen that throws.
 *
 * React unmounts the entire tree when a render throws and nothing catches it,
 * so one bad read — `undefined.filter(...)` on a state field the saved copy
 * predates — turns into a white page with no navigation and no explanation.
 * The user cannot tell that from a broken deployment.
 *
 * This wraps the routed screen only, so the header and tab bar survive and the
 * user can walk to a screen that works. The offer to clear stored data is the
 * point rather than a formality: a state blob written by an older build is the
 * likeliest reason a screen throws here, and it is the one repair a user can
 * carry out themselves.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidUpdate(previous: Props) {
    if (previous.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null })
    }
  }

  componentDidCatch(error: Error) {
    // Keep it in the console verbatim: the boundary is what makes this the only
    // record of the failure.
    console.error('reach:crash', error)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="card stack" role="alert">
        <h1 style={{ fontSize: '1.15rem' }}>This screen could not be shown</h1>
        <p className="small muted">
          The rest of the app still works — use the menu to go somewhere else. If this screen keeps
          failing, clearing the data REACH has saved on this device usually fixes it. Your loans and
          borrowing record live with the library, not on the phone, so they are not affected.
        </p>
        <p className="field__hint tabular">{this.state.error.message}</p>
        <div className="wrap">
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={() => this.setState({ error: null })}
          >
            Try again
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => {
              clearAll()
              window.location.reload()
            }}
          >
            Clear saved data and reload
          </button>
        </div>
      </div>
    )
  }
}
