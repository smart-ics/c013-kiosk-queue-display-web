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

/**
 * Bahasa Indonesia messages for failure codes shown in FailureStep component.
 * Technical codes are used internally, users see localized messages.
 */
export const FAILURE_MESSAGES_ID = {
  [FAILURE_CODES.BIOMETRIC_FAILED]: 'Verifikasi biometrik gagal. Silakan coba lagi atau hubungi petugas.',
  [FAILURE_CODES.BIOMETRIC_TIMEOUT]: 'Verifikasi biometrik timeout. Periksa jaringan dan coba lagi.',
  [FAILURE_CODES.BPJS_VALIDATION_FAILED]: 'Validasi BPJS gagal. Nomor kepesertaan tidak valid atau tidak aktif.',
  [FAILURE_CODES.BOOKING_NOT_FOUND]: 'Data booking tidak ditemukan. Silakan cari dengan nomor booking yang benar.',
  [FAILURE_CODES.SCHEDULE_FULL]: 'Jadwal sudah penuh untuk hari ini. Silakan pilih tanggal lain atau hubungi petugas.',
  [FAILURE_CODES.DUPLICATE_REGISTRATION]: 'Anda sudah terdaftar untuk antrian hari ini. Silakan cek status pendaftaran.',
  [FAILURE_CODES.BACKEND_ERROR]: 'Terjadi kesalahan pada sistem. Silakan coba lagi dalam beberapa saat.',
  [FAILURE_CODES.UNKNOWN_ERROR]: 'Terjadi kesalahan yang tidak diketahui. Silakan hubungi administrator.',
}

export function mapErrorToFailureCode(error: unknown): FailureCode {
  if (error instanceof ApiClientError) {
    if (error.status === 0) return FAILURE_CODES.BACKEND_ERROR
    if (error.code === 'DUPLICATE_REGISTRATION') return FAILURE_CODES.DUPLICATE_REGISTRATION
  }
  if (isSequenceExhausted(error)) return FAILURE_CODES.SCHEDULE_FULL
  return FAILURE_CODES.UNKNOWN_ERROR
}

/**
 * Get a Bahasa Indonesia user-friendly error message for a failure code.
 * Used in FailureStep component to display errors to users.
 */
export function getFailureMessage(failureCode: FailureCode): string {
  return FAILURE_MESSAGES_ID[failureCode] || 'Terjadi kesalahan. Silakan hubungi petugas.'
}
