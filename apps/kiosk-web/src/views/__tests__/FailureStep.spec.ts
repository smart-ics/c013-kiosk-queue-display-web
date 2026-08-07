import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import type { AdmissionServicePoint } from '@aq/shared-types'
import FailureStep from '../steps/FailureStep.vue'

const offerings: AdmissionServicePoint[] = [
  { servicePointId: 'REG', displayName: 'Registrasi', queuePrefix: 'A', status: 'Active' },
]

describe('FailureStep', () => {
  it('shows the failure message and emits the picked service point', async () => {
    const wrapper = mount(FailureStep, {
      props: {
        errorContext: { code: 'DUPLICATE_REGISTRATION', message: 'Sudah terdaftar.' },
        offerings,
        pending: false,
      },
    })
    expect(wrapper.get('[data-testid="failure-message"]').text()).toContain('Sudah terdaftar.')
    await wrapper.get('[data-testid="assist-REG"]').trigger('click')
    expect(wrapper.emitted('selectServicePoint')?.[0]).toEqual(['REG'])
  })

  it('emits back when the back button is clicked', async () => {
    const wrapper = mount(FailureStep, {
      props: {
        errorContext: { code: 'DUPLICATE_REGISTRATION', message: 'Sudah terdaftar.' },
        offerings,
        pending: false,
      },
    })
    await wrapper.get('[data-testid="failure-back"]').trigger('click')
    expect(wrapper.emitted('back')).toBeTruthy()
  })
})
