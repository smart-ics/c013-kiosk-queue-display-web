import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import type { AdmissionServicePoint } from '@aq/shared-types'
import FailureStep from '../FailureStep.vue'
import type { FailureContext } from '../../../composables/useKioskRegistration'

const offerings: AdmissionServicePoint[] = [
  { servicePointId: 'SP-A', displayName: 'Admisi Umum', queuePrefix: 'A', status: 'Active' },
  { servicePointId: 'SP-B', displayName: 'Admisi BPJS', queuePrefix: 'B', status: 'Active' },
]

const errorContext: FailureContext = { code: 'BACKEND_ERROR', message: 'gagal' }

function mountStep() {
  return mount(FailureStep, {
    props: { errorContext, offerings, pending: false },
  })
}

describe('FailureStep manual service point selection', () => {
  it('keeps all offerings available when no automatic fallback resolves', () => {
    const wrapper = mountStep()

    expect(wrapper.findAll('[data-testid^="assist-"]')).toHaveLength(2)
  })

  it('emits selectServicePoint with the selected servicePointId', async () => {
    const wrapper = mountStep()

    await wrapper.get('[data-testid="assist-SP-B"]').trigger('click')

    expect(wrapper.emitted('selectServicePoint')).toEqual([['SP-B']])
  })
})
