import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import type { AdmissionQueueIntakeResponse, PatientContextSearchResponse } from '@aq/shared-types'
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

const registrationMocks = vi.hoisted(() => ({
  searchBooking: vi.fn<() => Promise<unknown[]>>(async () => []),
  bookingAssistance: vi.fn<() => Promise<AdmissionQueueIntakeResponse>>(async () => ({
    queueLabel: 'BOK-001',
    antrianId: 'A1',
    noUrut: 1,
  })),
  patientContextSearch: vi.fn<() => Promise<PatientContextSearchResponse>>(async () => ({
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
  deepSearchPasien: vi.fn<() => Promise<unknown[]>>(async () => []),
  listPolis: vi.fn<() => Promise<unknown[]>>(async () => []),
}))

const appConfigMocks = vi.hoisted(() => ({
  config: {
    bilregApiBase: 'http://x',
    kioskDefaultKarcisId: 'K',
    fallbackServicePoints: { bookingFailure: 'BOK' },
  },
}))

vi.mock('../../infrastructure', () => ({
  getDeviceConfigProvider: vi.fn(async () => ({
     getConfig: vi.fn(async () => ({
       deviceId: 'K01',
       role: 'kiosk',
       printerProxyPort: 5050,
       servicePointIds: ['BOK'],
     })),
  })),
  getAdmissionQueueApi: vi.fn(() => ({
    listServicePoints: vi.fn(async () => [
       { servicePointId: 'BOK', displayName: 'Loket Bantuan', queuePrefix: 'BOK', status: 'Active' },
    ]),
  })),
  getHisApi: vi.fn(() => ({
    getBusinessDate: vi.fn(async () => ({ businessDate: '2026-09-02' })),
searchBooking: registrationMocks.searchBooking,
    bookingAssistance: registrationMocks.bookingAssistance,
    patientContextSearch: registrationMocks.patientContextSearch,
    deepSearchPasien: registrationMocks.deepSearchPasien,
    listPolis: registrationMocks.listPolis,
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
    getConfig: () => appConfigMocks.config,
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

describe('KioskPage booking fallback assistance', () => {
  beforeEach(() => {
    registrationMocks.searchBooking.mockReset()
    registrationMocks.searchBooking.mockResolvedValue([])
    registrationMocks.bookingAssistance.mockReset()
    registrationMocks.bookingAssistance.mockResolvedValue({
      queueLabel: 'BOK-001',
      antrianId: 'A1',
      noUrut: 1,
    })
    registrationMocks.patientContextSearch.mockReset()
    registrationMocks.patientContextSearch.mockImplementation(async () => ({
      businessDate: '2026-09-02',
      bookings: { items: [], total: 0, hasMore: false },
      registrations: { items: [], total: 0, hasMore: false },
      patients: { items: [], total: 0, hasMore: false },
      bestMatch: null,
      canCreatePatient: false,
    }))
    registrationMocks.deepSearchPasien.mockReset()
    registrationMocks.deepSearchPasien.mockResolvedValue([])
    registrationMocks.listPolis.mockReset()
    registrationMocks.listPolis.mockResolvedValue([])
    selfPrintMocks.printQueueTicket.mockClear()
    appConfigMocks.config = {
      bilregApiBase: 'http://x',
      kioskDefaultKarcisId: 'K',
      fallbackServicePoints: { bookingFailure: 'BOK' },
    }
  })

  it('automatically creates and prints assistance for a mapped fallback', async () => {
    registrationMocks.searchBooking.mockRejectedValueOnce(new Error('booking failed'))
    const wrapper = mountPage()

    await flushPromises()
    await flushPromises()
    await wrapper.get('[data-testid="search-keyword"]').setValue('0002036512473')
    await wrapper.get('[data-testid="search-submit"]').trigger('click')
    await flushPromises()
    await flushPromises()

    expect(registrationMocks.bookingAssistance).toHaveBeenCalledWith(
      expect.objectContaining({ servicePointId: 'BOK' }),
    )
    expect(selfPrintMocks.printQueueTicket).toHaveBeenCalledTimes(1)
    expect(wrapper.get('[data-testid="assist-title"]').text()).toBe(
      'Registrasi di Kiosk belum berhasil',
    )
  })

  it('hides the selector while the automatic fallback is in flight', async () => {
    registrationMocks.searchBooking.mockRejectedValueOnce(new Error('booking failed'))
    let releaseAssistance!: (value: AdmissionQueueIntakeResponse) => void
    registrationMocks.bookingAssistance.mockImplementationOnce(
      () =>
        new Promise<AdmissionQueueIntakeResponse>((resolve) => {
          releaseAssistance = resolve
        }),
    )
    const wrapper = mountPage()

    await flushPromises()
    await flushPromises()
    await wrapper.get('[data-testid="search-keyword"]').setValue('0002036512473')
    await wrapper.get('[data-testid="search-submit"]').trigger('click')
    await flushPromises()
    await flushPromises()

    expect(registrationMocks.bookingAssistance).toHaveBeenCalledTimes(1)
    expect(wrapper.find('[data-testid="assist-BOK"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Mengambil nomor antrian admisi…')

    releaseAssistance({ queueLabel: 'BOK-001', antrianId: 'A1', noUrut: 1 })
    await flushPromises()
    await flushPromises()

    expect(wrapper.find('[data-testid="assist-redirect-queue"]').exists()).toBe(true)
  })

  it('does not auto-assist when bookingFailure is empty and keeps the selector', async () => {
    appConfigMocks.config = {
      bilregApiBase: 'http://x',
      kioskDefaultKarcisId: 'K',
      fallbackServicePoints: { bookingFailure: '' },
    }
    registrationMocks.searchBooking.mockRejectedValueOnce(new Error('booking failed'))
    const wrapper = mountPage()

    await flushPromises()
    await flushPromises()
    await wrapper.get('[data-testid="search-keyword"]').setValue('0002036512473')
    await wrapper.get('[data-testid="search-submit"]').trigger('click')
    await flushPromises()
    await flushPromises()

    expect(registrationMocks.bookingAssistance).not.toHaveBeenCalled()
    expect(selfPrintMocks.printQueueTicket).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="assist-BOK"]').exists()).toBe(true)
  })

  it('does not auto-assist when bookingFailure is unmapped and keeps the selector', async () => {
    appConfigMocks.config = {
      bilregApiBase: 'http://x',
      kioskDefaultKarcisId: 'K',
      fallbackServicePoints: { bookingFailure: 'SP-MISSING' },
    }
    registrationMocks.searchBooking.mockRejectedValueOnce(new Error('booking failed'))
    const wrapper = mountPage()

    await flushPromises()
    await flushPromises()
    await wrapper.get('[data-testid="search-keyword"]').setValue('0002036512473')
    await wrapper.get('[data-testid="search-submit"]').trigger('click')
    await flushPromises()
    await flushPromises()

    expect(registrationMocks.bookingAssistance).not.toHaveBeenCalled()
    expect(selfPrintMocks.printQueueTicket).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="assist-BOK"]').exists()).toBe(true)
  })

  it('does not auto-assist on a walk-in failure and keeps the selector', async () => {
    registrationMocks.searchBooking.mockResolvedValueOnce([])
    registrationMocks.patientContextSearch.mockImplementationOnce(async () => ({
      businessDate: '2026-09-02',
      bookings: { items: [], total: 0, hasMore: false },
      registrations: { items: [], total: 0, hasMore: false },
      patients: {
        items: [
          {
            kind: 'Patient' as const,
            id: 'PT1',
            patientName: 'Andi',
            patientId: 'PT1',
            birthDate: '1990-01-01',
            gender: 'L',
            locality: null,
            maskedNik: null,
            maskedPhone: null,
            visitDate: null,
            visitTime: null,
            serviceName: null,
            doctorName: null,
            state: '',
            bookingId: null,
            registrationId: null,
            matchType: 'Exact' as const,
            isExactMatch: true,
            rank: 1,
            warnings: [],
          },
        ],
        total: 1,
        hasMore: false,
      },
      bestMatch: null,
      canCreatePatient: false,
    }))
    const wrapper = mountPage()

    await flushPromises()
    await flushPromises()
    await wrapper.get('[data-testid="search-keyword"]').setValue('Andi')
    await wrapper.get('[data-testid="search-submit"]').trigger('click')
    await flushPromises()
    await flushPromises()
    await wrapper.get('[data-testid="patient-PT1"]').trigger('click')
    await flushPromises()
    await flushPromises()
    await wrapper.get('[data-testid="guarantee-bpjs-fallback"]').trigger('click')
    await flushPromises()
    await flushPromises()

    expect(wrapper.find('[data-testid="assist-BOK"]').exists()).toBe(true)
    expect(registrationMocks.bookingAssistance).not.toHaveBeenCalled()
    expect(selfPrintMocks.printQueueTicket).not.toHaveBeenCalled()
  })
})
