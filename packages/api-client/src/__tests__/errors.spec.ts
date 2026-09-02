import { describe, expect, it } from 'vitest'
import {
  ApiClientError,
  AQ_ERROR_CODES,
  isSequenceExhausted,
  isUncertainIntakeError,
  mapBackendErrorToUserMessage,
  mapIntakeErrorMessage,
} from '../errors'

describe('mapBackendErrorToUserMessage', () => {
  it('maps plain Error generic 404 message to Bahasa Indonesia fallback', () => {
    const error = new Error('Request failed with status 404')
    expect(mapBackendErrorToUserMessage(error)).toBe(
      'Data yang dicari tidak ditemukan. Silakan hubungi petugas.',
    )
  })

  it('maps plain Error generic 503 message to Bahasa Indonesia fallback', () => {
    const error = new Error('Request failed with status 503')
    expect(mapBackendErrorToUserMessage(error)).toBe(
      'Layanan sementara tidak tersedia. Coba lagi dalam waktu yang singkat.',
    )
  })
})

describe('mapIntakeErrorMessage', () => {
  it('maps sequence exhausted to Bahasa Indonesia without exposing technical code', () => {
    const error = new ApiClientError('full', 503, AQ_ERROR_CODES.AQ_SEQUENCE_EXHAUSTED)
    expect(isSequenceExhausted(error)).toBe(true)
    expect(mapIntakeErrorMessage(error)).toContain('penuh')
    expect(mapIntakeErrorMessage(error)).toContain('Silakan hubungi petugas')
    expect(mapIntakeErrorMessage(error)).not.toContain('AQ_SEQUENCE_EXHAUSTED')
  })

  it('maps inactive / not allowed to Bahasa Indonesia without exposing technical code', () => {
    const error = new ApiClientError('inactive', 400, AQ_ERROR_CODES.AQ_OPERATION_NOT_ALLOWED)
    expect(mapIntakeErrorMessage(error)).toContain('tidak aktif')
    expect(mapIntakeErrorMessage(error)).toContain('Silakan hubungi administrator')
    expect(mapIntakeErrorMessage(error)).not.toContain('AQ_OPERATION_NOT_ALLOWED')
  })

  it('maps 503 without code as exhausted', () => {
    const error = new ApiClientError('unavailable', 503)
    expect(isSequenceExhausted(error)).toBe(true)
  })

  it('maps network status 0 as uncertain with duplicate warning', () => {
    const error = new ApiClientError('Failed to fetch', 0)
    expect(isUncertainIntakeError(error)).toBe(true)
    expect(mapIntakeErrorMessage(error)).toContain('duplikat')
    expect(mapIntakeErrorMessage(error)).toContain('Coba lagi')
  })
})
