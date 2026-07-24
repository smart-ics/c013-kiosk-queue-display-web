import { describe, expect, it } from 'vitest'
import { buildCanonicalDisplayUrl, buildPreviewDisplayUrl } from '../../infrastructure'

describe('display URL helpers', () => {
  it('builds canonical URL without secrets', () => {
    const url = buildCanonicalDisplayUrl('lobby-a')
    expect(url).toContain('/display/lobby-a')
    expect(url).not.toMatch(/token|password|jwt/i)
  })

  it('builds preview URL with preview=1', () => {
    expect(buildPreviewDisplayUrl('lobby-a')).toContain('preview=1')
  })
})
