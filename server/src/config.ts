import { randomBytes } from 'node:crypto'

function required(name: string, value: string | undefined, fallback?: string): string {
  if (value && value.trim()) return value.trim()
  if (fallback !== undefined) return fallback
  throw new Error(`${name} must be set`)
}

function list(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

const env = process.env

export const config = {
  port: Number(env.PORT ?? 8080),
  nodeEnv: env.NODE_ENV ?? 'development',

  /**
   * Secret used to sign session tokens. A generated value is fine for local
   * development but useless across restarts or replicas, so production must
   * supply one — startup refuses to continue without it.
   */
  sessionSecret: (() => {
    if (env.SESSION_SECRET?.trim()) return env.SESSION_SECRET.trim()
    if (env.NODE_ENV === 'production') {
      throw new Error('SESSION_SECRET must be set in production')
    }
    return randomBytes(32).toString('hex')
  })(),
  sessionTtlSeconds: Number(env.SESSION_TTL_SECONDS ?? 60 * 60 * 12),

  /** Origins allowed to call this API. Empty means same-origin only. */
  corsOrigins: list(env.CORS_ORIGINS),

  koha: {
    /** Unset runs the fixture-backed catalogue — dev and integration only. */
    baseUrl: env.KOHA_BASE_URL?.trim() ?? '',
    clientId: env.KOHA_CLIENT_ID?.trim() ?? '',
    clientSecret: env.KOHA_CLIENT_SECRET?.trim() ?? '',
    /** Seconds to subtract from a token's lifetime before refreshing it. */
    tokenSkewSeconds: Number(env.KOHA_TOKEN_SKEW_SECONDS ?? 30),
    timeoutMs: Number(env.KOHA_TIMEOUT_MS ?? 8000),
  },

  idp: {
    /** Unset accepts any credential — dev only, and logged loudly at boot. */
    tokenUrl: env.IDP_TOKEN_URL?.trim() ?? '',
    userInfoUrl: env.IDP_USERINFO_URL?.trim() ?? '',
    clientId: env.IDP_CLIENT_ID?.trim() ?? '',
    clientSecret: env.IDP_CLIENT_SECRET?.trim() ?? '',
  },

  /** JSON file holding data no other system owns: bookings, consultations, XP. */
  dataFile: required('DATA_FILE', env.DATA_FILE, 'data/reach.json'),
} as const

export const usingLiveKoha = Boolean(config.koha.baseUrl)
export const usingLiveIdp = Boolean(config.idp.tokenUrl)
