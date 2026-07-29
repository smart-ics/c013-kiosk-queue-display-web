import { describe, expect, it, vi } from 'vitest'
import { ApiKioskDeviceConfigurationProvider } from '../kioskApiProvider'
import { DeviceConfigInvalidError, DeviceConfigNotFoundError } from '../provider'

describe('ApiKioskDeviceConfigurationProvider', () => {
  it('maps kiosk boot configuration', async () => {
    const provider = new ApiKioskDeviceConfigurationProvider({
      getKioskBootConfig: vi.fn(async () => ({
        deviceId: 'loket-03',
        role: 'kiosk' as const,
        displayName: 'Kiosk Loket 03',
        servicePointIds: ['REG', 'BPJS'],
        printerProxyPort: 5050,
      })),
    })

    await expect(provider.getConfig('loket-03')).resolves.toMatchObject({
      role: 'kiosk',
      servicePointIds: ['REG', 'BPJS'],
      printerProxyPort: 5050,
    })
  })

  it('maps not-found and inactive errors', async () => {
    const missing = new ApiKioskDeviceConfigurationProvider({
      getKioskBootConfig: vi.fn(async () => {
        throw new Error('AQ_KIOSK_NOT_FOUND')
      }),
    })
    const inactive = new ApiKioskDeviceConfigurationProvider({
      getKioskBootConfig: vi.fn(async () => {
        throw new Error('AQ_KIOSK_INACTIVE')
      }),
    })

    await expect(missing.getConfig('missing')).rejects.toBeInstanceOf(DeviceConfigNotFoundError)
    await expect(inactive.getConfig('inactive')).rejects.toBeInstanceOf(DeviceConfigInvalidError)
  })
})
