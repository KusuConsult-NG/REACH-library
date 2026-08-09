# REACH API proxy

The server the REACH PWA talks to. It fronts Koha's REST API and the University
of Jos identity provider, so the browser never holds a Koha API key and never
sees a credential beyond the user's own.

The route contract it implements is [`../docs/BACKEND.md`](../docs/BACKEND.md).

## Run it

```bash
npm install
npm test          # 28 end-to-end tests over the real Express app
npm run build
npm start         # http://localhost:8080
```

With no configuration it starts in **fixture mode**: a small in-memory
catalogue and development identities, so you can run the whole stack before
Koha credentials exist. `GET /api/health` reports which mode it is in.

```bash
curl localhost:8080/api/health
# {"status":"ok","koha":"fixture","idp":"development"}
```

Point the PWA at it by building the web app with
`VITE_API_BASE_URL=http://localhost:8080/api`, and set
`CORS_ORIGINS=http://localhost:5173` here so the browser is allowed to call it.

## Going live

Copy `.env.example` to `.env` and fill in:

| Variable | Effect |
| --- | --- |
| `SESSION_SECRET` | Signs session tokens. **Required** in production — startup fails without it |
| `KOHA_BASE_URL`, `KOHA_CLIENT_ID`, `KOHA_CLIENT_SECRET` | Switches the catalogue and circulation to Koha |
| `IDP_TOKEN_URL`, `IDP_USERINFO_URL`, `IDP_CLIENT_ID`, `IDP_CLIENT_SECRET` | Switches sign-in to the university IdP |
| `CORS_ORIGINS` | Comma-separated origins allowed to call the API |
| `DATA_FILE` | Where bookings, consultations and the XP ledger are stored |

With `NODE_ENV=production` the process **refuses to start** without
`SESSION_SECRET`, and refuses to accept development identities without
`IDP_TOKEN_URL`. Those are the two configuration mistakes that would otherwise
be invisible and severe.

## How it is put together

```
src/
  app.ts            Express app factory — wiring only, so tests build the real app
  index.ts          Process entry: listen, log the active mode, drain on SIGTERM
  config.ts         Environment parsing and the production guards
  session.ts        HMAC-signed stateless bearer tokens (no JWT dependency)
  idp.ts            Credential exchange; development identities when unset
  service.ts        The LibraryService interface, loan policy, search pipeline
  koha/             REST client (token caching, retry, timeouts) + record mapping
  fixtures/         The dev catalogue and an in-memory circulation implementation
  routes/           auth, catalogue, circulation, spaces, consultations, activity
  store.ts          Durable JSON store, written atomically
  xp.ts             Server-side XP: values, daily caps, weekly bonus, levels
```

Routes depend on the `LibraryService` interface, so Koha and the fixture are
interchangeable and the tests exercise the same code paths a deployment does.

### Things worth knowing

- **Koha decides.** Loan limits and renewals are Koha's call; `LOAN_RULES` here
  only fills in what Koha does not report, and drives the fixture.
- **Status codes are load-bearing.** The PWA queues an offline action and
  replays it, so `409` means "permanently rejected, drop it" and `5xx` means
  "transient, keep it queued". Never return `5xx` for a business rule.
- **Replayed holds are idempotent.** Posting a hold that already exists returns
  the existing one with `200` rather than an error, because that is the offline
  queue catching up rather than a new request.
- **XP is the server's.** Clients may claim only the five earning kinds; the
  weekly bonus is awarded here. Client-side caps are advisory by nature.
- **Ownership is checked, not assumed.** Another borrower's booking is reported
  as `404`, so the endpoint cannot be used to probe for it.

## Not done yet

- **The PWA still keeps its own XP ledger.** The endpoints here (`/api/activity`)
  are live and circulation already feeds them, but the client does not yet read
  from or post to them, so XP remains per-device. Reconciling the two needs to
  keep working offline, so it is a change of its own.
- **Push delivery.** Due-date and hold-ready events are known here; nothing
  sends them to a device yet (the PRD specifies Firebase Cloud Messaging).
- **Rate limiting and audit logging** — deploy behind something that provides
  them, or add them here before going live.
