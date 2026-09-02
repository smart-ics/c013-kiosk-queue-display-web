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

/**
 * Bahasa Indonesia error messages for Admission Queue error codes.
 * Used by KIOSK display to show user-friendly messages.
 * Technical codes (e.g. AQ_RESOURCE_NOT_FOUND) are logged only, never shown to users.
 */
export const AQ_ERROR_MESSAGES_ID: Record<string, string> = {
  [AQ_ERROR_CODES.AQ_INVALID_REQUEST]: 'Permintaan tidak valid. Periksa data yang diinput dan coba lagi.',
  [AQ_ERROR_CODES.AQ_OPERATION_NOT_ALLOWED]: 'Operasi tidak diizinkan. Service Point mungkin tidak aktif atau sudah dinonaktifkan.',
  [AQ_ERROR_CODES.AQ_UNAUTHENTICATED]: 'Sesi kiosk habis. Silakan mulai ulang aplikasi kiosk.',
  [AQ_ERROR_CODES.AQ_FORBIDDEN]: 'Anda tidak memiliki izin untuk operasi ini. Hubungi administrator.',
  [AQ_ERROR_CODES.AQ_RESOURCE_NOT_FOUND]: 'Data yang dicari tidak ditemukan. Silakan hubungi petugas.',
  [AQ_ERROR_CODES.AQ_CONCURRENCY_CONFLICT]: 'Data telah diubah oleh pengguna lain. Silakan muat ulang dan coba lagi.',
  [AQ_ERROR_CODES.AQ_SEQUENCE_EXHAUSTED]: 'Nomor antrian untuk Service Point ini sudah habis hari ini. Silakan hubungi petugas.',
  [AQ_ERROR_CODES.AQ_CONFIG_INVALID]: 'Konfigurasi tidak valid. Silakan hubungi administrator.',
  [AQ_ERROR_CODES.AQ_WORKSTATION_NOT_FOUND]: 'Workstation tidak ditemukan. Silakan hubungi administrator.',
  [AQ_ERROR_CODES.AQ_WORKSTATION_INACTIVE]: 'Workstation tidak aktif. Silakan hubungi administrator.',
  [AQ_ERROR_CODES.AQ_WORKSTATION_LOKET_CONFLICT]: 'Loket ini sudah dipetakan ke workstation lain. Silakan hubungi administrator.',
  [AQ_ERROR_CODES.AQ_DISPLAY_NOT_FOUND]: 'Display tidak ditemukan. Silakan hubungi administrator.',
  [AQ_ERROR_CODES.AQ_DISPLAY_INACTIVE]: 'Display tidak aktif. Silakan hubungi administrator.',
  [AQ_ERROR_CODES.AQ_DISPLAY_MAPPING_REQUIRED]: 'Display belum dipetakan ke Loket. Silakan hubungi administrator.',
  [AQ_ERROR_CODES.AQ_KIOSK_NOT_FOUND]: 'Kiosk tidak ditemukan. Silakan hubungi administrator.',
  [AQ_ERROR_CODES.AQ_KIOSK_INACTIVE]: 'Kiosk tidak aktif. Silakan hubungi administrator.',
  [AQ_ERROR_CODES.AQ_KIOSK_MAPPING_REQUIRED]: 'Kiosk belum dipetakan ke Service Point. Silakan hubungi administrator.',
  [AQ_ERROR_CODES.AQ_CONFIG_CONCURRENCY]: 'Konfigurasi telah diubah oleh pengguna lain. Silakan muat ulang.',
  [AQ_ERROR_CODES.AQ_CONFIG_FORBIDDEN]: 'Anda tidak memiliki izin mengubah konfigurasi. Hubungi administrator.',
}

/** HTTP status fallback messages (Bahasa Indonesia). */
const HTTP_STATUS_MESSAGES_ID: Record<number, string> = {
  0: 'Koneksi ke server terputus. Periksa jaringan dan coba lagi.',
  401: 'Sesi habis. Silakan mulai ulang aplikasi kiosk.',
  403: 'Anda tidak memiliki izin untuk aksi ini. Hubungi administrator.',
  404: 'Data yang dicari tidak ditemukan. Silakan hubungi petugas.',
  409: 'Data telah diubah oleh pengguna lain. Silakan muat ulang dan coba lagi.',
  422: 'Data yang diinput tidak valid. Periksa kembali dan coba lagi.',
  500: 'Terjadi kesalahan pada server. Silakan coba lagi.',
  503: 'Layanan sementara tidak tersedia. Coba lagi dalam waktu yang singkat.',
}

function extractDataDetail(body: unknown): string | undefined {
  if (typeof body === 'object' && body !== null && 'data' in body) {
    const raw = (body as Record<string, unknown>).data
    return typeof raw === 'string' ? raw : undefined
  }
  return undefined
}

/**
 * Map an API error to a Bahasa Indonesia user-friendly message.
 * Technical codes are logged only; users see natural-language messages.
 * When the backend includes a `data` detail string, it is appended for context.
 */
export function mapBackendErrorToUserMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.code && AQ_ERROR_MESSAGES_ID[error.code]) {
      const base = AQ_ERROR_MESSAGES_ID[error.code]
      const detail = extractDataDetail(error.body)
      return detail ? `${base} (${detail})` : base
    }
    if (error.status && HTTP_STATUS_MESSAGES_ID[error.status]) {
      const base = HTTP_STATUS_MESSAGES_ID[error.status]
      const detail = extractDataDetail(error.body)
      return detail ? `${base} (${detail})` : base
    }
    if (error.message) return error.message
  }
  if (error instanceof Error) return error.message
  return 'Terjadi kesalahan. Silakan coba lagi.'
}

/**
 * Map an API error to a Bahasa Indonesia message with suggested action.
 * Used for intake/registration flows where the user needs to know what to do next.
 */
export function mapIntakeErrorMessage(error: unknown): string {
  if (isUncertainIntakeError(error)) {
    return (
      'Respons tidak pasti (jaringan/timeout). Nomor mungkin sudah terbit. ' +
      'Tekan "Coba lagi" hanya jika Anda yakin belum mendapat nomor — bisa terjadi duplikat.'
    )
  }
  if (isSequenceExhausted(error)) {
    return 'Antrian untuk Service Point ini sudah penuh hari ini. Silakan hubungi petugas.'
  }
  if (isOperationNotAllowed(error)) {
    return 'Service Point tidak aktif atau operasi tidak diizinkan. Silakan hubungi administrator.'
  }
  if (isAdmissionQueueError(error, AQ_ERROR_CODES.AQ_RESOURCE_NOT_FOUND)) {
    return 'Service Point tidak ditemukan. Silakan hubungi administrator.'
  }
  if (isAdmissionQueueError(error, AQ_ERROR_CODES.AQ_UNAUTHENTICATED)) {
    return 'Autentikasi gagal. Silakan mulai ulang aplikasi kiosk.'
  }
  if (error instanceof ApiClientError) {
    return mapBackendErrorToUserMessage(error)
  }
  if (error instanceof Error) {
    return error.message
  }
  return 'Permintaan intake gagal. Silakan coba lagi secara sadar.'
}
