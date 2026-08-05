import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import KioskHome from '../KioskHome.vue'

describe('KioskHome (search-first)', () => {
  it('renders search input with placeholder', () => {
    const wrapper = mount(KioskHome, { props: { intakeAvailable: true } })
    const input = wrapper.get<HTMLInputElement>('[data-testid="search-keyword"]')
    expect(input.element.placeholder).toContain('Kode booking')
  })

  it('emits startSearch when form is submitted', async () => {
    const wrapper = mount(KioskHome, { props: { intakeAvailable: true } })
    const input = wrapper.get<HTMLInputElement>('[data-testid="search-keyword"]')
    await input.setValue('BK001')
    await wrapper.get('[data-testid="search-submit"]').trigger('click')
    expect(wrapper.emitted('startSearch')).toEqual([['BK001']])
  })

  it('does not emit startSearch with empty input', async () => {
    const wrapper = mount(KioskHome, { props: { intakeAvailable: true } })
    await wrapper.get('[data-testid="search-submit"]').trigger('click')
    expect(wrapper.emitted('startSearch')).toBeUndefined()
  })

  it('emits scanBooking when scan button clicked', async () => {
    const wrapper = mount(KioskHome, { props: { intakeAvailable: true } })
    await wrapper.get('[data-testid="scan-booking"]').trigger('click')
    expect(wrapper.emitted('scanBooking')).toHaveLength(1)
  })

  it('emits startWalkin from daftar tanpa booking link', async () => {
    const wrapper = mount(KioskHome, { props: { intakeAvailable: true } })
    await wrapper.get('[data-testid="start-walkin"]').trigger('click')
    expect(wrapper.emitted('startWalkin')).toHaveLength(1)
  })
})
