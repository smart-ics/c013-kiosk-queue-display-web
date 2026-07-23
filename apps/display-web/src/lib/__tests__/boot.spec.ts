import { describe, expect, it } from 'vitest'
import { validateDisplayDeviceConfig } from '../boot'

describe('validateDisplayDeviceConfig', () => {
  it('fails closed on wrong role', () => {
    const result = validateDisplayDeviceConfig('loket-03', {
      deviceId: 'loket-03',
      role: 'kiosk',
      servicePointIds: ['REG'],
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.message).toContain('bukan role display')
  })

  it('fails closed on empty loketIds', () => {
    const result = validateDisplayDeviceConfig('lobby-poli-1', {
      deviceId: 'lobby-poli-1',
      role: 'display',
      loketIds: [],
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.message).toContain('loketIds')
  })

  it('accepts valid display config', () => {
    const result = validateDisplayDeviceConfig('lobby-poli-1', {
      deviceId: 'lobby-poli-1',
      role: 'display',
      loketIds: ['L1'],
    })
    expect(result).toEqual({ ok: true })
  })
})
