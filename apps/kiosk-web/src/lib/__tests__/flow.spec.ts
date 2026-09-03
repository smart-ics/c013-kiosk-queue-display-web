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

  it('allows patient context confirm → walk-in guarantee selection', () => {
    expect(canTransition('PATIENT_CONTEXT_CONFIRM', 'WALKIN_SELECT_GUARANTEE')).toBe(true)
  })

  it('rejects back-navigation from walk-in steps to home', () => {
    expect(canTransition('WALKIN_SELECT_SERVICE', 'HOME')).toBe(false)
    expect(canTransition('WALKIN_CONFIRM', 'HOME')).toBe(false)
  })

  it('allows failure → assistance queue only', () => {
    expect(canTransition('FAILURE', 'ASSISTANCE_QUEUE')).toBe(true)
    expect(canTransition('FAILURE', 'HOME')).toBe(false)
  })

  it('allows home → registration reprint', () => {
    expect(canTransition('HOME', 'REGISTRATION_REPRINT')).toBe(true)
  })

  it('keeps registration reprint terminal back to home', () => {
    expect(canTransition('REGISTRATION_REPRINT', 'HOME')).toBe(true)
    expect(canTransition('REGISTRATION_REPRINT', 'REGISTRATION_SUCCESS')).toBe(false)
  })

  it('rejects skipping steps', () => {
    expect(canTransition('HOME', 'REGISTRATION_SUCCESS')).toBe(false)
  })
})
