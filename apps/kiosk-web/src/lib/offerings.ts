import type { AdmissionServicePoint, DeviceConfig } from '@aq/shared-types'

export function intersectOfferings(
  config: DeviceConfig,
  servicePoints: AdmissionServicePoint[],
): AdmissionServicePoint[] {
  const allow = new Set(config.servicePointIds ?? [])
  if (allow.size === 0) return []
  return servicePoints.filter(
    (sp) => allow.has(sp.servicePointId) && sp.status === 'Active',
  )
}
