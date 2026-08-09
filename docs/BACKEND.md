# REACH backend contract

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

XP is computed and stored client-side in this build. For cross-device XP and for the library-impact
metrics in PRD §6, the proxy should expose an activity endpoint and become the source of truth:

```
POST /activity   { kind, resourceId, at }   -> { totalXp, level }
GET  /activity                              -> Activity[]
```

The client already funnels every XP-bearing interaction through a single thunk
(`recordEngagement` in [`src/features/xp/engagement.ts`](../src/features/xp/engagement.ts)), so
that migration touches one file. Daily caps and the weekly bonus should move server-side at the
same time, since a client-side cap is advisory.

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
