import { describe, expect, it } from 'vitest'
import { buildLoginUrl } from '../configuration'

describe('buildLoginUrl', () => {
  it('strips trailing /api', () => {
    expect(buildLoginUrl('http://localhost:5000/api')).toBe('http://localhost:5000/login')
  })

  it('handles trailing slash', () => {
    expect(buildLoginUrl('http://localhost:5000/api/')).toBe('http://localhost:5000/login')
  })
})
