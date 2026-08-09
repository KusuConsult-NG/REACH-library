# REACH — University of Jos Library

**R**esource · **E**ngagement · **A**cademic · **C**ommunity · **H**ub

An installable Progressive Web App that puts the University of Jos Library into students' and
researchers' daily workflow: search the catalogue, borrow and renew books, reach subscribed
e-resources and the institutional repository, book a study space — and earn XP for every genuine
interaction with a library resource.

The PWA covers the full MVP scope of the REACH product requirements document, and runs on seeded
local data out of the box so it can be installed, demonstrated and usability-tested before the Koha
and SSO integrations are live.

---

## Quick start

```bash
npm install
npm run dev          # http://localhost:5173
```

Sign in with any username and a password of four characters or more — the bundled demo backend
issues a session and derives a plausible borrower profile from the credential. A username starting
`pg` is treated as a postgraduate, `dr`/`prof`/`staff` as faculty; that changes the loan allowance
and loan period.

```bash
npm run build        # typecheck + production build into dist/
npm run preview      # serve the production build (service worker active)
npm test             # 64 unit / integration tests (and `cd server && npm test` for 28 more)
```

The service worker is only registered in a production build, so use `npm run preview` to exercise
installability and offline behaviour.

## What is implemented

| PRD section | Status in this build |
| --- | --- |
| 3.1 Authentication & profile | Sign-in, borrower profile, XP level, current loans, privacy controls |
| 3.2 Resource discovery & access | Catalogue search with facets, filters and sorting; borrowing, holds, renewals, loan history; e-resource access with proxy pass-through |
| 3.3 XP reward system | All five PRD earning rules, 15 levels, activity log, weekly goals with bonus, daily caps |
| 3.4 Notifications | Due-date reminders, overdue notices, hold-ready, new resources by interest, XP milestones, announcements, return confirmations |
| 3.5 Social features | Following, trending by subject, de-identified activity feed, per-feature privacy controls |
| 3.6 Practical tools | Hours and contacts, study-space availability and booking, librarian consultation form, floor maps, FAQs |
| 4.1 Platform support | Installable PWA — one build serves Android, iOS and desktop |
| 4.3 Performance | ~96 KB gzipped JS, cached shell, offline-readable core screens, queued offline actions |
| 4.4 Security | Token-based sessions, no credentials in the client, backend proxy holds the Koha API key |
| 5.1 Accessibility | WCAG 2.1 AA contrast in both themes, keyboard-operable dialogs, labelled controls, visible focus, reduced-motion support |

### XP rules

| Activity | XP | Daily cap |
| --- | --- | --- |
| Browse a catalogue record (OPAC) | 5 | 6 |
| Open an electronic resource | 10 | 12 |
| Download a resource | 20 | 10 |
| Reserve a book | 30 | — |
| Borrow a physical book | 50 | — |
| Weekly goal met | 40 bonus | once per ISO week |

Daily caps are a deliberate addition to the PRD's table: without them the repeatable actions reward
tab-refreshing rather than engagement. Capped activities are still recorded in the activity log, at
zero XP, so the dashboard stays honest about what the user did. All values live in
[`src/config/xp.ts`](src/config/xp.ts).

## Architecture

```
src/            The PWA
  app/          Redux store, persistence middleware, typed hooks
  components/   App shell, icons, shared primitives, XP and resource cards
  config/       XP values, caps, level thresholds
  features/     One folder per domain: auth, catalogue, circulation, xp,
                notifications, social, offline sync, ui
  screens/      One component per route
  services/     API abstraction (mock + Koha adapters), storage helpers
  styles/       Design tokens, base styles, component styles

server/         The API proxy in front of Koha and the university IdP
  src/routes/   auth, catalogue, circulation, spaces, consultations, activity
  src/koha/     Koha REST client and record mapping
  src/fixtures/ Dev catalogue, so the stack runs before credentials exist
```

**The API boundary is the important seam.** Every screen and slice depends only on the `LibraryApi`
interface in [`src/services/api/types.ts`](src/services/api/types.ts). Two implementations satisfy
it:

- `MockLibraryApi` — seeded catalogue, circulation rules, holds, bookings, persisted to
  `localStorage`. Used whenever `VITE_API_BASE_URL` is unset.
