import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PatientContextConfirmStep from '../steps/PatientContextConfirmStep.vue'
import type { PatientContextItem } from '@aq/shared-types'

const best: PatientContextItem = {
  kind: 'Patient',
  id: 'P001',
  patientName: 'Budi Santoso',
  patientId: 'PT1',
  birthDate: '1990-05-15',
  gender: 'L',
  locality: 'Jakarta Selatan',
  maskedNik: '317401******',
  maskedPhone: null,
  visitDate: null,
  visitTime: null,
  serviceName: null,
  doctorName: null,
  state: 'Active',
  bookingId: null,
  registrationId: null,
  matchType: 'Exact',
  isExactMatch: true,
  rank: 1,
  warnings: [],
}

const alt: PatientContextItem = {
  ...best,
  id: 'P002',
  patientName: 'Budi Prasetyo',
  maskedNik: '317402******',
  isExactMatch: false,
  rank: 2,
}

describe('PatientContextConfirmStep', () => {
  it('shows bestMatch prominently', () => {
    const wrapper = mount(PatientContextConfirmStep, {
      props: { bestMatch: best, patients: [], pending: false },
    })
    expect(wrapper.get('[data-testid="best-match"]').text()).toContain('Budi Santoso')
    expect(wrapper.get('[data-testid="best-match"]').text()).toContain('Paling Cocok')
  })

  it('emits confirm with best match item', async () => {
    const wrapper = mount(PatientContextConfirmStep, {
      props: { bestMatch: best, patients: [], pending: false },
    })
    await wrapper.get('[data-testid="confirm-best-match"]').trigger('click')
    expect(wrapper.emitted('confirm')).toEqual([[best]])
  })

  it('shows additional patients in list', () => {
    const wrapper = mount(PatientContextConfirmStep, {
      props: { bestMatch: best, patients: [alt], pending: false },
    })
    expect(wrapper.get(`[data-testid="patient-${alt.id}"]`).text()).toContain('Budi Prasetyo')
  })

  it('emits intake when ambil antrian clicked', async () => {
    const wrapper = mount(PatientContextConfirmStep, {
      props: { bestMatch: best, patients: [], pending: false },
    })
    await wrapper.get('[data-testid="take-intake"]').trigger('click')
    expect(wrapper.emitted('intake')).toHaveLength(1)
  })

  it('emits retry when cari ulang clicked', async () => {
    const wrapper = mount(PatientContextConfirmStep, {
      props: { bestMatch: best, patients: [], pending: false },
    })
    await wrapper.get('[data-testid="retry-search"]').trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
  })
})
