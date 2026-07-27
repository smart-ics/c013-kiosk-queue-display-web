import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { MissingAuthTokenError, SessionAuthTokenProvider } from '../index'

const STORAGE_KEY = 'aq.session.token'

describe('SessionAuthTokenProvider', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  afterEach(() => {
    sessionStorage.clear()
  })

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

  it('persists token to sessionStorage so a new provider sees it after reload', () => {
    const writer = new SessionAuthTokenProvider()
    writer.setToken('abc.def.ghi')
    expect(sessionStorage.getItem(STORAGE_KEY)).toBe('abc.def.ghi')

    const reader = new SessionAuthTokenProvider()
    expect(reader.getToken()).toBe('abc.def.ghi')
  })

  it('clear() removes the entry from sessionStorage', () => {
    const provider = new SessionAuthTokenProvider()
    provider.setToken('abc')
    expect(sessionStorage.getItem(STORAGE_KEY)).toBe('abc')
    provider.clear()
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('setToken(null) removes the entry from sessionStorage', () => {
    const provider = new SessionAuthTokenProvider()
    provider.setToken('abc')
    provider.setToken(null)
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('does not write to sessionStorage when token is blank', () => {
    const provider = new SessionAuthTokenProvider()
    provider.setToken('   ')
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull()
    expect(provider.getToken()).toBeNull()
  })
})
