import { useState, type FormEvent } from 'react'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { clearError, login } from '@/features/auth/authSlice'
import { UniversityLogo } from '@/components/UniversityLogo'
import { Spinner } from '@/components/primitives'
import { usingLiveBackend } from '@/services/api'

/**
 * Single sign-on entry point.
 *
 * Against a live backend this posts to the proxy, which performs the OAuth 2.0
 * authorisation-code exchange with the university IdP; the browser only ever
 * holds the resulting short-lived bearer token.
 */
export function LoginScreen() {
  const dispatch = useAppDispatch()
  const status = useAppSelector((state) => state.auth.status)
  const error = useAppSelector((state) => state.auth.error)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [touched, setTouched] = useState(false)

  const busy = status === 'authenticating'
  const invalid = touched && (!username.trim() || !password.trim())

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    setTouched(true)
    if (!username.trim() || !password.trim()) return
    void dispatch(login({ username, password }))
  }

  return (
    <div className="auth">
      <div className="auth__inner">
        <div className="auth__mark">
          <UniversityLogo size={72} />
        </div>
        <h1 style={{ textAlign: 'center', fontSize: '1.8rem' }}>REACH</h1>
        <p style={{ textAlign: 'center', opacity: 0.9, marginTop: 6 }}>
          Resource · Engagement · Academic · Community · Hub
        </p>
        <p style={{ textAlign: 'center', opacity: 0.75, fontSize: '0.85rem', marginTop: 4 }}>
          University of Jos Library
        </p>

        <form className="auth__card stack" onSubmit={onSubmit} noValidate>
          <h2>Sign in</h2>
          <p className="small muted">Use the same credentials as the university portal.</p>

          {error ? (
            <p className="auth__error" role="alert">
              {error}
            </p>
          ) : null}

          <div className="field">
            <label className="field__label" htmlFor="username">
              Matriculation or staff number
            </label>
            <input
              id="username"
              className="input"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              enterKeyHint="next"
              value={username}
              aria-invalid={invalid && !username.trim()}
              aria-describedby="username-hint"
              onChange={(e) => {
                setUsername(e.target.value)
                if (error) dispatch(clearError())
              }}
            />
            <p className="field__hint" id="username-hint">
              For example UJ/2021/CVE/0142 or a staff ID.
            </p>
          </div>

          <div className="field">
            <label className="field__label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              className="input"
              autoComplete="current-password"
              enterKeyHint="go"
              value={password}
              aria-invalid={invalid && !password.trim()}
              onChange={(e) => {
                setPassword(e.target.value)
                if (error) dispatch(clearError())
              }}
            />
          </div>

          <button className="btn btn--block" type="submit" disabled={busy}>
            {busy ? <Spinner label="Signing in" /> : null}
            {busy ? 'Signing in…' : 'Sign in'}
          </button>

          <p className="small muted" style={{ textAlign: 'center' }}>
            Trouble signing in? Contact the library help desk on Level 1 or use the campus IT portal to reset
            your password.
          </p>

          {!usingLiveBackend ? (
            <p className="small muted" style={{ textAlign: 'center' }}>
              Demo build — any username with a password of four characters or more signs you in.
            </p>
          ) : null}
        </form>
      </div>
    </div>
  )
}
