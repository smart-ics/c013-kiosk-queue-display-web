import { computed, ref, type Ref } from 'vue'
import type { AdmissionQueueIntakeResponse, AdmissionServicePoint } from '@aq/shared-types'
import { mapIntakeErrorMessage } from '@aq/api-client'
import { getAdmissionQueueApi } from '../infrastructure'

export type IntakeFn = (servicePointId: string) => Promise<AdmissionQueueIntakeResponse>

export function useKioskIntake(
  offerings: Ref<AdmissionServicePoint[]>,
  intakeFn: IntakeFn = (servicePointId) =>
    getAdmissionQueueApi().intake({ servicePointId }),
) {
  const pending = ref(false)
  const errorMessage = ref<string | null>(null)
  const result = ref<AdmissionQueueIntakeResponse | null>(null)
  const lastAttemptServicePointId = ref<string | null>(null)

  const canSubmit = computed(() => !pending.value && offerings.value.length > 0)

  async function submitIntake(servicePointId: string) {
    if (pending.value) return
    pending.value = true
    errorMessage.value = null
    lastAttemptServicePointId.value = servicePointId
    try {
      result.value = await intakeFn(servicePointId)
    } catch (error) {
      errorMessage.value = mapIntakeErrorMessage(error)
    } finally {
      pending.value = false
    }
  }

  function retryLast() {
    if (!lastAttemptServicePointId.value || pending.value) return
    void submitIntake(lastAttemptServicePointId.value)
  }

  function resetToSelection() {
    result.value = null
    errorMessage.value = null
    lastAttemptServicePointId.value = null
  }

  return {
    pending,
    errorMessage,
    result,
    canSubmit,
    submitIntake,
    retryLast,
    resetToSelection,
  }
}
