import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { ref } from 'vue'
import {
  AutoLoginAuthTokenProvider,
  type AutoLoginPhase,
  type LoginImpl,
} from '@aq/auth'

const loginImpl = vi.fn<LoginImpl>(async () => ({
  pegId: 'P', userName: 'U', email: 'a@b.c',
  tokenAuth: 'jwt', listRole: [],
}))

let phase: { value: AutoLoginPhase }
let provider: AutoLoginAuthTokenProvider

vi.mock('../../infrastructure', () => {
  return {
    getAuthTokenProvider: () => provider,
  }
})

beforeEach(() => {
  phase = ref<AutoLoginPhase>({ kind: 'idle' }) as { value: AutoLoginPhase }
  provider = {
    phase,
    login: vi.fn(async (email: string, pass: string) => {
      await loginImpl('http://localhost:5000/api', { email, pass })
      phase.value = { kind: 'authenticated', token: 'jwt', expiredAt: new Date(Date.now() + 3600_000).toISOString() }
    }),
    logout: vi.fn(),
    getToken: () => null,
    awaitAuthenticated: async () => {},
    destroy: vi.fn(),
  } as unknown as AutoLoginAuthTokenProvider
})

afterEach(() => {
  vi.restoreAllMocks()
})

async function mountView(initialRoute = '/login') {
  const LoginView = (await import('../LoginView.vue')).default
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/login', name: 'login', component: LoginView },
      { path: '/display/:screenId?', name: 'display', component: { template: '<div>display</div>' } },
    ],
  })
  await router.push(initialRoute)
  await router.isReady()

  const wrapper = mount(LoginView, {
    global: { plugins: [router] },
  })
  // Inject the mocked provider
  ;(wrapper.vm as unknown as { provider: AutoLoginAuthTokenProvider }).provider = provider
  return { wrapper, router }
}

describe('LoginView', () => {
  it('renders form when phase is idle', async () => {
    const { wrapper } = await mountView()
    expect(wrapper.find('input[type=email]').exists()).toBe(true)
    expect(wrapper.find('input[type=password]').exists()).toBe(true)
    expect(wrapper.find('button[type=submit]').exists()).toBe(true)
  })

  it('disables submit when fields are empty', async () => {
    const { wrapper } = await mountView()
    const button = wrapper.find('button[type=submit]')
    expect(button.attributes('disabled')).toBeDefined()
  })

  it('calls provider.login on submit and redirects on authenticated', async () => {
    const { wrapper, router } = await mountView('/login?redirect=/display/lobby')
    await wrapper.find('input[type=email]').setValue('a@b.c')
    await wrapper.find('input[type=password]').setValue('pw')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()
    expect(provider.login).toHaveBeenCalledWith('a@b.c', 'pw')
    expect(router.currentRoute.value.fullPath).toBe('/display/lobby')
  })

  it('shows "Sedang login…" when phase is logging-in', async () => {
    phase.value = { kind: 'logging-in' }
    const { wrapper } = await mountView()
    expect(wrapper.text()).toContain('Sedang login')
  })

  it('shows error banner when phase is error', async () => {
    phase.value = { kind: 'error', message: 'Email atau password salah.' }
    const { wrapper } = await mountView()
    expect(wrapper.text()).toContain('Email atau password salah.')
  })

  it('shows session-expired banner when ?session=expired', async () => {
    const { wrapper } = await mountView('/login?session=expired')
    expect(wrapper.text()).toContain('Sesi Anda telah berakhir')
  })
})
