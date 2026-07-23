import { describe, expect, it } from 'vitest'
import { EnvAuthTokenProvider, MissingAuthTokenError } from '../index'

describe('EnvAuthTokenProvider', () => {
  it('returns trimmed token', () => {
    const provider = new EnvAuthTokenProvider('  abc.def.ghi  ')
    expect(provider.getToken()).toBe('abc.def.ghi')
  })

  it('returns null when missing', () => {
    expect(new EnvAuthTokenProvider(undefined).getToken()).toBeNull()
    expect(new EnvAuthTokenProvider('').getToken()).toBeNull()
    expect(new EnvAuthTokenProvider('   ').getToken()).toBeNull()
  })

  it('requireToken throws when missing', () => {
    expect(() => new EnvAuthTokenProvider(null).requireToken()).toThrow(MissingAuthTokenError)
  })
})
