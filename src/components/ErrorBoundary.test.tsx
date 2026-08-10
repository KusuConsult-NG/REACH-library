import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ErrorBoundary } from './ErrorBoundary'

function Boom(): JSX.Element {
  throw new Error('Cannot read properties of undefined (reading ‘filter’)')
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    // React logs the caught error itself; the noise is not the test's concern.
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => vi.restoreAllMocks())

  it('shows a recoverable screen instead of unmounting the tree', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    )
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText(/could not be shown/i)).toBeInTheDocument()
  })

  it('surfaces the underlying message, so a report is possible', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    )
    expect(screen.getByText(/reading .filter./i)).toBeInTheDocument()
  })

  it('offers clearing saved data, the one repair a user can make themselves', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    )
    expect(screen.getByRole('button', { name: /clear saved data/i })).toBeInTheDocument()
  })

  it('renders children untouched when nothing throws', () => {
    render(
      <ErrorBoundary>
        <p>All well</p>
      </ErrorBoundary>,
    )
    expect(screen.getByText('All well')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('clears itself when the route changes', async () => {
    const { rerender } = render(
      <ErrorBoundary resetKey="/rewards">
        <Boom />
      </ErrorBoundary>,
    )
    expect(screen.getByRole('alert')).toBeInTheDocument()

    // Walking to a working screen must not leave the failure on the page.
    rerender(
      <ErrorBoundary resetKey="/profile">
        <p>Profile</p>
      </ErrorBoundary>,
    )
    expect(await screen.findByText('Profile')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('lets the user retry in place', async () => {
    const user = userEvent.setup()
    let shouldThrow = true
    function Flaky() {
      if (shouldThrow) throw new Error('transient')
      return <p>Recovered</p>
    }

    render(
      <ErrorBoundary>
        <Flaky />
      </ErrorBoundary>,
    )
    shouldThrow = false
    await user.click(screen.getByRole('button', { name: /try again/i }))
    expect(screen.getByText('Recovered')).toBeInTheDocument()
  })
})
