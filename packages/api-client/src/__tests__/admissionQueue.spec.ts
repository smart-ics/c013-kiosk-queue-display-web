import { describe, expect, it, vi } from 'vitest'
import { buildAdmissionQueueHubUrl, createAdmissionQueueApi } from '../admissionQueue'
import { AdmissionQueueClient } from '../http'
import type { IAuthTokenProvider } from '@aq/auth'

function createAuth(token = 'test-token'): IAuthTokenProvider {
  return {
    getToken: () => token,
  }
}

describe('buildAdmissionQueueHubUrl', () => {
  it('strips trailing /api from API base', () => {
    expect(buildAdmissionQueueHubUrl('http://localhost:5000/api')).toBe(
      'http://localhost:5000/hubs/admission-queue',
    )
  })

  it('strips trailing slash then /api', () => {
    expect(buildAdmissionQueueHubUrl('http://192.168.10.5/api/')).toBe(
      'http://192.168.10.5/hubs/admission-queue',
    )
  })
})

describe('getCurrentDisplays', () => {
  it('maps JSend success data to typed display items', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          status: 'success',
          data: [
            {
              loketKey: 'L1',
              antrianId: 'A1',
              noUrut: 12,
              queueLabel: 'A0012',
              servicePointId: 'REG',
              displayState: 1,
              announcementVersion: 42,
              calledAt: '2026-07-23T08:15:00',
              serviceStartedAt: null,
              rowVersion: 'AQ==',
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )

    const client = new AdmissionQueueClient({
      baseUrl: 'http://localhost:5000/api',
      auth: createAuth(),
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    const api = createAdmissionQueueApi(client)
    const items = await api.getCurrentDisplays()

    expect(items).toHaveLength(1)
    expect(items[0]?.queueLabel).toBe('A0012')
    expect(items[0]?.announcementVersion).toBe(42)
    expect(String(fetchImpl.mock.calls[0]?.[0])).toContain(
      'v1/admission-queue/displays/current',
    )
  })

  it('passes loketKey query when provided', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ status: 'success', data: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    const client = new AdmissionQueueClient({
      baseUrl: 'http://localhost:5000/api',
      auth: createAuth(),
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    await createAdmissionQueueApi(client).getCurrentDisplays('L1')

    const url = String(fetchImpl.mock.calls[0]?.[0])
    expect(url).toContain('loketKey=L1')
  })

  it('accepts the legacy nested JSend payload used by older Bilreg deployments', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ status: 'success', data: { data: [] } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    const client = new AdmissionQueueClient({
      baseUrl: 'http://localhost:5000/api',
      auth: createAuth(),
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })

    await expect(createAdmissionQueueApi(client).getCurrentDisplays()).resolves.toEqual([])
  })
})
