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

  async getJson<T>(
    path: string,
    schema: z.ZodType<T, any, any>,
    query?: Record<string, string | boolean | number>,
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}/${path.replace(/^\//, '')}`)
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        url.searchParams.set(key, String(value))
      }
    }
    return this.request(url.toString(), { method: 'GET' }, schema)
  }

  async getPublicJson<T>(
    path: string,
    schema: z.ZodType<T>,
    query?: Record<string, string | boolean | number>,
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}/${path.replace(/^\//, '')}`)
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        url.searchParams.set(key, String(value))
      }
    }
    return this.request(url.toString(), { method: 'GET' }, schema, { requireAuth: false })
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

  async patchJson<T>(path: string, body: unknown, schema: z.ZodType<T>): Promise<T> {
    const url = `${this.baseUrl}/${path.replace(/^\//, '')}`
    return this.request(
      url,
      {
        method: 'PATCH',
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
      const message =
        (fail.success && fail.data.message) ||
        (typeof payload === 'object' && payload !== null && 'data' in payload &&
          typeof (payload as Record<string, unknown>).data === 'string'
          ? (payload as Record<string, string>).data
          : `Request failed with status ${response.status}`)
      const code =
        (fail.success && fail.data.code) ||
        (typeof payload === 'object' && payload !== null && 'status' in payload
          ? String((payload as Record<string, unknown>).status)
          : undefined)
      throw new ApiClientError(message, response.status, code, payload)
    }

    const success = jsendSuccessSchema.safeParse(payload)
    if (!success.success) {
      throw new ApiClientError('Unexpected success envelope', response.status, undefined, payload)
    }

    // Some Bilreg deployments return JSend's payload directly while older
    // deployments wrap it once more as { data: payload }. Accept both forms
    // during the API transition.
    const envelopeData = success.data.data
    const responseData =
      envelopeData &&
      typeof envelopeData === 'object' &&
      !Array.isArray(envelopeData) &&
      'data' in envelopeData
        ? (envelopeData as { data: unknown }).data
        : envelopeData
    const parsed = schema.safeParse(responseData)
    if (!parsed.success) {
      throw new ApiClientError(
        `Response data validation failed: ${parsed.error.message}`,
        response.status,
      )
    }
    return parsed.data
  }
}
