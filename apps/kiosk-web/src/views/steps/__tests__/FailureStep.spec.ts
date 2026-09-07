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

function mountStep(props: { recommendedServicePointId?: string } = {}) {
  return mount(FailureStep, {
    props: { errorContext, offerings, pending: false, ...props },
  })
}

describe('FailureStep recommended service point', () => {
  it('marks the recommended card and does not auto-emit', () => {
    const wrapper = mountStep({ recommendedServicePointId: 'SP-B' })
    const recommended = wrapper.findAll('[data-recommended="true"]')

    expect(recommended).toHaveLength(1)
    expect(recommended[0].attributes('data-testid')).toBe('assist-SP-B')
    expect(wrapper.emitted('selectServicePoint')).toBeUndefined()
  })

  it('marks no card when no recommendation is given', () => {
    const wrapper = mountStep()

    expect(wrapper.findAll('[data-recommended="true"]')).toHaveLength(0)
  })
})
