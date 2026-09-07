import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import ServicePointsPage from '../ServicePointsPage.vue'

const apiMocks = vi.hoisted(() => ({
  listAllServicePoints: vi.fn(),
  upsertServicePoint: vi.fn(),
}))

vi.mock('@/infrastructure', () => ({
  getAdmissionQueueApi: vi.fn(() => ({
    listAllServicePoints: apiMocks.listAllServicePoints,
    upsertServicePoint: apiMocks.upsertServicePoint,
  })),
}))

const activePoint = {
  servicePointId: 'SP-ADMISI',
  displayName: 'Administrasi',
  queuePrefix: 'A',
  status: 'Active' as const,
}

const retiredPoint = {
  servicePointId: 'SP-RETIRED',
  displayName: 'Retired Lama',
  queuePrefix: 'R',
  status: 'Retired' as const,
}

beforeEach(() => {
  apiMocks.listAllServicePoints.mockResolvedValue([activePoint, retiredPoint])
  apiMocks.upsertServicePoint.mockResolvedValue(activePoint)
})

function mountPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return mount(ServicePointsPage, {
    global: { plugins: [[VueQueryPlugin, { queryClient }]] },
  })
}

async function submitForm(wrapper: ReturnType<typeof mountPage>) {
  await wrapper.get('form').trigger('submit')
  await flushPromises()
}

describe('ServicePointsPage', () => {
  it('renders both active and retired service points', async () => {
    const wrapper = mountPage()
    await flushPromises()

    expect(wrapper.text()).toContain('SP-ADMISI')
    expect(wrapper.text()).toContain('Administrasi')
    expect(wrapper.text()).toContain('SP-RETIRED')
    expect(wrapper.text()).toContain('Retired Lama')
    expect(apiMocks.listAllServicePoints).toHaveBeenCalled()
  })

  it('creates a service point with the expected upsert payload', async () => {
    const wrapper = mountPage()
    await flushPromises()

    const inputs = wrapper.findAll('form input')
    await inputs[0]!.setValue('SP-BARU')
    await inputs[1]!.setValue('Baru')
    await inputs[2]!.setValue('B')
    await submitForm(wrapper)

    expect(apiMocks.upsertServicePoint).toHaveBeenCalledWith('SP-BARU', {
      displayName: 'Baru',
      queuePrefix: 'B',
      active: true,
    })
  })

  it('retires an active service point with active:false', async () => {
    const wrapper = mountPage()
    await flushPromises()

    const activeRow = wrapper.findAll('tbody tr')[0]!
    const nonaktifkan = activeRow.findAll('button').find((b) => b.text() === 'Nonaktifkan')!
    await nonaktifkan.trigger('click')
    await flushPromises()

    expect(apiMocks.upsertServicePoint).toHaveBeenCalledWith('SP-ADMISI', {
      displayName: 'Administrasi',
      queuePrefix: 'A',
      active: false,
    })
  })

  it('does not offer reactivation for retired service points', async () => {
    const wrapper = mountPage()
    await flushPromises()

    const retiredRow = wrapper.findAll('tbody tr')[1]!
    expect(retiredRow.text()).toContain('tidak dapat diaktifkan kembali melalui aplikasi ini')
    expect(retiredRow.text()).not.toContain('Nonaktifkan')
  })

  it('editing an active service point keeps active:true', async () => {
    const wrapper = mountPage()
    await flushPromises()

    await wrapper.findAll('tbody tr')[0]!.findAll('button')[0]!.trigger('click')
    const inputs = wrapper.findAll('form input')
    await inputs[1]!.setValue('Administrasi 2')
    await submitForm(wrapper)

    expect(apiMocks.upsertServicePoint).toHaveBeenCalledWith('SP-ADMISI', {
      displayName: 'Administrasi 2',
      queuePrefix: 'A',
      active: true,
    })
  })

  it('editing a retired service point keeps active:false and shows the notice', async () => {
    const wrapper = mountPage()
    await flushPromises()

    await wrapper.findAll('tbody tr')[1]!.findAll('button')[0]!.trigger('click')
    expect(wrapper.text()).toContain('tidak dapat diaktifkan kembali melalui aplikasi ini')
    const inputs = wrapper.findAll('form input')
    await inputs[1]!.setValue('Retired Baru')
    await submitForm(wrapper)

    expect(apiMocks.upsertServicePoint).toHaveBeenCalledWith('SP-RETIRED', {
      displayName: 'Retired Baru',
      queuePrefix: 'R',
      active: false,
    })
  })

  it('has no form control bound to fallbackServicePoints', async () => {
    const wrapper = mountPage()
    await flushPromises()

    expect(wrapper.html()).not.toContain('fallbackServicePoints')
  })
})