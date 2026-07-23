import { describe, expect, it } from 'vitest'
import type { AdmissionServicePoint, DeviceConfig } from '@aq/shared-types'
import { intersectOfferings } from '../offerings'

describe('intersectOfferings', () => {
  const points: AdmissionServicePoint[] = [
    { servicePointId: 'REG', displayName: 'Reg', queuePrefix: 'A', status: 'Active' },
    { servicePointId: 'BPJS', displayName: 'BPJS', queuePrefix: 'B', status: 'Active' },
    { servicePointId: 'OLD', displayName: 'Old', queuePrefix: 'C', status: 'Retired' },
  ]

  it('intersects allow-list with active service points', () => {
    const config: DeviceConfig = {
      deviceId: 'loket-03',
      role: 'kiosk',
      servicePointIds: ['REG', 'OLD', 'MISSING'],
    }
    expect(intersectOfferings(config, points).map((p) => p.servicePointId)).toEqual(['REG'])
  })

  it('returns empty when allow-list missing', () => {
    const config: DeviceConfig = { deviceId: 'loket-03', role: 'kiosk' }
    expect(intersectOfferings(config, points)).toEqual([])
  })
})