- `KohaLibraryApi` — calls the REACH Express proxy in [`server/`](server), which fronts Koha's REST
  API and the university IdP. See [`docs/BACKEND.md`](docs/BACKEND.md) for the route contract.

Switching between them changes no UI code.

### Running the full stack

The proxy starts in fixture mode with no configuration, so both halves run together today:

```bash
cd server && npm install && npm start        # http://localhost:8080
# in another shell, from the repository root:
VITE_API_BASE_URL=http://localhost:8080/api npm run dev
```

Set `CORS_ORIGINS=http://localhost:5173` for the proxy so the browser is allowed to call it. See
[`server/README.md`](server/README.md) for going live against real Koha and SSO credentials.

### State and persistence

Redux Toolkit holds all app state. A middleware persists the user-owned slices (profile,
preferences, XP, loans, notifications) plus the theme and the offline queue, debounced and flushed
on `pagehide`, so a backgrounded app never loses a queued action.

### Offline behaviour

- The app shell, catalogue reads and images are cached by Workbox.
- Loans, saved records, recently viewed items and the XP log stay readable with no connection.
- Renewals and reservations made offline are applied locally and queued; the queue is replayed in
  order on reconnection. Operations the server permanently rejects are dropped so the queue cannot
  wedge.
- Borrowing a physical copy always requires a connection — the item has to be issued.

### Privacy

Borrowing history is sensitive. Activity sharing is **off by default**, the activity feed names a
cohort ("a postgraduate in Law") and never a person, and every social surface has its own switch in
Settings.

## Configuration

Copy `.env.example` to `.env.local`:

| Variable | Effect |
| --- | --- |
| `VITE_API_BASE_URL` | Point at the REACH proxy; unset means run on seeded local data |
| `VITE_PROXY_BASE` | EZproxy-style prefix for off-campus e-resource access |
| `REACH_BASE` | Build-time base path, e.g. `/REACH-library/` for a project GitHub Pages site |

## Deployment

`npm run build` produces a static `dist/` — any static host will serve it. The included workflow
(`.github/workflows/deploy.yml`) publishes to GitHub Pages on push to `main`. For a production
deployment, host it alongside the API proxy on university infrastructure so e-resource
authentication and the Koha calls share an origin.

A PWA must be served over HTTPS for the service worker to register.

## Branding

### Colours

The palette follows the University of Jos branding used by the earlier REACH app
([KusuConsult-NG/Reach-old](https://github.com/KusuConsult-NG/Reach-old)): **sky blue as the
primary, deep navy as the accent, no gold**. Colours are tokens in
[`src/styles/tokens.css`](src/styles/tokens.css).

Two values from that app are used differently here, because they do not pass a contrast check:

| Source value | Problem | What this app does |
| --- | --- | --- |
| `#0EA5E9` sky, with white text | 2.77:1 — fails AA | Sky is the chrome and tint colour; `#0369A1` (5.93:1) carries white text |
| `#10B981` emerald, as text | 2.54:1 on white — fails AA | Emerald stays a fill; `#047857` is used for text |

The chrome surfaces (`--topbar-*`, `--hero-*`, `--auth-*`) carry their own foreground token rather
than inheriting `--text`, because the app bar and XP hero flip from sky blue with navy text in
light mode to navy with white text in dark mode. Both directions are checked at AA, so if you
re-tint them, re-check the pairs.

### The university emblem

The official assets, taken from the earlier app, live in two files:

| File | Where it appears |
| --- | --- |
| `public/logo-unijos.png` | The crest, cropped from the official wordmark and scaled. App bar, and anywhere a square mark is needed |
| `public/logo-unijos-wordmark.png` | The full "University of Jos" wordmark. Sign-in screen |

Replace either file and every surface picks it up — `UniversityLogo` and `UniversityWordmark` in
[`src/components/UniversityLogo.tsx`](src/components/UniversityLogo.tsx) read from those paths and
nothing else changes. The crest is also composited onto navy to produce the installed-app icons in
`public/icons/` and the favicon; re-run the generator or replace those PNGs directly if the source
artwork changes.

## Not in this build

Phase 2 and 3 items from the PRD — badges, challenges and leaderboards beyond the XP core,
AI-powered recommendations, researcher portfolios, citation management, forums, the grants database
and the researcher analytics dashboard. The XP and social models were shaped with them in mind.
