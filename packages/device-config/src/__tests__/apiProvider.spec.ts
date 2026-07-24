import { describe, expect, it, vi } from 'vitest'
import { ApiDeviceConfigurationProvider } from '../apiProvider'
import { DeviceConfigInvalidError, DeviceConfigNotFoundError } from '../provider'

describe('ApiDeviceConfigurationProvider', () => {
  it('maps boot config to DeviceConfig', async () => {
    const provider = new ApiDeviceConfigurationProvider({
      getDisplayBootConfig: vi.fn(async () => ({
        deviceId: 'lobby-a',
        role: 'display' as const,
        displayName: 'Lobby A',
        locationName: 'Lobby',
        loketIds: ['L1', 'L2'],
        pollIntervalMs: 15000,
        audioEnabled: true,
        layoutKey: 'default',
      })),
    })
    const config = await provider.getConfig('lobby-a')
    expect(config.loketIds).toEqual(['L1', 'L2'])
    expect(config.role).toBe('display')
  })

  it('throws not found', async () => {
    const provider = new ApiDeviceConfigurationProvider({
      getDisplayBootConfig: vi.fn(async () => {
        throw new Error('AQ_DISPLAY_NOT_FOUND')
      }),
    })
    await expect(provider.getConfig('missing')).rejects.toBeInstanceOf(DeviceConfigNotFoundError)
  })

  it('throws invalid for inactive', async () => {
    const provider = new ApiDeviceConfigurationProvider({
      getDisplayBootConfig: vi.fn(async () => {
        throw new Error('AQ_DISPLAY_INACTIVE')
      }),
    })
    await expect(provider.getConfig('x')).rejects.toBeInstanceOf(DeviceConfigInvalidError)
  })
})
