import { describe, expect, it, vi } from 'vitest'
import { createPrintProxyClient, resolvePrintProxyBaseUrl } from '../printProxy'

describe('resolvePrintProxyBaseUrl', () => {
  it('defaults to port 5050', () => {
    expect(resolvePrintProxyBaseUrl()).toBe('http://localhost:5050/print')
  })

  it('uses configured port', () => {
    expect(resolvePrintProxyBaseUrl(5800)).toBe('http://localhost:5800/print')
  })
})

describe('createPrintProxyClient', () => {
  it('prints PNG with query params and returns success', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/health')) {
        return new Response(JSON.stringify({ status: 'ok', printerCount: 1 }), { status: 200 })
      }
      expect(url).toContain('type=image')
      expect(url).toContain('doctype=antrian')
      expect(init?.method).toBe('POST')
      expect(init?.headers).toMatchObject({ 'Content-Type': 'image/png' })
      return new Response(JSON.stringify({ jobId: 'job-1' }), { status: 200 })
    }) as unknown as typeof fetch

    const client = createPrintProxyClient({ port: 5050, fetchImpl })
    const health = await client.checkHealth()
    expect(health).toBeNull()

    const result = await client.printPng(new Blob(['png'], { type: 'image/png' }))
    expect(result).toEqual({ success: true, jobId: 'job-1', isNetworkError: false })
  })

  it('marks network failures', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('Failed to fetch')
    }) as unknown as typeof fetch

    const client = createPrintProxyClient({ fetchImpl })
    const result = await client.printPng(new Blob(['png'], { type: 'image/png' }))
    expect(result.success).toBe(false)
    expect(result.isNetworkError).toBe(true)
  })
})
