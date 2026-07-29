export const AQ_ERROR_CODES = {
  AQ_INVALID_REQUEST: 'AQ_INVALID_REQUEST',
  AQ_OPERATION_NOT_ALLOWED: 'AQ_OPERATION_NOT_ALLOWED',
  AQ_UNAUTHENTICATED: 'AQ_UNAUTHENTICATED',
  AQ_FORBIDDEN: 'AQ_FORBIDDEN',
  AQ_RESOURCE_NOT_FOUND: 'AQ_RESOURCE_NOT_FOUND',
  AQ_CONCURRENCY_CONFLICT: 'AQ_CONCURRENCY_CONFLICT',
  AQ_SEQUENCE_EXHAUSTED: 'AQ_SEQUENCE_EXHAUSTED',
  AQ_CONFIG_INVALID: 'AQ_CONFIG_INVALID',
  AQ_WORKSTATION_NOT_FOUND: 'AQ_WORKSTATION_NOT_FOUND',
  AQ_WORKSTATION_INACTIVE: 'AQ_WORKSTATION_INACTIVE',
  AQ_WORKSTATION_LOKET_CONFLICT: 'AQ_WORKSTATION_LOKET_CONFLICT',
  AQ_DISPLAY_NOT_FOUND: 'AQ_DISPLAY_NOT_FOUND',
  AQ_DISPLAY_INACTIVE: 'AQ_DISPLAY_INACTIVE',
  AQ_DISPLAY_MAPPING_REQUIRED: 'AQ_DISPLAY_MAPPING_REQUIRED',
  AQ_KIOSK_NOT_FOUND: 'AQ_KIOSK_NOT_FOUND',
  AQ_KIOSK_INACTIVE: 'AQ_KIOSK_INACTIVE',
  AQ_KIOSK_MAPPING_REQUIRED: 'AQ_KIOSK_MAPPING_REQUIRED',
  AQ_CONFIG_CONCURRENCY: 'AQ_CONFIG_CONCURRENCY',
  AQ_CONFIG_FORBIDDEN: 'AQ_CONFIG_FORBIDDEN',
} as const

export type AdmissionQueueErrorCode = (typeof AQ_ERROR_CODES)[keyof typeof AQ_ERROR_CODES]

export class ApiClientError extends Error {
  readonly status: number
  readonly code?: string
  readonly body?: unknown

  constructor(message: string, status: number, code?: string, body?: unknown) {
    super(message)
    this.name = 'ApiClientError'
    this.status = status
    this.code = code
    this.body = body
  }
}

export function getAdmissionQueueErrorCode(error: unknown): string | undefined {
  if (error instanceof ApiClientError && error.code) return error.code
  return undefined
}

export function isAdmissionQueueError(error: unknown, code: AdmissionQueueErrorCode): boolean {
  return getAdmissionQueueErrorCode(error) === code
}

export function isSequenceExhausted(error: unknown): boolean {
  if (isAdmissionQueueError(error, AQ_ERROR_CODES.AQ_SEQUENCE_EXHAUSTED)) return true
  return error instanceof ApiClientError && error.status === 503
}

export function isOperationNotAllowed(error: unknown): boolean {
  return isAdmissionQueueError(error, AQ_ERROR_CODES.AQ_OPERATION_NOT_ALLOWED)
}

/** Network / ambiguous failure — ticket may already exist (R-05B deferred). */
export function isUncertainIntakeError(error: unknown): boolean {
  if (!(error instanceof ApiClientError)) return false
  return error.status === 0
}

export function mapIntakeErrorMessage(error: unknown): string {
  if (isUncertainIntakeError(error)) {
    return (
      'Respons tidak pasti (jaringan/timeout). Nomor mungkin sudah terbit. ' +
      'Tekan "Coba lagi" hanya jika Anda yakin belum mendapat nomor — bisa terjadi duplikat.'
    )
  }
  if (isSequenceExhausted(error)) {
    return 'Antrian untuk Service Point ini sudah penuh hari ini (AQ_SEQUENCE_EXHAUSTED).'
  }
  if (isOperationNotAllowed(error)) {
    return 'Service Point tidak aktif atau operasi tidak diizinkan (AQ_OPERATION_NOT_ALLOWED).'
  }
  if (isAdmissionQueueError(error, AQ_ERROR_CODES.AQ_RESOURCE_NOT_FOUND)) {
    return 'Service Point tidak ditemukan (AQ_RESOURCE_NOT_FOUND).'
  }
  if (isAdmissionQueueError(error, AQ_ERROR_CODES.AQ_UNAUTHENTICATED)) {
    return 'Autentikasi gagal (AQ_UNAUTHENTICATED). Periksa VITE_BILREG_TOKEN.'
  }
  if (error instanceof ApiClientError) {
    return error.message
  }
  if (error instanceof Error) {
    return error.message
  }
  return 'Permintaan intake gagal. Silakan coba lagi secara sadar.'
}
