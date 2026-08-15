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
  patientId: 'PT2',
  patientName: 'Budi Prasetyo',
  maskedNik: '317402******',
  isExactMatch: false,
  rank: 2,
}

describe('PatientContextConfirmStep', () => {
  it('shows bestMatch in selector list with badge', () => {
    const wrapper = mount(PatientContextConfirmStep, {
      props: { bestMatch: best, patients: [], pending: false },
    })
    const card = wrapper.get('[data-testid="patient-P001"]')
    expect(card.text()).toContain('Budi Santoso')
    expect(card.text()).toContain('Paling Cocok')
  })

  it('emits confirm with best match item from list', async () => {
    const wrapper = mount(PatientContextConfirmStep, {
      props: { bestMatch: best, patients: [], pending: false },
    })
    await wrapper.get('[data-testid="patient-P001"]').trigger('click')
    expect(wrapper.emitted('confirm')).toEqual([[best]])
  })

  it('shows additional patients in list', () => {
    const wrapper = mount(PatientContextConfirmStep, {
      props: { bestMatch: null, patients: [alt], pending: false },
    })
    expect(wrapper.get(`[data-testid="patient-${alt.id}"]`).text()).toContain('Budi Prasetyo')
  })

  it('paginates patients list at 3 items per page', async () => {
    const alt2 = { ...alt, id: 'P003', patientId: 'PT3', patientName: 'Budi 3' }
    const alt3 = { ...alt, id: 'P004', patientId: 'PT4', patientName: 'Budi 4' }

    // total 4 items (best, alt, alt2, alt3) -> page size 3
    const wrapper = mount(PatientContextConfirmStep, {
      props: { bestMatch: best, patients: [alt, alt2, alt3], pending: false },
    })

    expect(wrapper.find(`[data-testid="patient-${best.id}"]`).exists()).toBe(true)
    expect(wrapper.find(`[data-testid="patient-${alt.id}"]`).exists()).toBe(true)
    expect(wrapper.find(`[data-testid="patient-${alt2.id}"]`).exists()).toBe(true)
    expect(wrapper.find(`[data-testid="patient-${alt3.id}"]`).exists()).toBe(false) // page 2

    // Pagination should exist
    const pagination = wrapper.get('[data-testid="kiosk-pagination"]')
    expect(pagination.text()).toContain('1/2')

    // Click next page
    await pagination.get('.next-btn').trigger('click')

    expect(wrapper.find(`[data-testid="patient-${best.id}"]`).exists()).toBe(false)
    expect(wrapper.find(`[data-testid="patient-${alt.id}"]`).exists()).toBe(false)
    expect(wrapper.find(`[data-testid="patient-${alt2.id}"]`).exists()).toBe(false)
    expect(wrapper.find(`[data-testid="patient-${alt3.id}"]`).exists()).toBe(true)
    expect(pagination.text()).toContain('2/2')
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
