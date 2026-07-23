import {
  admissionQueueIntakeResponseSchema,
  admissionServicePointSchema,
  currentLoketDisplayItemSchema,
  type AdmissionQueueIntakeResponse,
  type AdmissionServicePoint,
  type CurrentLoketDisplayItem,
  type IntakeBody,
} from '@aq/shared-types'
import { z } from 'zod'
import type { AdmissionQueueClient } from './http'

const servicePointsSchema = z.array(admissionServicePointSchema)
const currentDisplaysSchema = z.array(currentLoketDisplayItemSchema)

/**
 * Hub lives at server root `/hubs/admission-queue`, not under `/api`.
 * `apiBase` is typically `http://host:port/api`.
 */
export function buildAdmissionQueueHubUrl(apiBase: string): string {
  const trimmed = apiBase.replace(/\/+$/, '')
  const origin = trimmed.replace(/\/api$/i, '')
  return `${origin}/hubs/admission-queue`
}

export function createAdmissionQueueApi(client: AdmissionQueueClient) {
  return {
    listServicePoints(activeOnly = true): Promise<AdmissionServicePoint[]> {
      return client.getJson('v1/admission-queue/service-points', servicePointsSchema, {
        activeOnly,
      })
    },

    intake(body: IntakeBody): Promise<AdmissionQueueIntakeResponse> {
      return client.postJson('v1/admission-queue/intake', body, admissionQueueIntakeResponseSchema)
    },

    getCurrentDisplays(loketKey?: string): Promise<CurrentLoketDisplayItem[]> {
      const query =
        loketKey !== undefined && loketKey.trim() !== ''
          ? { loketKey: loketKey.trim() }
          : undefined
      return client.getJson('v1/admission-queue/displays/current', currentDisplaysSchema, query)
    },
  }
}

export type AdmissionQueueApi = ReturnType<typeof createAdmissionQueueApi>
