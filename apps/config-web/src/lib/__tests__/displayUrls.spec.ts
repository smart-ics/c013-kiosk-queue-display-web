import { describe, expect, it } from 'vitest'
import {
  buildCanonicalDisplayUrl,
  buildCanonicalKioskUrl,
  buildPreviewDisplayUrl,
} from '../../infrastructure'

describe('display URL helpers', () => {
  it('builds canonical URL without secrets', () => {
    const url = buildCanonicalDisplayUrl('lobby-a')
    expect(url).toContain('/display/lobby-a')
    expect(url).not.toMatch(/token|password|jwt/i)
  })

  it('builds preview URL with preview=1', () => {
    expect(buildPreviewDisplayUrl('lobby-a')).toContain('preview=1')
  })

  it('builds canonical kiosk URL without secrets', () => {
    const url = buildCanonicalKioskUrl('loket-03')
    expect(url).toContain('/kiosk/loket-03')
    expect(url).not.toMatch(/token|password|jwt/i)
  })
})
