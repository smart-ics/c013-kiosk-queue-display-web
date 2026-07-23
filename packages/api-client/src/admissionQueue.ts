import {
  admissionQueueIntakeResponseSchema,
  admissionServicePointSchema,
  type AdmissionQueueIntakeResponse,
  type AdmissionServicePoint,
  type IntakeBody,
} from '@aq/shared-types'
import { z } from 'zod'
import type { AdmissionQueueClient } from './http'

const servicePointsSchema = z.array(admissionServicePointSchema)

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
  }
}

export type AdmissionQueueApi = ReturnType<typeof createAdmissionQueueApi>
