import { config } from '../config.js'
import { HttpError } from '../errors.js'

/**
 * Minimal Koha REST client.
 *
 * Koha issues OAuth 2.0 client-credentials tokens from
 * `/api/v1/oauth/token`. The token is cached until shortly before it expires
 * and refreshed on demand, so a burst of requests shares one token rather than
 * one exchange each.
 */
export class KohaClient {
  private token: { value: string; expiresAt: number } | null = null
  private inflight: Promise<string> | null = null

  constructor(
    private readonly baseUrl: string,
    private readonly clientId: string,
    private readonly clientSecret: string,
  ) {}

  private async accessToken(): Promise<string> {
    const now = Date.now()
    if (this.token && this.token.expiresAt > now) return this.token.value
    // Collapse concurrent refreshes into one exchange.
    if (this.inflight) return this.inflight

    this.inflight = (async () => {
      const body = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.clientId,
        client_secret: this.clientSecret,
      })

      const response = await this.fetchWithTimeout(`${this.baseUrl}/api/v1/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      })

      if (!response.ok) {
        throw HttpError.upstream('The library catalogue could not be reached (authentication failed).')
      }

      const payload = (await response.json()) as { access_token: string; expires_in?: number }
      const ttl = (payload.expires_in ?? 3600) - config.koha.tokenSkewSeconds
      this.token = { value: payload.access_token, expiresAt: Date.now() + Math.max(30, ttl) * 1000 }
      return this.token.value
    })()

    try {
      return await this.inflight
    } finally {
      this.inflight = null
    }
  }

  private async fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), config.koha.timeoutMs)
    try {
      return await fetch(url, { ...init, signal: controller.signal })
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        throw HttpError.upstream('The library catalogue did not respond in time.')
      }
      throw HttpError.upstream()
    } finally {
      clearTimeout(timer)
    }
  }

  /**
   * Call a Koha endpoint. A 401 is retried once with a fresh token, because a
   * cached token can expire between the check and the call.
   */
  async request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
    const token = await this.accessToken()
    const response = await this.fetchWithTimeout(`${this.baseUrl}/api/v1${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...init.headers,
      },
    })

    if (response.status === 401 && retry) {
      this.token = null
      return this.request<T>(path, init, false)
    }
    if (response.status === 404) throw HttpError.notFound()
    if (response.status === 409) {
      throw HttpError.conflict(await this.messageFrom(response, 'That request conflicts with the current record.'))
    }
    if (!response.ok) {
      // 4xx from Koha is a permanent rejection the client should not replay;
      // 5xx is transient and must stay retryable.
      const message = await this.messageFrom(response, 'The library service rejected that request.')
      throw new HttpError(response.status < 500 ? 409 : 502, message)
    }

    if (response.status === 204) return undefined as T
    return (await response.json()) as T
  }

  private async messageFrom(response: Response, fallback: string): Promise<string> {
    try {
      const body = (await response.json()) as { error?: string; message?: string }
      return body.error ?? body.message ?? fallback
    } catch {
      return fallback
    }
  }
}
