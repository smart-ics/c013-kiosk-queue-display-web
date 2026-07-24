import type { IAuthTokenProvider } from '@aq/auth'
import { MissingAuthTokenError } from '@aq/auth'
import { z } from 'zod'
import { ApiClientError } from './errors'

const jsendSuccessSchema = z.object({
  status: z.literal('success'),
  data: z.unknown(),
})

const jsendFailOrErrorSchema = z.object({
  status: z.enum(['fail', 'error']),
  message: z.string().optional(),
  code: z.string().optional(),
  data: z.unknown().optional(),
})

export type AdmissionQueueClientOptions = {
  baseUrl: string
  auth: IAuthTokenProvider
  fetchImpl?: typeof fetch
}

export class AdmissionQueueClient {
  private readonly baseUrl: string
  private readonly auth: IAuthTokenProvider
  private readonly fetchImpl: typeof fetch

  constructor(options: AdmissionQueueClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '')
    this.auth = options.auth
    this.fetchImpl = options.fetchImpl ?? fetch.bind(globalThis)
  }

  async getJson<T>(path: string, schema: z.ZodType<T>, query?: Record<string, string | boolean | number>): Promise<T> {
    const url = new URL(`${this.baseUrl}/${path.replace(/^\//, '')}`)
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        url.searchParams.set(key, String(value))
      }
    }
    return this.request(url.toString(), { method: 'GET' }, schema)
  }

  async postJson<T>(path: string, body: unknown, schema: z.ZodType<T>): Promise<T> {
    const url = `${this.baseUrl}/${path.replace(/^\//, '')}`
    return this.request(
      url,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
      schema,
    )
  }

  async putJson<T>(path: string, body: unknown, schema: z.ZodType<T>): Promise<T> {
    const url = `${this.baseUrl}/${path.replace(/^\//, '')}`
    return this.request(
      url,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
      schema,
    )
  }

  private async request<T>(
    url: string,
    init: RequestInit,
    schema: z.ZodType<T>,
    options?: { requireAuth?: boolean },
  ): Promise<T> {
    const requireAuth = options?.requireAuth !== false
    const headers = new Headers(init.headers)
    if (requireAuth) {
      const token = this.auth.getToken()
      if (!token) throw new MissingAuthTokenError()
      headers.set('Authorization', `Bearer ${token}`)
    }
    headers.set('Accept', 'application/json')

    let response: Response
    try {
      response = await this.fetchImpl(url, { ...init, headers })
    } catch (error) {
      throw new ApiClientError(
        error instanceof Error ? error.message : 'Network request failed',
        0,
      )
    }

    const text = await response.text()
    let payload: unknown = undefined
    if (text) {
      try {
        payload = JSON.parse(text) as unknown
      } catch {
        throw new ApiClientError('Response is not valid JSON', response.status, undefined, text)
      }
    }

    if (!response.ok) {
      const fail = jsendFailOrErrorSchema.safeParse(payload)
      const code = fail.success ? fail.data.code : undefined
      const message =
        (fail.success && fail.data.message) || `Request failed with status ${response.status}`
      throw new ApiClientError(message, response.status, code, payload)
    }

    const success = jsendSuccessSchema.safeParse(payload)
    if (!success.success) {
      throw new ApiClientError('Unexpected success envelope', response.status, undefined, payload)
    }

    const parsed = schema.safeParse(success.data.data)
    if (!parsed.success) {
      throw new ApiClientError(
        `Response data validation failed: ${parsed.error.message}`,
        response.status,
      )
    }
    return parsed.data
  }
}
