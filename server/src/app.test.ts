import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import type { Server } from 'node:http'
import { buildApp } from './app.js'

/**
 * End-to-end over the real Express app on an ephemeral port, against the
 * fixture backend. No mocking: these exercise the same routing, auth and error
 * mapping a deployment would.
 */

let server: Server
let base: string

async function start() {
  const app = await buildApp({ dataFile: null })
  return new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const address = server.address()
      if (typeof address === 'object' && address) base = `http://127.0.0.1:${address.port}`
      resolve()
    })
  })
}

async function call(
  path: string,
  init: RequestInit & { token?: string } = {},
): Promise<{ status: number; body: any }> {
  const { token, ...rest } = init
  const response = await fetch(`${base}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...rest.headers,
    },
  })
  const text = await response.text()
  return { status: response.status, body: text ? JSON.parse(text) : null }
}

async function signIn(username = 'uj/2021/cve/0142'): Promise<string> {
  const { body } = await call('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password: 'password' }),
  })
  return body.token as string
}

before(start)
after(() => server?.close())

describe('health', () => {
  it('reports which backends are wired up', async () => {
    const { status, body } = await call('/api/health')
    assert.equal(status, 200)
    assert.equal(body.status, 'ok')
    assert.equal(body.koha, 'fixture')
  })
})

describe('auth', () => {
  it('issues a token and a borrower profile', async () => {
    const { status, body } = await call('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'uj/2021/cve/0142', password: 'password' }),
    })
    assert.equal(status, 200)
    assert.ok(body.token)
    assert.ok(body.user.borrowerNumber)
    assert.ok(new Date(body.expiresAt).getTime() > Date.now())
  })

  it('reads the borrower category from the username in development', async () => {
    const { body } = await call('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'pg/2023/law/0007', password: 'password' }),
    })
    assert.equal(body.user.role, 'postgraduate')
  })

  it('rejects an unusable password', async () => {
    const { status } = await call('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'someone', password: '1' }),
    })
    assert.equal(status, 401)
  })

  it('rejects a malformed body', async () => {
    const { status } = await call('/api/auth/login', { method: 'POST', body: JSON.stringify({}) })
    assert.equal(status, 400)
  })

  it('refuses protected routes without a token', async () => {
    const { status } = await call('/api/circulation/loans')
    assert.equal(status, 401)
  })

  it('refuses a tampered token', async () => {
    const token = await signIn()
    const [payload] = token.split('.')
    const { status } = await call('/api/circulation/loans', { token: `${payload}.forged` })
    assert.equal(status, 401)
  })

  it('returns the signed-in user', async () => {
    const token = await signIn()
    const { status, body } = await call('/api/auth/me', { token })
    assert.equal(status, 200)
    assert.equal(body.username, 'uj/2021/cve/0142')
  })
})

describe('catalogue', () => {
  it('searches and paginates', async () => {
    const token = await signIn()
    const { status, body } = await call('/api/catalogue/search?q=structural&page=1&pageSize=5', { token })
    assert.equal(status, 200)
    assert.equal(body.total, 1)
    assert.match(body.items[0].title, /Structural Analysis/)
    assert.ok(Array.isArray(body.facets.types))
  })

  it('filters by type and availability', async () => {
    const token = await signIn()
    const { body } = await call('/api/catalogue/search?type=journal', { token })
    assert.ok(body.items.every((item: any) => item.type === 'journal'))

    const available = await call('/api/catalogue/search?available=1&pageSize=50', { token })
    const physical = available.body.items.filter((item: any) => item.copiesAvailable != null)
    assert.ok(physical.every((item: any) => item.copiesAvailable > 0))
  })

  it('clamps a nonsense page number instead of failing', async () => {
    const token = await signIn()
    const { status, body } = await call('/api/catalogue/search?page=-4&pageSize=9999', { token })
    assert.equal(status, 200)
    assert.equal(body.page, 1)
    assert.ok(body.pageSize <= 50)
  })

  it('404s an unknown record', async () => {
    const token = await signIn()
    const { status } = await call('/api/catalogue/koha-000000', { token })
    assert.equal(status, 404)
  })
})

describe('circulation', () => {
  it('issues an available book, records XP, and decrements availability', async () => {
    const token = await signIn('uj/2021/eng/1001')
    const before = await call('/api/catalogue/koha-103771', { token })

    const checkout = await call('/api/circulation/checkout', {
      method: 'POST',
      token,
      body: JSON.stringify({ resourceId: 'koha-103771' }),
    })
    assert.equal(checkout.status, 201)
    assert.equal(checkout.body.status, 'active')

    const after = await call('/api/catalogue/koha-103771', { token })
    assert.equal(after.body.copiesAvailable, before.body.copiesAvailable - 1)

    const ledger = await call('/api/activity', { token })
    assert.ok(ledger.body.activities.some((entry: any) => entry.kind === 'physical_borrow'))
    assert.ok(ledger.body.totalXp >= 50)
  })

  it('refuses a title with every copy on loan', async () => {
    const token = await signIn('uj/2021/law/2002')
    const { status, body } = await call('/api/circulation/checkout', {
      method: 'POST',
      token,
      body: JSON.stringify({ resourceId: 'koha-104987' }),
    })
    assert.equal(status, 409)
    assert.match(body.message, /out on loan/i)
  })

  it('renews until the limit, then refuses', async () => {
    const token = await signIn('uj/2021/edu/3003')
    const checkout = await call('/api/circulation/checkout', {
      method: 'POST',
      token,
      body: JSON.stringify({ resourceId: 'koha-105112' }),
    })
    const loan = checkout.body

    for (let i = 0; i < loan.maxRenewals; i++) {
      const renewed = await call(`/api/circulation/loans/${loan.id}/renew`, { method: 'POST', token })
      assert.equal(renewed.status, 200)
    }
    const beyond = await call(`/api/circulation/loans/${loan.id}/renew`, { method: 'POST', token })
    assert.equal(beyond.status, 409)
  })

  it('keeps one borrower out of another borrower loans', async () => {
    const mine = await signIn('uj/2021/agr/4004')
    const theirs = await signIn('uj/2021/agr/5005')
    const checkout = await call('/api/circulation/checkout', {
      method: 'POST',
      token: mine,
      body: JSON.stringify({ resourceId: 'koha-104233' }),
    })

    const otherLoans = await call('/api/circulation/loans', { token: theirs })
    assert.ok(!otherLoans.body.some((loan: any) => loan.id === checkout.body.id))
  })

  it('treats a replayed hold as the same hold, not an error', async () => {
    const token = await signIn('uj/2021/med/6006')
    const first = await call('/api/circulation/holds', {
      method: 'POST',
      token,
      body: JSON.stringify({ resourceId: 'koha-104987' }),
    })
    assert.equal(first.status, 201)

    // The offline queue retries the same operation after reconnecting.
    const replay = await call('/api/circulation/holds', {
      method: 'POST',
      token,
      body: JSON.stringify({ resourceId: 'koha-104987' }),
    })
    assert.equal(replay.status, 200)
    assert.equal(replay.body.id, first.body.id)

    const holds = await call('/api/circulation/holds', { token })
    assert.equal(holds.body.length, 1)
  })

  it('promotes the next reservation when a copy comes back', async () => {
    const borrower = await signIn('uj/2021/sci/7007')
    const waiter = await signIn('uj/2021/sci/8008')

    const checkout = await call('/api/circulation/checkout', {
      method: 'POST',
      token: borrower,
      body: JSON.stringify({ resourceId: 'koha-103771' }),
    })
    await call('/api/circulation/holds', {
      method: 'POST',
      token: waiter,
      body: JSON.stringify({ resourceId: 'koha-103771' }),
    })

    await call(`/api/circulation/loans/${checkout.body.id}/return`, { method: 'POST', token: borrower })

    const holds = await call('/api/circulation/holds', { token: waiter })
    assert.equal(holds.body[0].status, 'ready')
  })

  it('rejects a request with no resourceId', async () => {
    const token = await signIn()
    const { status } = await call('/api/circulation/checkout', { method: 'POST', token, body: '{}' })
    assert.equal(status, 400)
  })
})

describe('spaces and consultations', () => {
  it('books a slot and refuses a double booking', async () => {
    const token = await signIn('uj/2021/bok/1111')
    const date = new Date().toISOString().slice(0, 10)

    const first = await call('/api/spaces/bookings', {
      method: 'POST',
      token,
      body: JSON.stringify({ spaceId: 's-01', date, slot: '14:00' }),
    })
    assert.equal(first.status, 201)

    const clash = await call('/api/spaces/bookings', {
      method: 'POST',
      token,
      body: JSON.stringify({ spaceId: 's-01', date, slot: '14:00' }),
    })
    assert.equal(clash.status, 409)
  })

  it('rejects an unbookable slot or a past date', async () => {
    const token = await signIn('uj/2021/bok/2222')
    const date = new Date().toISOString().slice(0, 10)

    const badSlot = await call('/api/spaces/bookings', {
      method: 'POST',
      token,
      body: JSON.stringify({ spaceId: 's-01', date, slot: '03:00' }),
    })
    assert.equal(badSlot.status, 400)

    const past = await call('/api/spaces/bookings', {
      method: 'POST',
      token,
      body: JSON.stringify({ spaceId: 's-01', date: '2020-01-01', slot: '14:00' }),
    })
    assert.equal(past.status, 400)
  })

  it('will not let one borrower cancel another borrower booking', async () => {
    const owner = await signIn('uj/2021/bok/3333')
    const stranger = await signIn('uj/2021/bok/4444')
    const date = new Date().toISOString().slice(0, 10)

    const booking = await call('/api/spaces/bookings', {
      method: 'POST',
      token: owner,
      body: JSON.stringify({ spaceId: 's-02', date, slot: '09:00' }),
    })

    const attempt = await call(`/api/spaces/bookings/${booking.body.id}`, { method: 'DELETE', token: stranger })
    assert.equal(attempt.status, 404)

    const removed = await call(`/api/spaces/bookings/${booking.body.id}`, { method: 'DELETE', token: owner })
    assert.equal(removed.status, 204)
  })

  it('accepts a consultation request and validates it', async () => {
    const token = await signIn('uj/2021/con/1234')
    const ok = await call('/api/consultations', {
      method: 'POST',
      token,
      body: JSON.stringify({
        topic: 'Systematic search',
        details: 'Public health dissertation, tried PubMed only.',
        preferredMode: 'video',
        preferredDate: new Date().toISOString().slice(0, 10),
      }),
    })
    assert.equal(ok.status, 201)
    assert.equal(ok.body.status, 'submitted')

    const bad = await call('/api/consultations', {
      method: 'POST',
      token,
      body: JSON.stringify({ topic: '', details: '', preferredMode: 'carrier-pigeon', preferredDate: 'soon' }),
    })
    assert.equal(bad.status, 400)
  })
})

describe('activity and XP', () => {
  it('caps repeatable activities per day but still logs them', async () => {
    const token = await signIn('uj/2021/xp/0001')

    for (let i = 0; i < 9; i++) {
      await call('/api/activity', {
        method: 'POST',
        token,
        body: JSON.stringify({ kind: 'opac_browse', resourceId: 'koha-103771' }),
      })
    }

    const { body } = await call('/api/activity', { token })
    const browses = body.activities.filter((entry: any) => entry.kind === 'opac_browse')
    assert.equal(browses.length, 9)
    // Cap is 6/day at 5 XP.
    assert.equal(browses.reduce((sum: number, entry: any) => sum + entry.xp, 0), 30)
  })

  it('refuses a client-claimed bonus', async () => {
    const token = await signIn('uj/2021/xp/0002')
    const { status } = await call('/api/activity', {
      method: 'POST',
      token,
      body: JSON.stringify({ kind: 'weekly_goal_bonus' }),
    })
    assert.equal(status, 400)
  })

  it('pays the weekly bonus once the goal is met, and only once', async () => {
    const token = await signIn('uj/2021/xp/0003')

    // 3 borrows = 150 XP, which meets the 150 XP weekly goal.
    for (const resourceId of ['koha-103771', 'koha-104233', 'koha-105112']) {
      await call('/api/activity', {
        method: 'POST',
        token,
        body: JSON.stringify({ kind: 'physical_borrow', resourceId }),
      })
    }

    let ledger = await call('/api/activity', { token })
    const bonuses = ledger.body.activities.filter((entry: any) => entry.kind === 'weekly_goal_bonus')
    assert.equal(bonuses.length, 1)
    assert.equal(ledger.body.totalXp, 150 + 40)

    await call('/api/activity', {
      method: 'POST',
      token,
      body: JSON.stringify({ kind: 'physical_borrow', resourceId: 'koha-104987' }),
    })
    ledger = await call('/api/activity', { token })
    assert.equal(
      ledger.body.activities.filter((entry: any) => entry.kind === 'weekly_goal_bonus').length,
      1,
    )
  })

  it('keeps one borrower XP out of another ledger', async () => {
    const mine = await signIn('uj/2021/xp/0004')
    const theirs = await signIn('uj/2021/xp/0005')
    await call('/api/activity', {
      method: 'POST',
      token: mine,
      body: JSON.stringify({ kind: 'physical_borrow', resourceId: 'koha-103771' }),
    })

    const other = await call('/api/activity', { token: theirs })
    assert.equal(other.body.totalXp, 0)
  })
})

describe('xp transfers', () => {
  const SENDER = 'uj/2021/xfer/0001'
  const RECIPIENT = 'uj/2021/xfer/0002'

  it('names the recipient before any XP moves', async () => {
    const token = await signIn(SENDER)
    const { status, body } = await call(`/api/activity/members/${encodeURIComponent(RECIPIENT)}`, {
      token,
    })
    assert.equal(status, 200)
    assert.ok(body.id)
    assert.ok(body.name)
    assert.ok(body.department)
    // A directory lookup must not leak contact details out of the borrower file.
    assert.deepEqual(Object.keys(body).sort(), ['department', 'id', 'name'])
  })

  it('refuses a member their own account as a recipient', async () => {
    const token = await signIn(SENDER)
    const { status } = await call(`/api/activity/members/${encodeURIComponent(SENDER)}`, { token })
    assert.equal(status, 409)
  })

  it('delivers XP to the recipient, and only to the recipient', async () => {
    const sender = await signIn(SENDER)
    const recipient = await signIn(RECIPIENT)

    const sent = await call('/api/activity/transfers', {
      method: 'POST',
      token: sender,
      body: JSON.stringify({ identifier: RECIPIENT, amount: 200, note: 'For the group project' }),
    })
    assert.equal(sent.status, 201)
    assert.equal(sent.body.amount, 200)

    const senderInbox = await call('/api/activity/transfers/claim', { method: 'POST', token: sender })
    assert.deepEqual(senderInbox.body, [])

    const claimed = await call('/api/activity/transfers/claim', { method: 'POST', token: recipient })
    assert.equal(claimed.body.length, 1)
    assert.equal(claimed.body[0].amount, 200)
    assert.equal(claimed.body[0].note, 'For the group project')
    assert.equal(claimed.body[0].id, sent.body.transferId)
  })

  it('clears the inbox on claim, so a reload cannot credit the same XP twice', async () => {
    const sender = await signIn('uj/2021/xfer/0003')
    const recipient = await signIn('uj/2021/xfer/0004')
    await call('/api/activity/transfers', {
      method: 'POST',
      token: sender,
      body: JSON.stringify({ identifier: 'uj/2021/xfer/0004', amount: 100 }),
    })

    const first = await call('/api/activity/transfers/claim', { method: 'POST', token: recipient })
    assert.equal(first.body.length, 1)
    const second = await call('/api/activity/transfers/claim', { method: 'POST', token: recipient })
    assert.deepEqual(second.body, [])
  })

  it('rejects an amount below the minimum', async () => {
    const token = await signIn(SENDER)
    const { status } = await call('/api/activity/transfers', {
      method: 'POST',
      token,
      body: JSON.stringify({ identifier: RECIPIENT, amount: 10 }),
    })
    assert.equal(status, 400)
  })

  it('enforces the weekly ceiling on the server, whatever the client believes', async () => {
    const token = await signIn('uj/2021/xfer/0005')
    const to = 'uj/2021/xfer/0006'

    const first = await call('/api/activity/transfers', {
      method: 'POST',
      token,
      body: JSON.stringify({ identifier: to, amount: 1000 }),
    })
    assert.equal(first.status, 201)

    const second = await call('/api/activity/transfers', {
      method: 'POST',
      token,
      body: JSON.stringify({ identifier: to, amount: 50 }),
    })
    assert.equal(second.status, 409)
    assert.match(second.body.message, /weekly limit/i)
  })

  it('requires a session', async () => {
    const { status } = await call('/api/activity/transfers', {
      method: 'POST',
      body: JSON.stringify({ identifier: RECIPIENT, amount: 100 }),
    })
    assert.equal(status, 401)
  })
})

describe('unknown routes', () => {
  it('404s with JSON rather than HTML', async () => {
    const { status, body } = await call('/api/nope')
    assert.equal(status, 404)
    assert.ok(body.message)
  })
})
