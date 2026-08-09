import express, { type Express } from 'express'
import { config, usingLiveIdp, usingLiveKoha } from './config.js'
import { errorHandler, notFoundHandler } from './errors.js'
import { FixtureLibraryService } from './fixtures/service.js'
import { KohaClient } from './koha/client.js'
import { KohaLibraryService } from './koha/service.js'
import { assertDevIdentityAllowed, type PatronLookup } from './idp.js'
import { activityRoutes } from './routes/activity.js'
import { authRoutes } from './routes/auth.js'
import { catalogueRoutes } from './routes/catalogue.js'
import { circulationRoutes } from './routes/circulation.js'
import { consultationRoutes, spaceRoutes } from './routes/spaces.js'
import type { LibraryService } from './service.js'
import { Store } from './store.js'

export interface BuildOptions {
  /** Pass null to keep everything in memory (tests). */
  dataFile?: string | null
  service?: LibraryService
}

/** Look a borrower up in Koha by card number, to get the patron id. */
function patronLookupFor(koha: KohaClient): PatronLookup {
  return async (cardNumber) => {
    const patrons = await koha
      .request<{ patron_id: number; category_id?: string }[]>(
        `/patrons?cardnumber=${encodeURIComponent(cardNumber)}`,
      )
      .catch(() => [])
    const patron = patrons[0]
    return patron ? { patronId: String(patron.patron_id), category: patron.category_id } : undefined
  }
}

export async function buildApp(options: BuildOptions = {}): Promise<Express> {
  assertDevIdentityAllowed()

  const store = await Store.open(options.dataFile === undefined ? config.dataFile : options.dataFile)

  let service = options.service
  let lookupPatron: PatronLookup | undefined

  if (!service) {
    if (usingLiveKoha) {
      const koha = new KohaClient(config.koha.baseUrl, config.koha.clientId, config.koha.clientSecret)
      service = new KohaLibraryService(koha, store)
      lookupPatron = patronLookupFor(koha)
    } else {
      service = new FixtureLibraryService(store)
    }
  }

  const app = express()
  app.disable('x-powered-by')
  // Behind the university's TLS terminator, so trust its forwarding headers.
  app.set('trust proxy', true)
  app.use(express.json({ limit: '64kb' }))

  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Referrer-Policy', 'no-referrer')
    // This API returns JSON only; nothing here should ever be framed.
    res.setHeader('X-Frame-Options', 'DENY')
    next()
  })

  // CORS, allowlisted. Same-origin deployment needs no entries at all.
  app.use((req, res, next) => {
    const origin = req.header('origin')
    if (origin && config.corsOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin)
      res.setHeader('Vary', 'Origin')
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
      res.setHeader('Access-Control-Max-Age', '600')
    }
    if (req.method === 'OPTIONS') {
      res.status(204).end()
      return
    }
    next()
  })

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      koha: usingLiveKoha ? 'live' : 'fixture',
      idp: usingLiveIdp ? 'live' : 'development',
    })
  })

  app.use('/api/auth', authRoutes(lookupPatron))
  app.use('/api/catalogue', catalogueRoutes(service, store))
  app.use('/api/circulation', circulationRoutes(service, store))
  app.use('/api/spaces', spaceRoutes(store))
  app.use('/api/consultations', consultationRoutes(store))
  app.use('/api/activity', activityRoutes(store))

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
