import { describe, expect, it } from 'vitest'
import type { AdmissionServicePoint } from '@aq/shared-types'
import { resolveFallbackServicePointId } from '../fallbackServicePoint'

const offerings: AdmissionServicePoint[] = [
  { servicePointId: 'SP-A', displayName: 'Admisi Umum', queuePrefix: 'A', status: 'Active' },
  { servicePointId: 'SP-B', displayName: 'Admisi BPJS', queuePrefix: 'B', status: 'Active' },
]

describe('resolveFallbackServicePointId', () => {
  it('returns the configured id when it is an active offering', () => {
    expect(resolveFallbackServicePointId('SP-A', offerings)).toBe('SP-A')
  })

  it('returns undefined when no assignment is configured', () => {
    expect(resolveFallbackServicePointId(undefined, offerings)).toBeUndefined()
  })

  it('returns undefined when the assignment is empty', () => {
    expect(resolveFallbackServicePointId('', offerings)).toBeUndefined()
  })

  it('returns undefined when the configured id is not an offering of this kiosk', () => {
    expect(resolveFallbackServicePointId('SP-MISSING', offerings)).toBeUndefined()
  })

  it('trims the configured id before matching', () => {
    expect(resolveFallbackServicePointId(' SP-B ', offerings)).toBe('SP-B')
  })
})
