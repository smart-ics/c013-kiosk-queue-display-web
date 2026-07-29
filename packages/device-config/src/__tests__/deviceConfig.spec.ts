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

  it('lists only display-role screen ids', async () => {
    const ids = await provider.listDisplayScreenIds()
    expect(ids).toEqual(['lobby-poli-1'])
  })
})

describe('JsonDeviceConfigurationProvider.listDisplayScreenIds', () => {
  it('returns sorted display ids from a mixed catalog', async () => {
    const provider = new JsonDeviceConfigurationProvider({
      'lobby-igd': { role: 'display', loketIds: ['L3'] },
      'lobby-poli-1': { role: 'display', loketIds: ['L1', 'L2'] },
      'loket-03': { role: 'kiosk', servicePointIds: ['SP-REG'] },
    })
    const ids = await provider.listDisplayScreenIds()
    expect(ids).toEqual(['lobby-igd', 'lobby-poli-1'])
  })

  it('returns an empty array when there are no display entries', async () => {
    const provider = new JsonDeviceConfigurationProvider({
      'loket-03': { role: 'kiosk', servicePointIds: ['SP-REG'] },
    })
    expect(await provider.listDisplayScreenIds()).toEqual([])
  })

  it('returns an empty array for an empty catalog', async () => {
    const provider = new JsonDeviceConfigurationProvider({})
    expect(await provider.listDisplayScreenIds()).toEqual([])
  })

  it('ignores entries with no role', async () => {
    const provider = new JsonDeviceConfigurationProvider({
      'no-role': { servicePointIds: ['SP-REG'] } as never,
    })
    expect(await provider.listDisplayScreenIds()).toEqual([])
  })

  it('returns ids even if the entry would fail getConfig validation', async () => {
    const provider = new JsonDeviceConfigurationProvider({
      'broken-display': { role: 'display' } as never,
    })
    expect(await provider.listDisplayScreenIds()).toEqual(['broken-display'])
  })
})
