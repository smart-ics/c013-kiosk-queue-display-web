import { ApiClientError, isSequenceExhausted } from '@aq/api-client'

export const FAILURE_CODES = {
  BIOMETRIC_FAILED: 'BIOMETRIC_FAILED',
  BIOMETRIC_TIMEOUT: 'BIOMETRIC_TIMEOUT',
  BPJS_VALIDATION_FAILED: 'BPJS_VALIDATION_FAILED',
  BOOKING_NOT_FOUND: 'BOOKING_NOT_FOUND',
  SCHEDULE_FULL: 'SCHEDULE_FULL',
  DUPLICATE_REGISTRATION: 'DUPLICATE_REGISTRATION',
  BACKEND_ERROR: 'BACKEND_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const

export type FailureCode = (typeof FAILURE_CODES)[keyof typeof FAILURE_CODES]

export function mapErrorToFailureCode(error: unknown): FailureCode {
  if (error instanceof ApiClientError) {
    if (error.status === 0) return FAILURE_CODES.BACKEND_ERROR
    if (error.code === 'DUPLICATE_REGISTRATION') return FAILURE_CODES.DUPLICATE_REGISTRATION
  }
  if (isSequenceExhausted(error)) return FAILURE_CODES.SCHEDULE_FULL
  return FAILURE_CODES.UNKNOWN_ERROR
}
