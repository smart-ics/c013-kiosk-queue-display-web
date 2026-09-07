import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import AppShell from '../AppShell.vue'
import { version } from '../../../package.json'

const router = createRouter({
  history: createMemoryHistory(),
  routes: [{ path: '/', component: { template: '<div />' } }],
})

describe('AppShell', () => {
  it('renders the app version in the footer', () => {
    const wrapper = mount(AppShell, {
      global: { plugins: [router], stubs: { RouterView: true, RouterLink: true } },
    })
    expect(wrapper.text()).toContain(`v${version}`)
  })
})