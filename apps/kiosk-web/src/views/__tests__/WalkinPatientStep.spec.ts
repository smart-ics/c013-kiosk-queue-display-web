import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import type { PasienSearchItem } from '@aq/shared-types'
import WalkinPatientStep from '../steps/WalkinPatientStep.vue'

const patients: PasienSearchItem[] = [{ pasienId: 'PT1', pasienName: 'Andi' }]

describe('WalkinPatientStep', () => {
  it('always renders the picker list, even for a single result', () => {
    const wrapper = mount(WalkinPatientStep, { props: { patients, pending: false } })
    expect(wrapper.findAll('button[data-testid^="patient-"]')).toHaveLength(1)
  })

  it('emits select with the patient', async () => {
    const wrapper = mount(WalkinPatientStep, { props: { patients, pending: false } })
    await wrapper.get('[data-testid="patient-PT1"]').trigger('click')
    expect(wrapper.emitted('select')?.[0]).toEqual([patients[0]])
  })
})
