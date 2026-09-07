import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import KioskPage from '../KioskPage.vue'

const selfPrintMocks = vi.hoisted(() => ({
  printRegistration: vi.fn(
    async (_ctx: {
      result: { regId: string; noAntrian: number }
      pasienName?: string
    }) => ({ printed: true }),
  ),
  printPatientLabel: vi.fn(async () => ({ printed: true })),
  printQueueTicket: vi.fn(async () => ({ printed: true })),
  resetPrintState: vi.fn(),
}))

vi.mock('../../infrastructure', () => ({
  getDeviceConfigProvider: vi.fn(async () => ({
    getConfig: vi.fn(async () => ({ deviceId: 'K01', role: 'kiosk', printerProxyPort: 5050 })),
  })),
  getAdmissionQueueApi: vi.fn(() => ({
    listServicePoints: vi.fn(async () => [
      { servicePointId: 'SP1', displayName: 'Poli Jantung', queuePrefix: 'PJ', status: 'Active' },
    ]),
  })),
  getHisApi: vi.fn(() => ({
    getBusinessDate: vi.fn(async () => ({ businessDate: '2026-09-02' })),
    searchBooking: vi.fn(async () => []),
    patientContextSearch: vi.fn(async () => ({
      businessDate: '2026-09-02',
      bookings: { items: [], total: 0, hasMore: false },
      registrations: {
        items: [
          {
            kind: 'Registration',
            id: 'RG12345678',
            patientName: 'Andi',
            patientId: 'PT1',
            birthDate: '1990-01-01',
            gender: 'L',
            locality: null,
            maskedNik: null,
            maskedPhone: null,
            visitDate: null,
            visitTime: null,
            serviceName: 'Poli Jantung',
            doctorName: 'Dr. Budi',
            state: 'Active',
            bookingId: null,
            registrationId: 'RG12345678',
            matchType: 'Exact',
            isExactMatch: true,
            rank: 1,
            warnings: [],
          },
        ],
        total: 1,
        hasMore: false,
      },
      patients: { items: [], total: 0, hasMore: false },
      bestMatch: null,
      canCreatePatient: false,
    })),
    getRegistrationPrintData: vi.fn(async () => ({
      regId: 'RG12345678',
      noAntrian: 12,
      pasienName: 'Andi',
      pasienId: 'PT1',
      tglLahir: '1990-01-01',
      tipeJaminanName: 'Umum',
      noSep: undefined,
      serviceName: 'Poli Jantung',
      dokterName: 'Dr. Budi',
    })),
  })),
  getJetliApi: vi.fn(() => ({
    getGroupJaminanMap: vi.fn(async () => null),
  })),
  getServiceCatalog: vi.fn(() => ({
    listPoli: vi.fn(async () => []),
    listDokter: vi.fn(async () => []),
    listJadwal: vi.fn(async () => []),
  })),
}))

vi.mock('@aq/app-config', () => ({
  configService: {
    getConfig: () => ({ bilregApiBase: 'http://x', kioskDefaultKarcisId: 'K' }),
  },
}))

vi.mock('@aq/device-config', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@aq/device-config')>()),
}))

vi.mock('../../lib/qrScanner', () => ({
  scanQrFromCamera: vi.fn(async () => ({ error: 'n/a' })),
}))

vi.mock('../../lib/biometric', () => ({
  createBiometricClient: vi.fn(() => ({ verify: vi.fn(async () => ({ outcome: 'SUCCESS' })) })),
}))

vi.mock('../../composables/useKioskSelfPrint', () => ({
  useKioskSelfPrint: vi.fn(() => ({
    printPending: { value: false },
    printError: { value: null },
    printSucceeded: { value: false },
    printRegistration: selfPrintMocks.printRegistration,
    printPatientLabel: selfPrintMocks.printPatientLabel,
    printQueueTicket: selfPrintMocks.printQueueTicket,
    resetPrintState: selfPrintMocks.resetPrintState,
  })),
}))

const KioskHomeStub = defineComponent({
  name: 'KioskHome',
  props: ['intakeAvailable', 'businessDate', 'pending'],
  emits: ['startSearch', 'startIntake'],
  data() {
    return { keyword: '' }
  },
  methods: {
    submit() {
      this.$emit('startSearch', this.keyword)
    },
  },
  template: `
    <div>
      <input data-testid="search-keyword" v-model="keyword" @keyup.enter="submit" />
      <button data-testid="search-submit" @click="submit">Cari</button>
    </div>
  `,
})

function mountPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return mount(KioskPage, {
    props: { stationId: 'K01' },
    global: {
      plugins: [[VueQueryPlugin, { queryClient }]],
      stubs: { KioskHeader: true, KioskHome: KioskHomeStub },
    },
  })
}

async function reachReprintStep(wrapper: ReturnType<typeof mountPage>) {
  await flushPromises()
  await flushPromises()
  const input = wrapper.get<HTMLInputElement>('[data-testid="search-keyword"]')
  await input.setValue('RG12345678')
  await wrapper.get('[data-testid="search-submit"]').trigger('click')
  await flushPromises()
  await flushPromises()
}

describe('KioskPage direct registration reprint flow', () => {
  it('renders the reprint step with the loaded reg data and does not print on render', async () => {
    selfPrintMocks.printRegistration.mockClear()
    const wrapper = mountPage()

    await reachReprintStep(wrapper)

    expect(wrapper.get('[data-testid="reprint-reg-id"]').text()).toContain('RG12345678')
    expect(wrapper.get('[data-testid="reprint-no-antrian"]').text()).toContain('12')
    expect(wrapper.text()).toContain('Cetak Ulang Karcis Registrasi')
    expect(selfPrintMocks.printRegistration).not.toHaveBeenCalled()
  })

  it('reprints the loaded registration when clicking Cetak ulang', async () => {
    selfPrintMocks.printRegistration.mockClear()
    const wrapper = mountPage()

    await reachReprintStep(wrapper)

    await wrapper.get('[data-testid="reprint-btn"]').trigger('click')
    await flushPromises()

    expect(selfPrintMocks.printRegistration).toHaveBeenCalledTimes(1)
    const ctx = selfPrintMocks.printRegistration.mock.calls[0][0]
    expect(ctx.result).toEqual({ regId: 'RG12345678', noAntrian: 12 })
    expect(ctx.pasienName).toBe('Andi')
  })

  it('returns to home when clicking Kembali ke menu', async () => {
    const wrapper = mountPage()

    await reachReprintStep(wrapper)

    await wrapper.get('[data-testid="reprint-finish"]').trigger('click')
    await flushPromises()

    expect(wrapper.findAll('[data-testid="reprint-reg-id"]').length).toBe(0)
    expect(wrapper.findAll('[data-testid="search-keyword"]').length).toBe(1)
  })
})