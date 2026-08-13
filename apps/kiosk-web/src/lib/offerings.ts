import type { AdmissionServicePoint, DeviceConfig } from '@aq/shared-types'

export function intersectOfferings(
  config: DeviceConfig,
  servicePoints: AdmissionServicePoint[],
): AdmissionServicePoint[] {
  const ids = config.servicePointIds ?? []
  if (ids.length === 0) return []
  const byId = new Map(servicePoints.map((sp) => [sp.servicePointId, sp]))
  return ids
    .map((id) => byId.get(id))
    .filter((sp): sp is AdmissionServicePoint => !!sp && sp.status === 'Active')
}
