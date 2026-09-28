import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import type {
  AdmissionQueueIntakeResponse,
  GroupJaminanMap,
  JadwalItem,
  PatientContextSearchResponse,
  ServiceItem,
} from '@aq/shared-types'
import KioskPage from '../KioskPage.vue'

const selfPrintMocks = vi.hoisted(() => ({
  printRegistration: vi.fn(
    async (_ctx: { result: { regId: string; noAntrian: number }; pasienName?: string }) => ({
      printed: true,
    }),
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
  intake: vi.fn<() => Promise<AdmissionQueueIntakeResponse>>(async () => ({
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
  listKarcis: vi.fn<() => Promise<Array<{ id: string; name: string }>>>(async () => [
    { id: 'K', name: 'Karcis' },
  ]),
  registerWalkInDirect: vi.fn<() => Promise<{ regId: string; noAntrian: number }>>(async () => ({
    regId: 'R2',
    noAntrian: 13,
  })),
  setDataEligibility: vi.fn<() => Promise<string>>(async () => 'OK'),
  getRujukanByPpk: vi.fn(async () => ({
    rujukanId: 'RUJ-LOCAL-1',
    rujukanName: 'Puskesmas Sehat',
    isAktif: true,
    ppkId: '0137R016',
    alamat: {},
    telepon: '',
    rujukanTipeId: '1',
    rujukanTipeName: 'First Level',
    kelasId: '3',
    kelasName: 'Kelas 3',
    caraMasukDkId: '5',
    caraMasukDkName: 'RUJUKAN',
  })),
}))

const jetliMocks = vi.hoisted(() => ({
  getGroupJaminanMap: vi.fn<() => Promise<GroupJaminanMap | null>>(async () => null),
  getRujukanSkpd: vi.fn(async () => ({
    peserta: {
      noPeserta: '000123456',
      nama: 'Andi',
      hakKelas: { kode: '3', nama: 'Kelas 3' },
      status: { kode: '1', info: 'AKTIF' },
      jenisPeserta: { kode: 'PNS', nama: 'PNS' },
      provider: { kode: 'P1', nama: 'RS A' },
      prbInfo: null,
      tglTat: '2026-08-06',
      tglLahir: '1990-01-01',
    },
    rujukan: {
      noRujukan: 'REF1',
      tglRujukan: '2026-08-01',
      tujuan: { poliBpjsId: 'POL-1', poliBpjsName: 'Poli Umum' },
      faskesPerujuk: { faskesId: '0137R016', faskesName: 'Puskesmas Sehat' },
      diagnosaRujukan: { icd10Id: 'E11.8', icd10Name: 'Type 2 DM' },
    },
    listSkdp: [],
  })),
  createSep: vi.fn(async () => {
    throw new Error('SEP create failed')
  }),
  uploadSep: vi.fn(async () => ({
    sepId: 'sep-1',
    sepNo: '0112R',
    noPeserta: '000123456',
    namaPeserta: 'Andi',
  })),
}))

const serviceCatalogMocks = vi.hoisted(() => ({
  listPoli: vi.fn<() => Promise<ServiceItem[]>>(async () => []),
  listDokter: vi.fn<() => Promise<ServiceItem[]>>(async () => []),
  listJadwal: vi.fn<() => Promise<JadwalItem[]>>(async () => []),
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
    intake: registrationMocks.intake,
  })),
  getHisApi: vi.fn(() => ({
    getBusinessDate: vi.fn(async () => ({ businessDate: '2026-09-02' })),
    searchBooking: registrationMocks.searchBooking,
    bookingAssistance: registrationMocks.bookingAssistance,
    patientContextSearch: registrationMocks.patientContextSearch,
    deepSearchPasien: registrationMocks.deepSearchPasien,
    listPolis: registrationMocks.listPolis,
    listKarcis: registrationMocks.listKarcis,
    registerWalkInDirect: registrationMocks.registerWalkInDirect,
    setDataEligibility: registrationMocks.setDataEligibility,
    getRujukanByPpk: registrationMocks.getRujukanByPpk,
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
    getRujukanSkpd: jetliMocks.getRujukanSkpd,
    createSep: jetliMocks.createSep,
    uploadSep: jetliMocks.uploadSep,
    getGroupJaminanMap: jetliMocks.getGroupJaminanMap,
  })),
  getServiceCatalog: vi.fn(() => serviceCatalogMocks),
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

  it('handles reprint event from PatientContextConfirmStep', async () => {
    selfPrintMocks.printRegistration.mockClear()
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

    const step = wrapper.findComponent({ name: 'PatientContextConfirmStep' })
    expect(step.exists()).toBe(true)
    step.vm.$emit('reprint')
    await flushPromises()

    expect(selfPrintMocks.printRegistration).not.toHaveBeenCalled()
  })

  it('completes the reprint flow from booking search to reprint', async () => {
    selfPrintMocks.printRegistration.mockClear()
    selfPrintMocks.printPatientLabel.mockClear()
    registrationMocks.patientContextSearch.mockImplementationOnce(async () => ({
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
            visitDate: '2026-09-02',
            visitTime: '08:30',
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
      bestMatch: {
        kind: 'Registration',
        id: 'RG12345678',
        patientName: 'Andi',
        patientId: 'PT1',
        birthDate: '1990-01-01',
        gender: 'L',
        locality: null,
        maskedNik: null,
        maskedPhone: null,
        visitDate: '2026-09-02',
        visitTime: '08:30',
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
      canCreatePatient: false,
    }))
    const wrapper = mountPage()

    await flushPromises()
    await flushPromises()
    await wrapper.get('[data-testid="search-keyword"]').setValue('Andi')
    await wrapper.get('[data-testid="search-submit"]').trigger('click')
    await flushPromises()
    await flushPromises()

    expect(wrapper.findComponent({ name: 'PatientContextConfirmStep' }).exists()).toBe(true)

    await wrapper.get('[data-testid="patient-RG12345678"]').trigger('click')
    await flushPromises()
    await flushPromises()

    expect(wrapper.text()).toContain('Cetak Ulang Karcis Registrasi')
    expect(wrapper.get('[data-testid="reprint-no-antrian"]').text()).toBe('12')

    await wrapper.get('[data-testid="reprint-btn"]').trigger('click')
    await flushPromises()

    expect(selfPrintMocks.printRegistration).toHaveBeenCalledTimes(1)
    expect(selfPrintMocks.printRegistration).toHaveBeenCalledWith(
      expect.objectContaining({
        result: { regId: 'RG12345678', noAntrian: 12 },
        pasienName: 'Andi',
      }),
    )
    expect(selfPrintMocks.printPatientLabel).toHaveBeenCalledTimes(1)
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
    registrationMocks.intake.mockReset()
    registrationMocks.intake.mockResolvedValue({
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

    expect(registrationMocks.bookingAssistance).toHaveBeenCalledTimes(1)
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

  it('restores the selector when automatic assistance fails', async () => {
    registrationMocks.searchBooking.mockRejectedValueOnce(new Error('booking failed'))
    registrationMocks.bookingAssistance.mockRejectedValueOnce(new Error('assist failed'))
    const wrapper = mountPage()

    await flushPromises()
    await flushPromises()
    await wrapper.get('[data-testid="search-keyword"]').setValue('0002036512473')
    await wrapper.get('[data-testid="search-submit"]').trigger('click')
    await flushPromises()
    await flushPromises()

    expect(registrationMocks.bookingAssistance).toHaveBeenCalledTimes(1)
    expect(wrapper.find('[data-testid="assist-BOK"]').exists()).toBe(true)
    expect(selfPrintMocks.printQueueTicket).not.toHaveBeenCalled()
  })

  it('does not auto-intake when patient context returns no results', async () => {
    registrationMocks.searchBooking.mockResolvedValueOnce([])
    registrationMocks.patientContextSearch.mockImplementationOnce(async () => ({
      businessDate: '2026-09-02',
      bookings: { items: [], total: 0, hasMore: false },
      registrations: { items: [], total: 0, hasMore: false },
      patients: { items: [], total: 0, hasMore: false },
      bestMatch: null,
      canCreatePatient: false,
    }))
    const wrapper = mountPage()

    await flushPromises()
    await flushPromises()
    await wrapper.get('[data-testid="search-keyword"]').setValue('0002036512473')
    await wrapper.get('[data-testid="search-submit"]').trigger('click')
    await flushPromises()
    await flushPromises()

    expect(registrationMocks.intake).not.toHaveBeenCalled()
    expect(registrationMocks.bookingAssistance).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="assist-redirect-queue"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="assist-BOK"]').exists()).toBe(true)
  })

  it('shows the generic layout for a manual booking selection after failure', async () => {
    registrationMocks.searchBooking.mockRejectedValueOnce(new Error('booking failed'))
    registrationMocks.bookingAssistance.mockRejectedValueOnce(new Error('assist failed'))
    const wrapper = mountPage()

    await flushPromises()
    await flushPromises()
    await wrapper.get('[data-testid="search-keyword"]').setValue('0002036512473')
    await wrapper.get('[data-testid="search-submit"]').trigger('click')
    await flushPromises()
    await flushPromises()

    expect(wrapper.find('[data-testid="assist-BOK"]').exists()).toBe(true)
    await wrapper.get('[data-testid="assist-BOK"]').trigger('click')
    await flushPromises()
    await flushPromises()

    expect(wrapper.find('[data-testid="assist-redirect-queue"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="assist-queue-label"]').text()).toBe('BOK-001')
  })
})

describe('KioskPage cancellable patient search', () => {
  it('ignores a late patient-context result after cancelling the search', async () => {
    let release!: (v: PatientContextSearchResponse) => void
    registrationMocks.patientContextSearch.mockImplementationOnce(
      () => new Promise<PatientContextSearchResponse>((resolve) => { release = resolve }),
    )
    const wrapper = mountPage()
    await flushPromises()
    await flushPromises()
    await wrapper.get('[data-testid="search-keyword"]').setValue('Andi')
    await wrapper.get('[data-testid="search-submit"]').trigger('click')
    await flushPromises()
    await vi.waitFor(() => expect(release).toBeDefined())
    expect(wrapper.find('[data-testid="patient-search-cancel"]').exists()).toBe(true)
    await wrapper.get('[data-testid="patient-search-cancel"]').trigger('click')
    await flushPromises()
    release({
      businessDate: '2026-09-02',
      bookings: { items: [], total: 0, hasMore: false },
      registrations: { items: [], total: 0, hasMore: false },
      patients: { items: [], total: 0, hasMore: false },
      bestMatch: null,
      canCreatePatient: false,
    })
    await flushPromises()
    await flushPromises()
    expect(wrapper.findAll('[data-testid="search-keyword"]').length).toBe(1)
  })
})

describe('KioskPage post-registration recovery fallback', () => {
  beforeEach(() => {
    registrationMocks.searchBooking.mockReset()
    registrationMocks.searchBooking.mockResolvedValue([])
    registrationMocks.patientContextSearch.mockReset()
    registrationMocks.deepSearchPasien.mockReset()
    registrationMocks.deepSearchPasien.mockResolvedValue([])
    registrationMocks.listPolis.mockReset()
    registrationMocks.listPolis.mockResolvedValue([])
    registrationMocks.intake.mockReset()
    registrationMocks.intake.mockResolvedValue({
      queueLabel: 'BOK-001',
      antrianId: 'A1',
      noUrut: 1,
    })
    registrationMocks.bookingAssistance.mockReset()
    registrationMocks.bookingAssistance.mockResolvedValue({
      queueLabel: 'BOK-001',
      antrianId: 'A1',
      noUrut: 1,
    })
    jetliMocks.getGroupJaminanMap.mockReset()
    jetliMocks.getGroupJaminanMap.mockResolvedValue({
      tipeJaminanId: 'BPJS',
      groupJaminanId: 'G1',
      groupJaminanName: 'BPJS',
    })
    serviceCatalogMocks.listPoli.mockReset()
    serviceCatalogMocks.listPoli.mockResolvedValue([])
    serviceCatalogMocks.listDokter.mockReset()
    serviceCatalogMocks.listDokter.mockResolvedValue([])
    serviceCatalogMocks.listJadwal.mockReset()
    serviceCatalogMocks.listJadwal.mockResolvedValue([])
    selfPrintMocks.printQueueTicket.mockClear()
    appConfigMocks.config = {
      bilregApiBase: 'http://x',
      kioskDefaultKarcisId: 'K',
      fallbackServicePoints: { bookingFailure: 'BOK' },
    }
  })

  it('auto-routes a walk-in post-registration failure to the configured admisi fallback', async () => {
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
    registrationMocks.listPolis.mockImplementationOnce(async () => [
      {
        polisId: 'P1',
        noPolis: '000123456',
        atasName: 'Andi',
        pasien: { pasienId: 'PT1' },
        tipeJaminan: { tipeJaminanId: 'BPJS', tipeJaminanName: 'BPJS' },
        tglExpired: null,
      },
    ])
    serviceCatalogMocks.listPoli.mockResolvedValue([{ id: 'POL-1', name: 'Poli Jantung' }])
    serviceCatalogMocks.listDokter.mockResolvedValue([{ id: 'DOC-1', name: 'Dr. Budi' }])
    serviceCatalogMocks.listJadwal.mockResolvedValue([
      { jadwalId: 'JD-1', ppaId: 'DOC-1', jamPraktek: '08:00', sisaKuota: 12 },
    ])

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
    await wrapper.get('[data-testid="guarantee-policy-BPJS"]').trigger('click')
    await flushPromises()
    await flushPromises()

    const poliButton = wrapper.findAll('button').find((b) => b.text().includes('Poli Jantung'))
    await poliButton!.trigger('click')
    await flushPromises()
    await flushPromises()
    const dokterButton = wrapper.findAll('button').find((b) => b.text().includes('Dr. Budi'))
    await dokterButton!.trigger('click')
    await flushPromises()
    await flushPromises()

    await wrapper.get('[data-testid="walkin-confirm"]').trigger('click')
    await flushPromises()
    await flushPromises()

    expect(jetliMocks.createSep).toHaveBeenCalledTimes(1)
    expect(registrationMocks.bookingAssistance).not.toHaveBeenCalled()
    expect(registrationMocks.intake).toHaveBeenCalledTimes(1)
    expect(registrationMocks.intake).toHaveBeenCalledWith({ servicePointId: 'BOK' })
    expect(selfPrintMocks.printQueueTicket).toHaveBeenCalledTimes(1)
    expect(selfPrintMocks.printQueueTicket).toHaveBeenCalledWith(
      expect.objectContaining({ queueLabel: 'BOK-001' }),
      'Loket Bantuan',
      expect.objectContaining({
        regId: 'R2',
        instruction: 'Silakan menuju Loket Admisi untuk penyelesaian berkas.',
      }),
    )
    expect(wrapper.find('[data-testid="assist-redirect-queue"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="assist-title"]').text()).toBe(
      'Registrasi di Kiosk belum berhasil',
    )
  })
})
