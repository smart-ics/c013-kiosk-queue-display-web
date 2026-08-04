import { describe, expect, it } from 'vitest'
import { canTransition } from '../flow'

describe('canTransition', () => {
  it('allows home → booking search', () => {
    expect(canTransition('HOME', 'BOOKING_SEARCH')).toBe(true)
  })

  it('allows booking confirm → biometric verify', () => {
    expect(canTransition('BOOKING_CONFIRM', 'BIOMETRIC_VERIFY')).toBe(true)
  })

  it('allows walk-in confirm → registration success', () => {
    expect(canTransition('WALKIN_CONFIRM', 'REGISTRATION_SUCCESS')).toBe(true)
  })

  it('allows walk-in back to search from select patient', () => {
    expect(canTransition('WALKIN_SELECT_PATIENT', 'WALKIN_SEARCH')).toBe(true)
  })

  it('allows walk-in back to search from select service', () => {
    expect(canTransition('WALKIN_SELECT_SERVICE', 'WALKIN_SEARCH')).toBe(true)
  })

  it('allows walk-in back to search from confirm', () => {
    expect(canTransition('WALKIN_CONFIRM', 'WALKIN_SEARCH')).toBe(true)
  })

  it('allows failure → assistance queue only', () => {
    expect(canTransition('FAILURE', 'ASSISTANCE_QUEUE')).toBe(true)
    expect(canTransition('FAILURE', 'HOME')).toBe(false)
  })

  it('rejects skipping steps', () => {
    expect(canTransition('HOME', 'REGISTRATION_SUCCESS')).toBe(false)
  })
})
