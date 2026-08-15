import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import WalkinServiceStep from '../steps/WalkinServiceStep.vue'
import type { ServiceItem } from '@aq/shared-types'
import type { ServiceCatalog } from '../../lib/serviceCatalog'

const mockPolis: ServiceItem[] = Array.from({ length: 10 }, (_, i) => ({
  id: `POLI${i}`,
  name: `Poliklinik ${i}`,
}))

const mockDokter: ServiceItem[] = Array.from({ length: 8 }, (_, i) => ({
  id: `DOKTER${i}`,
  name: `Dokter ${i}`,
}))

const mockCatalog: Partial<ServiceCatalog> = {
  listPoli: vi.fn().mockResolvedValue(mockPolis),
  listDokter: vi.fn().mockResolvedValue(mockDokter),
  listJadwal: vi
    .fn()
    .mockResolvedValue([
      { jadwalId: 'J1', ppaId: 'DOKTER0', jamPraktek: '08:00 - 12:00', sisaKuota: 10 },
    ]),
}

describe('WalkinServiceStep', () => {
  it('loads and paginates polyclinics list', async () => {
    const wrapper = mount(WalkinServiceStep, {
      props: {
        catalog: mockCatalog as ServiceCatalog,
        pending: false,
      },
    })

    // Wait for loadPolis to resolve
    await new Promise((resolve) => setTimeout(resolve, 0))
    await wrapper.vm.$nextTick()

    // 4 items on page 1
    const buttons = wrapper.findAll('.radio-card')
    expect(buttons).toHaveLength(4)
    expect(buttons[0].text()).toContain('Poliklinik 0')
    expect(buttons[3].text()).toContain('Poliklinik 3')

    const pagination = wrapper.get('[data-testid="kiosk-pagination"]')
    expect(pagination.text()).toContain('1/3')

    // Click next page
    await pagination.get('.next-btn').trigger('click')

    const buttonsPage2 = wrapper.findAll('.radio-card')
    expect(buttonsPage2).toHaveLength(4)
    expect(buttonsPage2[0].text()).toContain('Poliklinik 4')
    expect(buttonsPage2[3].text()).toContain('Poliklinik 7')
    expect(pagination.text()).toContain('2/3')
  })

  it('navigates to doctor list and paginates it', async () => {
    const wrapper = mount(WalkinServiceStep, {
      props: {
        catalog: mockCatalog as ServiceCatalog,
        pending: false,
      },
    })

    // Wait for loadPolis to resolve
    await new Promise((resolve) => setTimeout(resolve, 0))
    await wrapper.vm.$nextTick()

    // Choose first polyclinic
    await wrapper.find('.radio-card').trigger('click')
    await new Promise((resolve) => setTimeout(resolve, 0))
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Pilih Dokter - Poliklinik 0')

    // 4 items on page 1 of doctors
    const buttons = wrapper.findAll('.radio-card')
    expect(buttons).toHaveLength(4)
    expect(buttons[0].text()).toContain('Dokter 0')

    const pagination = wrapper.get('[data-testid="kiosk-pagination"]')
    expect(pagination.text()).toContain('1/2')

    // Click next page
    await pagination.get('.next-btn').trigger('click')

    const buttonsPage2 = wrapper.findAll('.radio-card')
    expect(buttonsPage2).toHaveLength(4)
    expect(buttonsPage2[0].text()).toContain('Dokter 4')
    expect(pagination.text()).toContain('2/2')

    // Click back to clinic
    await wrapper.find('.secondary-btn').trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Pilih Poliklinik')
    expect(wrapper.get('[data-testid="kiosk-pagination"]').text()).toContain('1/3')
  })

  it('auto-selects when doctor has exactly 1 schedule', async () => {
    const wrapper = mount(WalkinServiceStep, {
      props: {
        catalog: mockCatalog as ServiceCatalog,
        pending: false,
      },
    })

    await new Promise((resolve) => setTimeout(resolve, 0))
    await wrapper.vm.$nextTick()

    // Choose first polyclinic
    await wrapper.find('.radio-card').trigger('click')
    await new Promise((resolve) => setTimeout(resolve, 0))
    await wrapper.vm.$nextTick()

    // Choose first doctor (who has 1 schedule)
    await wrapper.find('.radio-card').trigger('click')
    await new Promise((resolve) => setTimeout(resolve, 0))
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('select')).toHaveLength(1)
    expect(wrapper.emitted('select')?.[0]?.[0]).toMatchObject({
      poli: mockPolis[0],
      dokter: mockDokter[0],
      jadwal: { jadwalId: 'J1' },
    })
  })

  it('displays schedule selector when doctor has multiple schedules', async () => {
    const multiJadwal = [
      { jadwalId: 'J1', ppaId: 'DOKTER0', jamPraktek: '08:00 - 12:00', sisaKuota: 10 },
      { jadwalId: 'J2', ppaId: 'DOKTER0', jamPraktek: '14:00 - 18:00', sisaKuota: 5 },
    ]
    const customCatalog = {
      ...mockCatalog,
      listJadwal: vi.fn().mockResolvedValue(multiJadwal),
    }

    const wrapper = mount(WalkinServiceStep, {
      props: {
        catalog: customCatalog as ServiceCatalog,
        pending: false,
      },
    })

    await new Promise((resolve) => setTimeout(resolve, 0))
    await wrapper.vm.$nextTick()

    // Choose first polyclinic
    await wrapper.find('.radio-card').trigger('click')
    await new Promise((resolve) => setTimeout(resolve, 0))
    await wrapper.vm.$nextTick()

    // Choose first doctor (who has 2 schedules)
    await wrapper.find('.radio-card').trigger('click')
    await new Promise((resolve) => setTimeout(resolve, 0))
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Pilih Jadwal')
    expect(wrapper.emitted('select')).toBeUndefined()

    // Select second schedule J2
    const buttons = wrapper.findAll('.radio-card')
    expect(buttons).toHaveLength(2)
    expect(buttons[1].text()).toContain('14:00 - 18:00')
    expect(buttons[1].text()).toContain('Sisa Kuota: 5')

    await buttons[1].trigger('click')
    expect(wrapper.emitted('select')).toHaveLength(1)
    expect(wrapper.emitted('select')?.[0]?.[0]).toMatchObject({
      poli: mockPolis[0],
      dokter: mockDokter[0],
      jadwal: { jadwalId: 'J2' },
    })
  })
})
