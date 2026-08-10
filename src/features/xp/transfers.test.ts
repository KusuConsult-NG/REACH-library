import { beforeEach, describe, expect, it } from 'vitest'
import reducer, { award, recordTransfer, sentThisWeek, type XpState } from './xpSlice'
import { MIN_TRANSFER, WEEKLY_TRANSFER_LIMIT } from '@/config/transfers'
import { MockLibraryApi } from '@/services/api/mock'
import { clearAll } from '@/services/storage'
import type { XpTransfer } from '@/types'

const base: XpState = {
  totalXp: 0,
  balance: 0,
  activities: [],
  weeklyGoal: 150,
  bonusPaidWeeks: [],
  streak: 0,
  lastActiveDay: null,
  transfers: [],
}

function transfer(over: Partial<XpTransfer> = {}): XpTransfer {
  return {
    id: `xfer-${Math.random().toString(36).slice(2, 8)}`,
    direction: 'sent',
    counterpartyName: 'Amina Bello',
    counterpartyId: 'UJ2021CVE0142',
    amount: 100,
    at: new Date().toISOString(),
    ...over,
  }
}

const SENDER = 'uj/2021/cve/0142'
const RECIPIENT = 'uj/2022/law/0088'

/** Two members in one process, each with their own signed-in adapter. */
async function member(username: string) {
  const api = new MockLibraryApi()
  await api.login(username, 'password')
  return api
}

describe('recordTransfer reducer', () => {
  it('moves the balance out but leaves the lifetime total alone', () => {
    let state = reducer(base, award({ kind: 'physical_borrow' }, true))
    state = reducer(state, award({ kind: 'physical_borrow' }, true))
    expect(state.balance).toBe(100)

    const sent = reducer(state, recordTransfer(transfer({ amount: 60 })))
    expect(sent.balance).toBe(40)
    // The whole point of the two counters: sending credit costs no progress.
    expect(sent.totalXp).toBe(100)
    expect(sent.transfers).toHaveLength(1)
  })

  it('credits the balance on the receiving side without inventing engagement', () => {
    const received = reducer(base, recordTransfer(transfer({ direction: 'received', amount: 250 })))
    expect(received.balance).toBe(250)
    // Nobody levels up on someone else's reading.
    expect(received.totalXp).toBe(0)
  })

  it('never drives the balance negative', () => {
    const state = reducer(base, recordTransfer(transfer({ amount: 500 })))
    expect(state.balance).toBe(0)
  })

  it('keeps the newest movement first', () => {
    let state = reducer(base, recordTransfer(transfer({ id: 'first', direction: 'received' })))
    state = reducer(state, recordTransfer(transfer({ id: 'second', direction: 'received' })))
    expect(state.transfers.map((t) => t.id)).toEqual(['second', 'first'])
  })
})

describe('sentThisWeek', () => {
  it('counts only what was sent, and only inside the current ISO week', () => {
    const lastWeek = new Date(Date.now() - 8 * 86_400_000).toISOString()
    let state = reducer(base, recordTransfer(transfer({ amount: 300, at: lastWeek })))
    state = reducer(state, recordTransfer(transfer({ amount: 120 })))
    state = reducer(state, recordTransfer(transfer({ direction: 'received', amount: 900 })))
    expect(sentThisWeek(state)).toBe(120)
  })

  it('reports nothing for a member who has never sent any', () => {
    expect(sentThisWeek(base)).toBe(0)
  })
})

describe('MockLibraryApi transfers', () => {
  beforeEach(() => clearAll())

  it('resolves a recipient by matriculation number before any XP moves', async () => {
    const api = await member(SENDER)
    const found = await api.lookupMember(RECIPIENT)
    expect(found).toBeDefined()
    expect(found!.name).toBeTruthy()
    expect(found!.department).toBeTruthy()
  })

  it('refuses to let a member send XP to themselves', async () => {
    const api = await member(SENDER)
    await expect(api.lookupMember(SENDER)).rejects.toMatchObject({ code: 'limit_reached' })
    await expect(api.sendXp(SENDER, 100)).rejects.toMatchObject({ code: 'limit_reached' })
  })

  it('rejects an amount below the minimum', async () => {
    const api = await member(SENDER)
    await expect(api.sendXp(RECIPIENT, MIN_TRANSFER - 1)).rejects.toMatchObject({
      code: 'limit_reached',
    })
  })

  it('enforces the weekly ceiling on the backend, not just in the UI', async () => {
    const api = await member(SENDER)
    await api.sendXp(RECIPIENT, WEEKLY_TRANSFER_LIMIT)
    await expect(api.sendXp(RECIPIENT, MIN_TRANSFER)).rejects.toMatchObject({
      code: 'limit_reached',
    })
  })

  it('delivers the XP to the recipient, not back to the sender', async () => {
    const sender = await member(SENDER)
    const result = await sender.sendXp(RECIPIENT, 200, 'For the group project')
    expect(result.amount).toBe(200)
    await expect(sender.claimIncomingXp()).resolves.toEqual([])

    const recipient = await member(RECIPIENT)
    const incoming = await recipient.claimIncomingXp()
    expect(incoming).toHaveLength(1)
    expect(incoming[0].amount).toBe(200)
    expect(incoming[0].note).toBe('For the group project')
    expect(incoming[0].id).toBe(result.transferId)
  })

  it('clears the inbox on claim, so a reload cannot credit the same XP twice', async () => {
    const sender = await member(SENDER)
    await sender.sendXp(RECIPIENT, 100)

    const recipient = await member(RECIPIENT)
    expect(await recipient.claimIncomingXp()).toHaveLength(1)
    expect(await recipient.claimIncomingXp()).toEqual([])
  })

  it('hands over every waiting transfer at once', async () => {
    const sender = await member(SENDER)
    await sender.sendXp(RECIPIENT, 100)
    await sender.sendXp(RECIPIENT, 150)

    const recipient = await member(RECIPIENT)
    const incoming = await recipient.claimIncomingXp()
    expect(incoming.map((t) => t.amount)).toEqual([100, 150])
  })

  it('requires a session before sending anything', async () => {
    const api = new MockLibraryApi()
    await expect(api.sendXp(RECIPIENT, 100)).rejects.toMatchObject({ code: 'invalid_credentials' })
  })

  it('drops fractional XP rather than transferring part of a point', async () => {
    const sender = await member(SENDER)
    const result = await sender.sendXp(RECIPIENT, 120.9)
    expect(result.amount).toBe(120)
  })
})
