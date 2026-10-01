/**
 * Upload SEP identity guard (ARCHITECTURE TD-SJP-02).
 *
 * The `PATCH Sep/upload` result is the sole authoritative SEP identity for
 * `PATCH Reg/setDataEligibility`. A missing, blank, or placeholder (`"-"`)
 * number is not a sendable identity: it is a fallback signal, never a value to
 * coerce, trim into, or replace with the create result.
 */
export const UPLOAD_IDENTITY_PLACEHOLDER = '-'

export const UPLOAD_IDENTITY_INVALID_LOG_PREFIX =
  '[kiosk] upload identity invalid: missing/placeholder'

/**
 * Single definition of a sendable upload `sepNo`. Missing (`undefined`,
 * `null`), blank, and the placeholder are all invalid; no other shape is
 * accepted, so a non-string outcome is rejected by construction.
 */
export function isValidUploadSepNo(value: unknown): boolean {
  if (typeof value !== 'string') return false
  const trimmed = value.trim()
  return trimmed.length > 0 && trimmed !== UPLOAD_IDENTITY_PLACEHOLDER
}

/**
 * Logs the guard rejection so it is distinguishable in kiosk logs from a
 * service business error, carrying only the correlation id. Never logs the
 * rejected value, participant identity, credentials, or request bodies.
 */
export function reportInvalidUploadIdentity(regId: string): void {
  // eslint-disable-next-line no-console
  console.warn(
    `${UPLOAD_IDENTITY_INVALID_LOG_PREFIX} regId=${regId} rejected before Reg/setDataEligibility; no SEP identity was sent`,
  )
}
