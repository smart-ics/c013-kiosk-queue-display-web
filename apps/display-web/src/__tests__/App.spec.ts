import { describe, expect, it } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import App from '../App.vue'
import { version } from '../../package.json'

describe('App', () => {
  it('renders the app version in the footer badge', () => {
    const wrapper = shallowMount(App)
    expect(wrapper.text()).toContain(`v${version}`)
  })
})