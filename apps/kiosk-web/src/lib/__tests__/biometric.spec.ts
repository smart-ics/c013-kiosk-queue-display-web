import { describe, expect, it, vi } from 'vitest'
import { ApiClientError } from '@aq/api-client'
import { createBiometricClient, resolveBiometricBaseUrl } from '../biometric'

describe('resolveBiometricBaseUrl', () => {
  it('defaults to port 5050', () => {
    expect(resolveBiometricBaseUrl()).toBe('http://localhost:5050/biometrik')
  })

  it('uses configured port', () => {
    expect(resolveBiometricBaseUrl(5800)).toBe('http://localhost:5800/biometrik')
  })
})

describe('createBiometricClient', () => {
  it('returns a SUCCESS verdict', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ outcome: 'SUCCESS' }), { status: 200 }),
    ) as unknown as typeof fetch
    const verdict = await createBiometricClient({ fetchImpl }).verify()
    expect(verdict).toEqual({ outcome: 'SUCCESS' })
  })

  it('returns a FAILED verdict', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ outcome: 'FAILED' }), { status: 200 }),
    ) as unknown as typeof fetch
    const verdict = await createBiometricClient({ fetchImpl }).verify()
    expect(verdict).toEqual({ outcome: 'FAILED' })
  })

  it('throws ApiClientError on network failure', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('Failed to fetch')
    }) as unknown as typeof fetch
    await expect(createBiometricClient({ fetchImpl }).verify()).rejects.toBeInstanceOf(
      ApiClientError,
    )
  })
})
