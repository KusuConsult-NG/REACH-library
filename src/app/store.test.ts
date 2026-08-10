import { beforeEach, describe, expect, it } from 'vitest'
import { makeStore } from './store'
import { login, logout } from '@/features/auth/authSlice'
import { enqueue, setTheme } from '@/features/ui/uiSlice'
import { award, recordTransfer } from '@/features/xp/xpSlice'
import { clearAll } from '@/services/storage'
import type { User } from '@/types'

function user(borrowerNumber: string, name: string): User {
  return {
    id: borrowerNumber,
    username: name.toLowerCase().replace(/\s+/g, '.'),
    name,
    email: `${name.toLowerCase().replace(/\s+/g, '.')}@unijos.edu.ng`,
    role: 'undergraduate',
    department: 'Civil Engineering',
    faculty: 'Engineering',
    avatarInitials: 'XX',
    borrowerNumber,
    joinedAt: new Date().toISOString(),
  }
}

function signIn(store: ReturnType<typeof makeStore>, borrowerNumber: string, name: string) {
  store.dispatch({
    type: login.fulfilled.type,
    payload: { user: user(borrowerNumber, name), token: `token-${borrowerNumber}` },
    meta: { arg: { username: name, password: 'password' }, requestId: borrowerNumber },
  })
}

function signOut(store: ReturnType<typeof makeStore>) {
  store.dispatch({ type: logout.fulfilled.type, meta: { arg: undefined, requestId: 'out' } })
}

describe('switching borrower on a shared device', () => {
  beforeEach(() => clearAll())

  it('does not hand the next borrower the previous one’s XP', () => {
    const store = makeStore()
    signIn(store, '20001', 'Amina Bello')
    store.dispatch(award({ kind: 'physical_borrow' }, true))
    expect(store.getState().xp.totalXp).toBe(50)

    signIn(store, '20002', 'Gyang Pam')

    expect(store.getState().auth.user?.borrowerNumber).toBe('20002')
    expect(store.getState().xp.totalXp).toBe(0)
    expect(store.getState().xp.balance).toBe(0)
    expect(store.getState().xp.transfers).toEqual([])
  })

  it('keeps your record when you sign out and back in', () => {
    const store = makeStore()
    signIn(store, '20001', 'Amina Bello')
    store.dispatch(award({ kind: 'physical_borrow' }, true))

    signOut(store)
    signIn(store, '20001', 'Amina Bello')

    // XP lives on the device: wiping on sign-out would destroy it outright.
    expect(store.getState().xp.totalXp).toBe(50)
    expect(store.getState().xp.balance).toBe(50)
  })

  it('wipes on handover even when the previous borrower signed out first', () => {
    const store = makeStore()
    signIn(store, '20001', 'Amina Bello')
    store.dispatch(award({ kind: 'physical_borrow' }, true))

    signOut(store)
    signIn(store, '20002', 'Gyang Pam')

    expect(store.getState().xp.totalXp).toBe(0)
  })

  it('does not replay one borrower’s offline actions under the next borrower', () => {
    const store = makeStore()
    signIn(store, '20001', 'Amina Bello')
    store.dispatch(enqueue({ kind: 'renew', loanId: 'loan-belonging-to-20001' }))

    signOut(store)
    signIn(store, '20002', 'Gyang Pam')

    expect(store.getState().ui.queue).toEqual([])
  })

  it('keeps your own queued offline actions across your own sign-out', () => {
    const store = makeStore()
    signIn(store, '20001', 'Amina Bello')
    store.dispatch(enqueue({ kind: 'renew', loanId: 'mine' }))

    signOut(store)
    signIn(store, '20001', 'Amina Bello')

    expect(store.getState().ui.queue).toHaveLength(1)
  })

  it('keeps the record when the same borrower signs in again', () => {
    const store = makeStore()
    signIn(store, '20001', 'Amina Bello')
    store.dispatch(award({ kind: 'physical_borrow' }, true))
    store.dispatch(
      recordTransfer({
        id: 'x1',
        direction: 'received',
        counterpartyName: 'Gyang Pam',
        counterpartyId: '20002',
        amount: 100,
        at: new Date().toISOString(),
      }),
    )

    signIn(store, '20001', 'Amina Bello')

    expect(store.getState().xp.totalXp).toBe(50)
    expect(store.getState().xp.balance).toBe(150)
    expect(store.getState().xp.transfers).toHaveLength(1)
  })

  it('leaves the device theme alone — it belongs to the machine, not the person', () => {
    const store = makeStore()
    signIn(store, '20001', 'Amina Bello')
    store.dispatch(setTheme('dark'))

    signIn(store, '20002', 'Gyang Pam')

    expect(store.getState().ui.theme).toBe('dark')
  })
})
