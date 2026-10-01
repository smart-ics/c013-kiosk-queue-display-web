import { describe, expect, it } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import BiometricStep from '../BiometricStep.vue'

describe('BiometricStep', () => {
  it('shows pending instructions and a Batal button while verifying', () => {
    const wrapper = shallowMount(BiometricStep, { props: { pending: true } })
    expect(wrapper.find('[data-testid="biometric-pending"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="biometric-back"]').exists()).toBe(true)
  })

  it('emits back when Batal is clicked', async () => {
    const wrapper = shallowMount(BiometricStep, { props: { pending: true } })
    await wrapper.get('[data-testid="biometric-back"]').trigger('click')
    expect(wrapper.emitted('back')).toHaveLength(1)
  })
})
