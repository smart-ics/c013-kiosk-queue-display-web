import { describe, expect, it } from 'vitest'
import {
  ApiClientError,
  AQ_ERROR_CODES,
  isSequenceExhausted,
  mapIntakeErrorMessage,
} from '../errors'

describe('mapIntakeErrorMessage', () => {
  it('maps sequence exhausted', () => {
    const error = new ApiClientError('full', 503, AQ_ERROR_CODES.AQ_SEQUENCE_EXHAUSTED)
    expect(isSequenceExhausted(error)).toBe(true)
    expect(mapIntakeErrorMessage(error)).toContain('AQ_SEQUENCE_EXHAUSTED')
  })

  it('maps inactive / not allowed', () => {
    const error = new ApiClientError('inactive', 400, AQ_ERROR_CODES.AQ_OPERATION_NOT_ALLOWED)
    expect(mapIntakeErrorMessage(error)).toContain('AQ_OPERATION_NOT_ALLOWED')
  })

  it('maps 503 without code as exhausted', () => {
    const error = new ApiClientError('unavailable', 503)
    expect(isSequenceExhausted(error)).toBe(true)
  })
})
