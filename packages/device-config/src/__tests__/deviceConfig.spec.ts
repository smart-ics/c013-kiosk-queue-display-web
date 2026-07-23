import { describe, expect, it } from 'vitest'
import { parseScreenIdFromPath, parseStationIdFromPath } from '../path'
import { JsonDeviceConfigurationProvider } from '../jsonProvider'
import { DeviceConfigNotFoundError } from '../provider'

describe('parseStationIdFromPath', () => {
  it('parses stationId from /kiosk/{stationId}', () => {
    expect(parseStationIdFromPath('/kiosk/loket-03')).toBe('loket-03')
    expect(parseStationIdFromPath('/kiosk/loket-03/')).toBe('loket-03')
  })

  it('returns null for unknown or empty paths', () => {
    expect(parseStationIdFromPath('/display/lobby-1')).toBeNull()
    expect(parseStationIdFromPath('/kiosk/')).toBeNull()
    expect(parseStationIdFromPath('/')).toBeNull()
  })
})

describe('parseScreenIdFromPath', () => {
  it('parses screenId from /display/{screenId}', () => {
    expect(parseScreenIdFromPath('/display/lobby-poli-1')).toBe('lobby-poli-1')
  })
})

describe('JsonDeviceConfigurationProvider', () => {
  const provider = new JsonDeviceConfigurationProvider({
    'loket-03': {
      role: 'kiosk',
      servicePointIds: ['SP-REG'],
    },
    'lobby-poli-1': {
      role: 'display',
      loketIds: ['L1', 'L2'],
      pollIntervalMs: 15000,
      audioEnabled: true,
    },
  })

  it('returns config for known station', async () => {
    const config = await provider.getConfig('loket-03')
    expect(config).toEqual({
      deviceId: 'loket-03',
      role: 'kiosk',
      servicePointIds: ['SP-REG'],
    })
  })

  it('returns config for known display screen', async () => {
    const config = await provider.getConfig('lobby-poli-1')
    expect(config).toEqual({
      deviceId: 'lobby-poli-1',
      role: 'display',
      loketIds: ['L1', 'L2'],
      pollIntervalMs: 15000,
      audioEnabled: true,
    })
  })

  it('fails closed for unknown station', async () => {
    await expect(provider.getConfig('unknown-station')).rejects.toBeInstanceOf(
      DeviceConfigNotFoundError,
    )
  })
})
