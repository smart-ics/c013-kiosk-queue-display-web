import { describe, expect, it } from 'vitest'
import { MissingAuthTokenError, SessionAuthTokenProvider } from '../index'

describe('SessionAuthTokenProvider', () => {
  it('starts empty', () => {
    const provider = new SessionAuthTokenProvider()
    expect(provider.getToken()).toBeNull()
  })

  it('stores trimmed token in memory', () => {
    const provider = new SessionAuthTokenProvider()
    provider.setToken('  abc.def.ghi  ')
    expect(provider.getToken()).toBe('abc.def.ghi')
  })

  it('clears token', () => {
    const provider = new SessionAuthTokenProvider()
    provider.setToken('abc')
    provider.clear()
    expect(provider.getToken()).toBeNull()
  })

  it('treats blank as null', () => {
    const provider = new SessionAuthTokenProvider()
    provider.setToken('   ')
    expect(provider.getToken()).toBeNull()
  })

  it('requireToken throws when missing', () => {
    expect(() => new SessionAuthTokenProvider().requireToken()).toThrow(MissingAuthTokenError)
  })
})
