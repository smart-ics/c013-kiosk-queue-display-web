import type { AdmissionServicePoint } from '@aq/shared-types'

export function resolveFallbackServicePointId(
  configuredId: string | undefined,
  offerings: readonly AdmissionServicePoint[],
): string | undefined {
  const normalizedId = configuredId?.trim()
  if (!normalizedId) return undefined

  return offerings.some((item) => item.servicePointId === normalizedId)
    ? normalizedId
    : undefined
}
