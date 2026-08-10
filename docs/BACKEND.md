# REACH backend contract

> **Implemented in [`server/`](../server).** This document is the contract; the proxy that satisfies
> it lives in `server/` and runs today against a fixture catalogue when Koha credentials are absent.
> Change one, change the other.

The PWA never talks to Koha directly. Koha's REST API needs credentials that must not reach a
browser, and its CORS posture assumes server-to-server use. A small Node/Express proxy sits between
them, holds the Koha API key, performs the OAuth 2.0 exchange with the university identity
provider, and normalises Koha's MARC-flavoured payloads into the shapes in
[`src/types.ts`](../src/types.ts).

Set `VITE_API_BASE_URL` to the proxy's base (for example `https://reach-api.unijos.edu.ng/api`) and
`KohaLibraryApi` in [`src/services/api/koha.ts`](../src/services/api/koha.ts) takes over from the
seeded demo backend. No UI code changes.

## Authentication

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| POST | `/auth/login` | `{ username, password }` | `{ user, token, expiresAt }` |
| POST | `/auth/logout` | — | `204` |

The proxy exchanges the credential with the university IdP, maps the resulting identity onto the
Koha borrower record (`borrowerNumber`), and returns a short-lived bearer token. Every subsequent
request carries `Authorization: Bearer <token>`. A `401` puts the app back on the sign-in screen.

`user` must match the `User` interface: `id`, `username`, `name`, `email`, `role`
(`undergraduate | postgraduate | faculty | staff | visiting`), `department`, `faculty`,
`avatarInitials`, `borrowerNumber`, `joinedAt`.

