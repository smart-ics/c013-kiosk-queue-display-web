import { describe, expect, it } from 'vitest'
import {
  configurationWhoAmISchema,
  displayBootConfigSchema,
  kioskBootConfigSchema,
  workstationContextSchema,
} from '../index'

describe('configuration schemas', () => {
  it('parses whoami', () => {
    const parsed = configurationWhoAmISchema.parse({
      permission: 'AdmissionQueueConfiguration',
      email: 'a@b.c',
      userName: 'Admin',
      roles: ['ADM-SPV'],
    })
    expect(parsed.permission).toBe('AdmissionQueueConfiguration')
  })

  it('parses workstation context', () => {
    const parsed = workstationContextSchema.parse({
      workstationKey: 'WS-ADM-001',
      displayName: 'PC Admisi 1',
      locationName: 'Lobby',
      loketKey: 'LOKET-01',
      loketDisplayName: 'Loket 1',
      active: true,
    })
    expect(parsed.loketKey).toBe('LOKET-01')
  })

  it('parses display boot config', () => {
    const parsed = displayBootConfigSchema.parse({
      deviceId: 'DISPLAY-LOBBY-A',
      role: 'display',
      displayName: 'Display Lobby A',
      locationName: 'Lobby',
      loketIds: ['LOKET-01', 'LOKET-02'],
      pollIntervalMs: 15000,
      audioEnabled: true,
      layoutKey: 'default',
    })
    expect(parsed.loketIds).toHaveLength(2)
  })

  it('parses kiosk boot config', () => {
    const parsed = kioskBootConfigSchema.parse({
      deviceId: 'loket-03',
      role: 'kiosk',
      displayName: 'Kiosk Loket 03',
      locationName: 'Lobby',
      servicePointIds: ['REG', 'BPJS'],
      printerProxyPort: 5050,
      rowVersion: '1',
    })
    expect(parsed.servicePointIds).toEqual(['REG', 'BPJS'])
    expect(parsed.printerProxyPort).toBe(5050)
  })
})
