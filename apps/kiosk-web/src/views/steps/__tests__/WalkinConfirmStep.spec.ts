import { describe, expect, it } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import type { PasienSearchItem, ServiceSelection } from '@aq/shared-types'
import type { EligibilityStatus } from '../../../composables/useKioskRegistration'
import WalkinConfirmStep from '../WalkinConfirmStep.vue'

const eligibility: EligibilityStatus = {
  tipeJaminanId: 'J1',
  tipeJaminanName: 'BPJS Kesehatan',
  noPeserta: '0001234567',
  needsEligibility: false,
}

function makePatient(): PasienSearchItem {
  return {
    pasienId: 'PT1',
    pasienName: 'budi santoso',
    noMR: 'MR001',
    nik: '32011234567890',
    tglLahir: '1990-01-01',
  }
}

function makeService(): ServiceSelection {
  return {
    poli: { id: 'POLI1', name: 'Poli Penyakit Dalam' },
    dokter: { id: 'PPA1', name: 'dr. Andi Wijaya Sp.PD' },
    jadwal: { jadwalId: 'JD1', ppaId: 'PPA1', jamPraktek: '08:00', sisaKuota: 5 },
  }
}

function mountStep(elig: EligibilityStatus = eligibility) {
  return shallowMount(WalkinConfirmStep, {
    props: {
      patient: makePatient(),
      service: makeService(),
      eligibility: elig,
      pending: false,
      errorMessage: null,
    },
  })
}

describe('WalkinConfirmStep premium smart-card parity', () => {
  it('renders the identity seal in place of the avatar', () => {
    const wrapper = mountStep()
    expect(wrapper.find('.smart-identity-seal').exists()).toBe(true)
    expect(wrapper.find('.smart-avatar').exists()).toBe(false)
  })

  it('renders the insurance type', () => {
    const wrapper = mountStep()
    expect(wrapper.get('.context-card-badge').text()).toContain('BPJS Kesehatan')
  })

  it('omits the verification suffix when not required', () => {
    const wrapper = mountStep()
    expect(wrapper.get('.context-card-badge').text()).not.toContain('Perlu Verifikasi')
  })

  it('adds the verification suffix only when eligibility is required', () => {
    const wrapper = mountStep({ ...eligibility, needsEligibility: true })
    expect(wrapper.get('.context-card-badge').text()).toContain('Perlu Verifikasi')
  })

  it('renders all four labels with their values and icon tiles', () => {
    const wrapper = mountStep()
    const rows = wrapper.findAll('.smart-info-row').map((row) => ({
      label: row.find('.smart-info-label').text(),
      value: row.find('.smart-info-value').text(),
    }))
    expect(rows).toEqual([
      { label: 'No. Rekam Medis', value: 'MR001' },
      { label: 'Poli Tujuan', value: 'Poli Penyakit Dalam' },
      { label: 'Dokter', value: 'dr. Andi Wijaya Sp.PD' },
      { label: 'Jam Praktik', value: '08:00' },
    ])
    expect(wrapper.findAll('.smart-icon-tile')).toHaveLength(4)
  })
})