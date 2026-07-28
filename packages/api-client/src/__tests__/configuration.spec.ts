import { describe, expect, it } from 'vitest'
import { AdmissionQueueClient } from '../http'
import { buildLoginUrl, createRuntimeDeviceApi } from '../configuration'
import { vi } from 'vitest'

describe('buildLoginUrl', () => {
  it('strips trailing /api', () => {
    expect(buildLoginUrl('http://localhost:5000/api')).toBe('http://localhost:5000/login')
  })

  it('handles trailing slash', () => {
    expect(buildLoginUrl('http://localhost:5000/api/')).toBe('http://localhost:5000/login')
  })
})

describe('kiosk runtime configuration', () => {
  it('loads the public kiosk boot path without an auth token', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          status: 'success',
          data: {
            deviceId: 'loket-03',
            role: 'kiosk',
            displayName: 'Kiosk Loket 03',
            servicePointIds: ['REG'],
            printerProxyPort: 5050,
            rowVersion: '1',
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    const client = new AdmissionQueueClient({
      baseUrl: 'http://localhost:5000/api',
      auth: { getToken: () => null },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })

    const config = await createRuntimeDeviceApi(client).getPublicKioskBootConfig('loket-03')

    expect(config.servicePointIds).toEqual(['REG'])
    expect(String(fetchImpl.mock.calls[0]?.[0])).toContain(
      'v1/admission-queue/devices/kiosks/loket-03',
    )
  })
})
