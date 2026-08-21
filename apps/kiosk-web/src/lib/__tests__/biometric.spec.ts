import { describe, expect, it, vi } from 'vitest'
import { ApiClientError } from '@aq/api-client'
import { createBiometricClient, resolveBiometricBaseUrl } from '../biometric'

describe('resolveBiometricBaseUrl', () => {
  it('defaults to port 5050', () => {
    expect(resolveBiometricBaseUrl()).toBe('http://localhost:5050/biometric')
  })

  it('uses configured port', () => {
    expect(resolveBiometricBaseUrl(5800)).toBe('http://localhost:5800/biometric')
  })
})

describe('createBiometricClient', () => {
  it('returns a SUCCESS verdict', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response('OK', { status: 200 }),
    ) as unknown as typeof fetch
    const verdict = await createBiometricClient({ fetchImpl }).verify('000123456')
    expect(verdict).toEqual({ outcome: 'SUCCESS' })
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://localhost:5050/biometric?noka=000123456',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('returns a FAILED verdict', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response('FAILED', { status: 200 }),
    ) as unknown as typeof fetch
    const verdict = await createBiometricClient({ fetchImpl }).verify('000123456')
    expect(verdict).toEqual({ outcome: 'FAILED' })
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://localhost:5050/biometric?noka=000123456',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('throws ApiClientError on unexpected response with status 200', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response('SOMETHING_ELSE', { status: 200 }),
    ) as unknown as typeof fetch
    await expect(
      createBiometricClient({ fetchImpl }).verify('000123456'),
    ).rejects.toBeInstanceOf(ApiClientError)
  })

  it('throws ApiClientError on network failure', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('Failed to fetch')
    }) as unknown as typeof fetch
    await expect(
      createBiometricClient({ fetchImpl }).verify('000123456'),
    ).rejects.toBeInstanceOf(ApiClientError)
  })
})