## Catalogue

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/catalogue/search` | Query params: `q`, `type`, `subject`, `available`, `repository`, `sort`, `page`, `pageSize`. `type` and `subject` are comma-separated. Returns `SearchResult`. |
| GET | `/catalogue/:id` | One `Resource`. |
| GET | `/catalogue/batch?ids=a,b,c` | `Resource[]`, for rehydrating cached ids. |
| GET | `/catalogue/trending?department=` | `TrendingEntry[]` from the REACH analytics store. |

`SearchResult` carries `items`, `total`, `page`, `pageSize` and `facets` (`types`, `subjects` with
counts). Facet counts drive the filter sheet, so compute them over the filtered set, not the page.

Backed by Koha `GET /biblios` and `GET /biblios/{biblio_id}`. Map `biblionumber` onto
`Resource.biblionumber`, item availability onto `copiesTotal` / `copiesAvailable`, and leave both
undefined for born-digital records — the UI uses that to decide between "borrow" and "open".

## Circulation

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| GET | `/circulation/loans` | — | `Loan[]` |
| GET | `/circulation/holds` | — | `Hold[]` |
| POST | `/circulation/checkout` | `{ resourceId }` | `Loan` |
| POST | `/circulation/loans/:id/renew` | — | `Loan` |
| POST | `/circulation/loans/:id/return` | — | `Loan` |
| POST | `/circulation/holds` | `{ resourceId }` | `Hold` |
| DELETE | `/circulation/holds/:id` | — | `204` |

Backed by Koha `GET /patrons/{patron_id}/checkouts`, `POST /checkouts`, `POST /checkouts/{id}/allows_renewal`,
and the holds endpoints. The proxy is responsible for enforcing loan limits and renewal caps and
for returning `maxRenewals` on every `Loan`, since the client shows the remaining count.

### Status codes the client depends on

| Status | Client behaviour |
| --- | --- |
| `401` | Session expired — returns to sign-in |
| `404` | "That record could not be found" |
| `409` | Treated as `unavailable` — e.g. all copies out, slot just taken |
| other `4xx`/`5xx` | Generic failure; the `{ message }` field is shown if present |

Network failure is reported as `offline`, which is what makes the app queue the operation rather
than discard it.

### Idempotency

Renewals, returns and holds are replayed from the offline queue on reconnection, so they must be
safe to repeat. A duplicate renewal should either succeed idempotently or fail with a permanent
error (not a `5xx`) — the client drops permanently-rejected operations so the queue cannot wedge,
but retries transient ones.

## Spaces and consultations

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| GET | `/spaces` | — | `StudySpace[]` with `bookedSlots` for today |
| GET | `/spaces/bookings` | — | `SpaceBooking[]` for the signed-in user |
| POST | `/spaces/bookings` | `{ spaceId, date, slot }` | `SpaceBooking` |
| DELETE | `/spaces/bookings/:id` | — | `204` |
| POST | `/consultations` | `{ topic, details, preferredMode, preferredDate }` | `ConsultationRequest` |

## E-resource access

Electronic resources carry a `url`. When `VITE_PROXY_BASE` is set and the URL is external, the
client opens `${VITE_PROXY_BASE}${encodeURIComponent(url)}` so EZproxy (or equivalent) applies the
institutional entitlement off campus. Openly accessible resources can be listed without a proxy
prefix by keeping them relative or by leaving `VITE_PROXY_BASE` unset.

## XP and analytics

The proxy owns the XP ledger:

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| GET | `/activity` | — | `{ activities, totalXp, level }` |
| POST | `/activity` | `{ kind, resourceId?, resourceTitle? }` | `{ activity, bonus?, totalXp, level, earned }` |

`kind` may only be one of the five earning kinds — `opac_browse`, `eresource_access`,
`resource_download`, `reservation`, `physical_borrow`. The weekly bonus is awarded server-side, or
a client could simply post itself one. Daily caps are applied here too; a capped activity is still
recorded, at zero XP. Checkouts and holds feed the ledger automatically.

**The PWA does not consume these endpoints yet.** It keeps a local ledger so the dashboard works
offline, which makes XP per-device for now. The client funnels every XP-bearing interaction through
one thunk (`recordEngagement` in [`src/features/xp/engagement.ts`](../src/features/xp/engagement.ts)),
so the migration is contained — but it has to reconcile a local ledger with the server's without
breaking offline use, which is a change of its own.

## XP transfers

Members can pass spendable XP to one another. Only the wallet moves: lifetime XP stays in the
activity ledger with whoever earned it, so a transfer cannot manufacture engagement and the level and
§6 reporting figures stay honest.

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| GET | `/activity/members/:identifier` | — | `{ id, name, department }` |
| POST | `/activity/transfers` | `{ identifier, amount, note? }` | `{ transferId, recipient, amount, at }` |
| POST | `/activity/transfers/claim` | — | `IncomingTransfer[]` |

The lookup exists so the sender sees who they are about to pay before any XP moves — a mistyped
matriculation number would otherwise send credit to a stranger with no way back. It returns the
minimum needed to recognise a colleague and never an email, phone number or address, so the endpoint
cannot be walked to reconstruct the borrower file. It answers `409` for the caller's own account and
`404` for an unknown number.

Ceilings are enforced on the server, not in the browser: a minimum of 50 XP per transfer and 1,000 XP
sent per ISO week per borrower (`server/src/transfers.ts`; keep in step with
[`src/config/transfers.ts`](../src/config/transfers.ts)). Below the minimum is `400`; over the weekly
ceiling is `409` with the remaining allowance in the message.

Delivery is by inbox rather than by push: a transfer is parked against the recipient's borrower
number, and their device collects it on next sign-in. Claiming clears the inbox in the same write, so
a reload cannot credit the same transfer twice.

The spendable balance itself is still client-side, because redemptions are — the server enforces
identity, the minimum and the weekly ceiling, and the wallet arithmetic moves here when vouchers do.

## Push notifications

In-app notifications are derived from state on every launch
([`src/features/notifications/reminders.ts`](../src/features/notifications/reminders.ts)), which is
what keeps the notification centre correct offline. Delivery to a backgrounded device is a server
concern: the PRD specifies Firebase Cloud Messaging, driven by the same due-date and hold-ready
events the proxy already knows about.

## Security notes

- The Koha API key lives only on the proxy. Never ship it to the client.
- Tokens are short-lived; the proxy should refresh against the IdP rather than issuing long-lived
  bearers.
- Borrowing history is personal data under the university data protection policy. The trending and
  feed endpoints must return aggregates and cohort labels only — never a name attached to a title.
