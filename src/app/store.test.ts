import { beforeEach, describe, expect, it } from 'vitest'
import { makeStore } from './store'
import { login } from '@/features/auth/authSlice'
import { setTheme } from '@/features/ui/uiSlice'
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
