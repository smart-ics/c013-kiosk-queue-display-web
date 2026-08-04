import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import KioskHome from '../KioskHome.vue'

describe('KioskHome', () => {
  it('renders the three entry buttons', () => {
    const wrapper = mount(KioskHome, { props: { intakeAvailable: true } })
    expect(wrapper.get('[data-testid="start-booking"]').text()).toContain('Booking')
    expect(wrapper.get('[data-testid="start-walkin"]').text()).toContain('Tanpa Booking')
    expect(wrapper.get('[data-testid="start-intake"]').text()).toContain('Antrian Pendaftaran')
  })

  it('disables intake when no offerings', () => {
    const wrapper = mount(KioskHome, { props: { intakeAvailable: false } })
    expect((wrapper.get('[data-testid="start-intake"]').element as HTMLButtonElement).disabled).toBe(true)
  })
})
