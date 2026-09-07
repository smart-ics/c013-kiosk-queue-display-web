import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import LoginPage from '../LoginPage.vue'
import { version } from '../../../package.json'

const router = createRouter({
  history: createMemoryHistory(),
  routes: [{ path: '/login', name: 'login', component: LoginPage }],
})

describe('LoginPage', () => {
  it('renders the app version', async () => {
    await router.push('/login')
    await router.isReady()
    const wrapper = mount(LoginPage, { global: { plugins: [router] } })
    expect(wrapper.text()).toContain(`v${version}`)
  })
})