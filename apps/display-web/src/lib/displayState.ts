import { ADMISSION_QUEUE_CLAIM_STATE, type AdmissionQueueClaimState } from '@aq/shared-types'

export function displayStateLabel(state: AdmissionQueueClaimState): string {
  switch (state) {
    case ADMISSION_QUEUE_CLAIM_STATE.Outstanding:
      return 'Dipanggil'
    case ADMISSION_QUEUE_CLAIM_STATE.InService:
      return 'Dilayani'
    case ADMISSION_QUEUE_CLAIM_STATE.Released:
      return 'Selesai'
    default:
      return '—'
  }
}
