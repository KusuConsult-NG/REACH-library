import { buildApp } from './app.js'
import { config, usingLiveIdp, usingLiveKoha } from './config.js'

const app = await buildApp()

const server = app.listen(config.port, () => {
  console.log(`[reach-api] listening on :${config.port}`)
  console.log(`[reach-api] catalogue: ${usingLiveKoha ? config.koha.baseUrl : 'fixture (no KOHA_BASE_URL)'}`)
  if (!usingLiveIdp) {
    console.warn('[reach-api] IDP_TOKEN_URL is unset — accepting development identities. Never do this in production.')
  }
})

// Finish in-flight requests before exiting, so a deploy cannot drop a
// checkout halfway through.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    console.log(`[reach-api] ${signal} received, shutting down`)
    server.close(() => process.exit(0))
    setTimeout(() => process.exit(1), 10_000).unref()
  })
}
