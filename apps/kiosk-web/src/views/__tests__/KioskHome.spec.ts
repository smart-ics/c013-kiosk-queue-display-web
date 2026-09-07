import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { version } from '../../../package.json'
import KioskHome from '../KioskHome.vue'

vi.mock('@aq/app-config', () => ({
  configService: {
    getConfig: () => ({ bilregApiBase: 'http://localhost:5000/api' }),
  },
}))

describe('KioskHome', () => {
  it('renders search input with placeholder', () => {
    const wrapper = mount(KioskHome, { props: { intakeAvailable: true, businessDate: null } })
    const input = wrapper.get<HTMLInputElement>('[data-testid="search-keyword"]')
    expect(input.element.placeholder).toContain('Kode booking')
  })

  it('emits startSearch when form is submitted', async () => {
    const wrapper = mount(KioskHome, { props: { intakeAvailable: true, businessDate: null } })
    const input = wrapper.get<HTMLInputElement>('[data-testid="search-keyword"]')
    await input.setValue('BK001')
    await wrapper.get('[data-testid="search-submit"]').trigger('click')
    expect(wrapper.emitted('startSearch')).toEqual([['BK001']])
  })

  it('does not emit startSearch with empty input', async () => {
    const wrapper = mount(KioskHome, { props: { intakeAvailable: true, businessDate: null } })
    await wrapper.get('[data-testid="search-submit"]').trigger('click')
    expect(wrapper.emitted('startSearch')).toBeUndefined()
  })

  it('emits startSearch on enter key', async () => {
    const wrapper = mount(KioskHome, { props: { intakeAvailable: true, businessDate: null } })
    const input = wrapper.get<HTMLInputElement>('[data-testid="search-keyword"]')
    await input.setValue('BK001')
    await input.trigger('keyup.enter')
    expect(wrapper.emitted('startSearch')).toEqual([['BK001']])
  })

  it('emits startIntake from ambil antrian admisi button', async () => {
    const wrapper = mount(KioskHome, { props: { intakeAvailable: true, businessDate: null } })
    await wrapper.get('[data-testid="start-intake"]').trigger('click')
    expect(wrapper.emitted('startIntake')).toHaveLength(1)
  })

  it('renders split layout with ad panel', () => {
    const wrapper = mount(KioskHome, { props: { intakeAvailable: true, businessDate: null } })
    expect(wrapper.find('[data-testid="kiosk-ad-panel"]').exists()).toBe(true)
  })

  it('renders package version in the footer', () => {
    const wrapper = mount(KioskHome, { props: { intakeAvailable: true, businessDate: null } })
    expect(wrapper.text()).toContain(`v${version}`)
  })

  it('renders the fallback video source when no media directory is configured', async () => {
    const wrapper = mount(KioskHome, { props: { intakeAvailable: true, businessDate: null } })
    await nextTick()
    const video = wrapper.get<HTMLVideoElement>('[data-testid="media-video"]')
    expect(video.attributes('src')).toBe('/adv-video.mp4')
  })
})
