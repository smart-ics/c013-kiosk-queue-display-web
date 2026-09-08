import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import type { AdmissionQueueIntakeResponse } from '@aq/shared-types'
import AssistanceQueueStep from '../AssistanceQueueStep.vue'

const ticket: AdmissionQueueIntakeResponse = {
  queueLabel: 'BOK 001',
  antrianId: 'A-123',
  noUrut: 1,
}

function mountStep(props: Partial<{
  ticket?: AdmissionQueueIntakeResponse
  title?: string
  servicePointName?: string
  variant?: 'assistance' | 'admisiRedirect'
  printPending?: boolean
  printSucceeded?: boolean
  printError?: string | null
}> = {}) {
  return mount(AssistanceQueueStep, {
    props: {
      ticket,
      title: 'Nomor Antrian Bantuan',
      printPending: false,
      printSucceeded: true,
      printError: null,
      ...props,
    },
  })
}

describe('AssistanceQueueStep', () => {
  it('shows the admisi redirect context for a booking fallback', () => {
    const wrapper = mountStep({ variant: 'admisiRedirect' })

    expect(wrapper.get('[data-testid="assist-title"]').text()).toBe(
      'Registrasi di Kiosk belum berhasil',
    )
    expect(wrapper.text()).toContain('Nomor Antrian Admisi')
    expect(wrapper.get('[data-testid="assist-queue-label"]').text()).toBe('BOK 001')
    expect(wrapper.text()).toContain('Silakan menuju Loket Admisi')
    expect(wrapper.text()).not.toContain('Layanan:')
  })

  it('keeps the generic assistance layout when not in admisi redirect mode', () => {
    const wrapper = mountStep({ servicePointName: 'Loket Bantuan' })

    expect(wrapper.find('[data-testid="assist-title"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Nomor Antrian Bantuan')
    expect(wrapper.text()).toContain('Loket Bantuan')
    expect(wrapper.get('[data-testid="assist-queue-label"]').text()).toBe('BOK 001')
  })

  it('emits reprint and finish actions', async () => {
    const wrapper = mountStep({ variant: 'admisiRedirect' })

    await wrapper.get('[data-testid="assist-reprint"]').trigger('click')
    await wrapper.get('[data-testid="assist-finish"]').trigger('click')

    expect(wrapper.emitted('reprint')).toHaveLength(1)
    expect(wrapper.emitted('finish')).toHaveLength(1)
  })
})