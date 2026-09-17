import { describe, expect, it } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import type { BookingDetail } from '@aq/shared-types'
import type { EligibilityStatus } from '../../../composables/useKioskRegistration'
import BookingConfirmStep from '../BookingConfirmStep.vue'

const eligibility: EligibilityStatus = {
  tipeJaminanId: 'J1',
  tipeJaminanName: 'BPJS Kesehatan',
  noPeserta: '0001234567',
  needsEligibility: false,
}

function makeBooking(): BookingDetail {
  return {
    bookingId: 'B001',
    bookingDate: '2026-09-17',
    reg: { regId: 'RG1', pasienId: 'PT1', pasienName: 'budi santoso' },
    layanan: { layananId: 'LY1', layananName: 'Poli Penyakit Dalam' },
    dokter: { ppaId: 'PPA1', ppaName: 'dr. Andi Wijaya Sp.PD', isDefault: false },
    tglBerobat: '2026-09-17',
    jamPraktek: '08:00',
    noAntrian: 1,
    coverageInfo: { asuransiName: 'BPJS Kesehatan', noPeserta: '0001234567', noRujukan: 'R001' },
  }
}

function mountStep(elig: EligibilityStatus = eligibility) {
  return shallowMount(BookingConfirmStep, {
    props: {
      booking: makeBooking(),
      eligibility: elig,
      pending: false,
      errorMessage: null,
    },
  })
}

describe('BookingConfirmStep insurance badge', () => {
  it('renders the insurance type', () => {
    const wrapper = mountStep()
    expect(wrapper.get('.context-card-badge').text()).toContain('BPJS Kesehatan')
  })

  it('omits the verification hint when not required', () => {
    const wrapper = mountStep()
    expect(wrapper.get('.context-card-badge').text()).not.toContain('Perlu Verifikasi')
  })

  it('adds a verification hint when eligibility is required', () => {
    const wrapper = mountStep({ ...eligibility, needsEligibility: true })
    expect(wrapper.get('.context-card-badge').text()).toContain('Perlu Verifikasi')
  })

  it('renders the identity seal in place of the avatar', () => {
    const wrapper = mountStep()
    expect(wrapper.find('.smart-identity-seal').exists()).toBe(true)
    expect(wrapper.find('.smart-avatar').exists()).toBe(false)
  })
})