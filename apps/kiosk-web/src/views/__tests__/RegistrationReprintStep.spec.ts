import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import RegistrationReprintStep from '../steps/RegistrationReprintStep.vue'
import type { RegistrationPrintData } from '@aq/shared-types'

const fixture: RegistrationPrintData = {
  regId: 'RG12345678',
  noAntrian: 7,
  pasienName: 'Budi Santoso',
  pasienId: 'P001',
  tglLahir: '1990-05-20',
  tipeJaminanName: 'Umum',
  serviceName: 'Poliklinik Penyakit Dalam',
  dokterName: 'dr. Andi Wijaya',
}

function mountStep(props: Partial<{ pending: boolean; succeeded: boolean; error: string | null }> = {}) {
  return mount(RegistrationReprintStep, {
    props: {
      registration: fixture,
      pending: false,
      succeeded: false,
      error: null,
      ...props,
    },
  })
}

describe('RegistrationReprintStep', () => {
  it('renders reg id, queue number, patient, service, and doctor', () => {
    const wrapper = mountStep()

    expect(wrapper.get('[data-testid="reprint-reg-id"]').text()).toContain('RG12345678')
    expect(wrapper.get('[data-testid="reprint-no-antrian"]').text()).toContain('7')
    expect(wrapper.text()).toContain('Budi Santoso')
    expect(wrapper.text()).toContain('Poliklinik Penyakit Dalam')
    expect(wrapper.text()).toContain('dr. Andi Wijaya')
    expect(wrapper.text()).toContain('Cetak Ulang Karcis Registrasi')
  })

  it('emits reprint exactly once when clicking Cetak ulang', async () => {
    const wrapper = mountStep()

    await wrapper.get('[data-testid="reprint-btn"]').trigger('click')
    expect(wrapper.emitted('reprint')).toHaveLength(1)
  })

  it('disables the reprint button while pending and does not emit on click', async () => {
    const wrapper = mountStep({ pending: true })

    const button = wrapper.get('[data-testid="reprint-btn"]')
    expect(button.attributes('disabled')).toBeDefined()

    await button.trigger('click')
    expect(wrapper.emitted('reprint')).toBeUndefined()
  })

  it('emits finish when clicking Kembali ke menu', async () => {
    const wrapper = mountStep()

    await wrapper.get('[data-testid="reprint-finish"]').trigger('click')
    expect(wrapper.emitted('finish')).toHaveLength(1)
  })

  it('shows the error text when error is set', () => {
    const wrapper = mountStep({ error: 'Gagal terhubung ke printer.' })

    expect(wrapper.text()).toContain('Gagal terhubung ke printer.')
  })

  it('shows the success text when succeeded and no error', () => {
    const wrapper = mountStep({ succeeded: true })

    expect(wrapper.text()).toContain('Tiket berhasil dicetak.')
  })
})