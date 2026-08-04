import { describe, expect, it } from 'vitest'
import { ApiClientError } from '@aq/api-client'
import { FAILURE_CODES, mapErrorToFailureCode } from '../failureCode'

describe('mapErrorToFailureCode', () => {
  it('maps network errors to BACKEND_ERROR', () => {
    expect(mapErrorToFailureCode(new ApiClientError('Failed to fetch', 0))).toBe(
      FAILURE_CODES.BACKEND_ERROR,
    )
  })

  it('maps DUPLICATE_REGISTRATION code', () => {
    const err = new ApiClientError('Already registered', 409, 'DUPLICATE_REGISTRATION')
    expect(mapErrorToFailureCode(err)).toBe(FAILURE_CODES.DUPLICATE_REGISTRATION)
  })

  it('maps sequence-exhausted to SCHEDULE_FULL', () => {
    const err = new ApiClientError('Full', 503)
    expect(mapErrorToFailureCode(err)).toBe(FAILURE_CODES.SCHEDULE_FULL)
  })

  it('falls back to UNKNOWN_ERROR', () => {
    expect(mapErrorToFailureCode(new Error('boom'))).toBe(FAILURE_CODES.UNKNOWN_ERROR)
  })
})
