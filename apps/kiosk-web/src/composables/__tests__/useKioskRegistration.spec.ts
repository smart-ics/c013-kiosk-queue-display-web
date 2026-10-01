import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import { ApiClientError } from '@aq/api-client'
import type {
  BookingDetail,
  BookingSearchItem,
  GroupJaminanMap,
  Polis,
  ResponseCreateSep,
  ResponseUploadSep,
} from '@aq/shared-types'
import { sepCreateBodySchema } from '@aq/shared-types'
import {
  useKioskRegistration,
  buildSepPayloadPolicy,
  type BpjsReference,
  type KioskRegistrationDeps,
} from '../useKioskRegistration'
import { SEP_DATE_TIME_PATTERN, SepDateContractError } from '../../lib/sepDate'
import { SEP_CONTRACT_FAILURE_LOG_PREFIX } from '../../lib/sepContract'
import { ADMISI_FALLBACK_NOTICE_TEXT } from '../../lib/queueTicket'
import { UPLOAD_IDENTITY_INVALID_LOG_PREFIX } from '../../lib/uploadIdentity'

const bookingItem: BookingSearchItem = {
  bookingId: 'BK1',
  bookingDate: '2026-08-03',
  reg: { regId: 'R0', pasienId: 'PT1', pasienName: 'Andi' },
  layanan: { layananId: 'LY1', layananName: 'Poli Jantung' },
  dokter: { ppaId: 'DP1', ppaName: 'Dr. X', isDefault: true },
  tglBerobat: '2026-08-03',
  jamPraktek: '08:00',
  noAntrian: 3,
  extAppRef: { extAppName: 'APP', reffId: 'REF1', checkInQr: 'QR1' },
}

const bpjsDetail: BookingDetail = {
  ...bookingItem,
  coverageInfo: { asuransiName: 'BPJS', noPeserta: '000123456', noRujukan: 'REF1' },
}

const umumDetail: BookingDetail = {
  ...bookingItem,
  coverageInfo: { asuransiName: '', noPeserta: '', noRujukan: '' },
}

const bpjsPolis: Polis = {
  polisId: 'P1',
  noPolis: '000123456',
  atasName: 'Andi',
  pasien: { pasienId: 'PT1' },
  tipeJaminan: { tipeJaminanId: 'BPJS', tipeJaminanName: 'BPJS' },
  tglExpired: null,
}

const group: GroupJaminanMap = {
  tipeJaminanId: 'BPJS',
  groupJaminanId: 'G1',
  groupJaminanName: 'BPJS',
}

const contextItem = {
  kind: 'Patient' as const,
  id: 'P001',
  patientName: 'Budi',
  patientId: 'PT1',
  birthDate: '1990-01-01',
  gender: 'L',
  locality: 'Jakarta',
  maskedNik: '123456****',
  maskedPhone: null,
  visitDate: null,
  visitTime: null,
  serviceName: null,
  doctorName: null,
  state: 'Active',
  bookingId: null,
  registrationId: null,
  matchType: 'Exact',
  isExactMatch: true,
  rank: 1,
  warnings: [],
}

const contextResponse = {
  businessDate: '2026-08-03',
  bookings: { items: [], total: 0, hasMore: false },
  registrations: { items: [], total: 0, hasMore: false },
  patients: { items: [contextItem], total: 1, hasMore: false },
  bestMatch: contextItem,
  canCreatePatient: true,
}

const registrationItem = {
  kind: 'Registration' as const,
  id: 'RG12345678',
  patientName: 'Cici',
  patientId: 'PT1',
  birthDate: '1985-05-05',
  gender: 'P',
  locality: 'Jakarta',
  maskedNik: null,
  maskedPhone: null,
  visitDate: '2026-08-03',
  visitTime: '08:30',
  serviceName: 'Poli Saraf',
  doctorName: 'Dr. Y',
  state: 'Done',
  bookingId: null,
  registrationId: 'RG12345678',
  matchType: 'Exact',
  isExactMatch: true,
  rank: 1,
  warnings: [],
}

const registrationContextResponse = {
  businessDate: '2026-08-03',
  bookings: { items: [], total: 0, hasMore: false },
  registrations: { items: [registrationItem], total: 1, hasMore: false },
  patients: { items: [], total: 0, hasMore: false },
  bestMatch: registrationItem,
  canCreatePatient: false,
}

const multipleRegistrationContextResponse = {
  businessDate: '2026-08-03',
  bookings: { items: [], total: 0, hasMore: false },
  registrations: {
    items: [
      { ...registrationItem, id: 'RG12345678-1' },
      { ...registrationItem, id: 'RG12345678-2' },
    ],
    total: 2,
    hasMore: false,
  },
  patients: { items: [], total: 0, hasMore: false },
  bestMatch: registrationItem,
  canCreatePatient: false,
}

const registrationPrintData = {
  regId: 'RG12345678',
  noAntrian: 42,
  pasienName: 'Cici',
  pasienId: 'PT2',
  tglLahir: '1985-05-05',
  tipeJaminanName: 'Umum',
  serviceName: 'Poli Saraf',
  dokterName: 'Dr. Y',
}

function makeDeps(overrides: Partial<KioskRegistrationDeps> = {}): KioskRegistrationDeps {
  return {
    stationId: ref('K01'),
    getBusinessDate: vi.fn(async () => '2026-08-03'),
    searchBooking: vi.fn(async () => [bookingItem]),
    getBookingDetail: vi.fn(async () => bpjsDetail),
    listPolis: vi.fn(async () => [bpjsPolis]),
    getGroupJaminanMap: vi.fn(async () => group),
    searchPatientContext: vi.fn(async () => ({
      businessDate: '2026-08-03',
      bookings: { items: [], total: 0, hasMore: false },
      registrations: { items: [], total: 0, hasMore: false },
      patients: { items: [], total: 0, hasMore: false },
      bestMatch: null,
      canCreatePatient: true,
    })),
    appConfig: { bilregApiBase: '', kioskDefaultKarcisId: 'K-TEST' },
    verifyBiometric: vi.fn(async () => ({ outcome: 'SUCCESS' as const })),
    deepSearchPasien: vi.fn(async () => []),
    listKarcis: vi.fn(async () => [{ id: 'K-TEST', name: 'Karcis Test' }]),
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
        diagnosaRujukan: { icd10Id: 'Z00.0', icd10Name: 'DM' },
      },
      listSkdp: [],
    })),
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
    registerBooking: vi.fn(async () => ({ regId: 'R1', noAntrian: 12 })),
    registerWalkin: vi.fn(async () => ({ regId: 'R2', noAntrian: 13 })),
    createSep: vi.fn(async () => ({
      sepId: 'sep-1',
      sepNo: '0112R',
      noPeserta: '123',
      namaPeserta: 'A',
    })),
    uploadSep: vi.fn(async () => ({
      sepId: 'sep-1',
      sepNo: '0112R',
      noPeserta: '123',
      namaPeserta: 'A',
    })),
    setDataEligibility: vi.fn(async () => 'OK'),
    bookingAssistance: vi.fn(async () => ({
      antrianId: 'B1',
      noUrut: 1,
      queueLabel: 'B-001',
      createdAt: '2026-08-03T08:00:00',
    })),
    intake: vi.fn(async () => ({
      antrianId: 'Q1',
      noUrut: 2,
      queueLabel: 'A0002',
      createdAt: '2026-08-03T08:00:00',
    })),
    printRegistration: vi.fn(async () => ({ printed: true })),
    printQueueTicket: vi.fn(async () => ({ printed: true })),
    getRegistrationPrintData: vi.fn(async () => registrationPrintData),
    offeringsName: (id) => id,
    now: () => 1000,
    ...overrides,
  }
}

afterEach(() => {
  vi.useRealTimers()
})

// Built from local-time components so the composed `HH:mm:ss` is 14:05:06 in any
// host timezone; its own date (2026-08-03) is the same as the fixture business
// date, so the clock date never masks the business-date source.
const SEP_CLOCK = new Date(2026, 7, 3, 14, 5, 6).getTime()
// Clock date deliberately differs from the business date, proving the date part
// of `sepDate` comes from the business date and never from the kiosk host clock.
const SEP_CLOCK_OTHER_DAY = new Date(2026, 7, 4, 22, 30, 9).getTime()

describe('useKioskRegistration booking flow', () => {
  it('routes booking-not-found straight to failure', async () => {
    const reg = useKioskRegistration(makeDeps({ searchBooking: vi.fn(async () => []) }))
    await reg.submitBookingKeyword('NOPE')
    expect(reg.flow.value).toBe('FAILURE')
    expect(reg.errorContext.value?.code).toBe('PATIENT_NOT_REGISTERED')
  })

  it('shows confirm with needsEligibility for BPJS booking', async () => {
    const reg = useKioskRegistration(makeDeps())
    await reg.submitBookingKeyword('BK1')
    expect(reg.flow.value).toBe('BOOKING_CONFIRM')
    expect(reg.bookingEligibility.value?.needsEligibility).toBe(true)
  })

  it('registers a non-BPJS booking to success', async () => {
    const deps = makeDeps({ getBookingDetail: vi.fn(async () => umumDetail) })
    const reg = useKioskRegistration(deps)
    await reg.submitBookingKeyword('BK1')
    await reg.confirmBooking()
    expect(reg.flow.value).toBe('REGISTRATION_SUCCESS')
    expect(reg.registrationResult.value?.noAntrian).toBe(12)
    expect(deps.registerBooking).toHaveBeenCalledWith({
      bookingId: 'BK1',
      userId: 'hidokkiosk',
      karcisId: 'K-TEST',
      caraMasukDkId: '8',
      rujukanId: 'REF1',
      tipeJaminanId: '00000',
      pesertaJaminanId: '',
    })
  })

  it('runs biometric before registering a BPJS booking', async () => {
    const deps = makeDeps({
      verifyBiometric: vi.fn(async () => {
        expect(reg.flow.value).toBe('BIOMETRIC_VERIFY')
        return { outcome: 'SUCCESS' as const }
      }),
    })
    const reg = useKioskRegistration(deps)
    await reg.submitBookingKeyword('BK1')
    await reg.confirmBooking()
    expect(deps.verifyBiometric).toHaveBeenCalledTimes(1)
    expect(deps.verifyBiometric).toHaveBeenCalledWith('000123456')
    expect(deps.registerBooking).toHaveBeenCalledTimes(1)
    expect(reg.flow.value).toBe('REGISTRATION_SUCCESS')
  })

  it('maps biometric timeout to failure', async () => {
    const deps = makeDeps({ verifyBiometric: vi.fn(async () => ({ outcome: 'TIMEOUT' as const })) })
    const reg = useKioskRegistration(deps)
    await reg.submitBookingKeyword('BK1')
    await reg.confirmBooking()
    expect(reg.flow.value).toBe('FAILURE')
    expect(reg.errorContext.value?.code).toBe('BIOMETRIC_TIMEOUT')
  })

  it('routes a booking lookup rejection to failure', async () => {
    const deps = makeDeps({
      searchBooking: vi.fn(async () => {
        throw new ApiClientError('Failed to fetch', 0)
      }),
    })
    const reg = useKioskRegistration(deps)
    await reg.submitBookingKeyword('BK1')
    expect(reg.flow.value).toBe('FAILURE')
    expect(reg.errorContext.value?.code).toBe('BACKEND_ERROR')
  })

  it('skips the jaminan group lookup for an Umum booking', async () => {
    const deps = makeDeps({ getBookingDetail: vi.fn(async () => umumDetail) })
    const reg = useKioskRegistration(deps)
    await reg.submitBookingKeyword('BK1')
    expect(deps.getGroupJaminanMap).not.toHaveBeenCalled()
    expect(reg.bookingEligibility.value?.needsEligibility).toBe(false)
  })

  it('stays on success and skips auto-home when printing rejects', async () => {
    vi.useFakeTimers()
    const deps = makeDeps({
      getBookingDetail: vi.fn(async () => umumDetail),
      printRegistration: vi.fn(async () => {
        throw new Error('printer down')
      }),
    })
    const reg = useKioskRegistration(deps)
    await reg.submitBookingKeyword('BK1')
    await reg.confirmBooking()
    expect(reg.flow.value).toBe('REGISTRATION_SUCCESS')
    await vi.advanceTimersByTimeAsync(10_100)
    expect(reg.flow.value).toBe('REGISTRATION_SUCCESS')
  })

  it('falls back to booking-assistance on registration failure', async () => {
    const deps = makeDeps({
      getBookingDetail: vi.fn(async () => umumDetail),
      registerBooking: vi.fn(async () => {
        throw new Error('boom')
      }),
    })
    const reg = useKioskRegistration(deps)
    await reg.submitBookingKeyword('BK1')
    await reg.confirmBooking()
    expect(reg.flow.value).toBe('FAILURE')
    await reg.confirmAssistance('REG')
    expect(reg.flow.value).toBe('ASSISTANCE_QUEUE')
    expect(reg.assistanceTicket.value?.queueLabel).toBe('B-001')
    expect(deps.bookingAssistance).toHaveBeenCalledWith({
      bookingId: 'BK1',
      servicePointId: 'REG',
      kioskId: 'K01',
      userId: 'hidokkiosk',
    })
  })
})

describe('useKioskRegistration patient context cascade', () => {
  it('cascades to patient context search when booking search returns empty', async () => {
    const searchPatientContext = vi.fn(async () => contextResponse)
    const reg = useKioskRegistration(
      makeDeps({ searchBooking: vi.fn(async () => []), searchPatientContext }),
    )
    await reg.submitBookingKeyword('Budi')
    expect(reg.flow.value).toBe('PATIENT_CONTEXT_CONFIRM')
    expect(reg.patientContextResult.value).toEqual(contextResponse)
  })

  it('skips deep search for canonical registration id and goes straight to patient context', async () => {
    const searchPatientContext = vi.fn(async () => contextResponse)
    const deepSearchPasien = vi.fn(async () => [
      {
        pasienId: 'PT-DEEP',
        isActive: true,
        person: {
          personName: 'Deep Should Not Be Used',
          tglLahir: '1990-01-01',
          gender: 'L' as const,
          alamat: { alamat: ['Jl. A'], kota: 'Bandung', kodePos: '40111' },
          contact: { jenisContact: 2, contactDetail: '0812' },
          identity: { jenisId: 'NIK', nomorId: '3273' },
        },
      },
    ])
    const deps = makeDeps({
      searchBooking: vi.fn(async () => []),
      searchPatientContext,
      deepSearchPasien,
    })
    const reg = useKioskRegistration(deps)

    await reg.submitBookingKeyword('RG00000891')

    expect(deps.searchBooking).toHaveBeenCalledWith('2026-08-03', 'RG00000891')
    expect(deps.deepSearchPasien).not.toHaveBeenCalled()
    expect(deps.searchPatientContext).toHaveBeenCalledWith({
      keyword: 'RG00000891',
      businessDate: '2026-08-03',
    })
    expect(reg.flow.value).toBe('PATIENT_CONTEXT_CONFIRM')
  })

  it('normalizes compact registration id before patient-context fallback', async () => {
    const searchPatientContext = vi.fn(async () => contextResponse)
    const deps = makeDeps({
      searchBooking: vi.fn(async () => []),
      searchPatientContext,
      deepSearchPasien: vi.fn(async () => []),
    })
    const reg = useKioskRegistration(deps)

    await reg.submitBookingKeyword('RG:891')

    expect(deps.searchBooking).toHaveBeenCalledWith('2026-08-03', 'RG00000891')
    expect(deps.deepSearchPasien).not.toHaveBeenCalled()
    expect(deps.searchPatientContext).toHaveBeenCalledWith({
      keyword: 'RG00000891',
      businessDate: '2026-08-03',
    })
    expect(reg.flow.value).toBe('PATIENT_CONTEXT_CONFIRM')
  })

  it('goes to failure when patient context search returns nothing', async () => {
    const emptyContext = {
      businessDate: '2026-08-03',
      bookings: { items: [], total: 0, hasMore: false },
      registrations: { items: [], total: 0, hasMore: false },
      patients: { items: [], total: 0, hasMore: false },
      bestMatch: null,
      canCreatePatient: true,
    }
    const searchPatientContext = vi.fn(async () => emptyContext)
    const reg = useKioskRegistration(
      makeDeps({ searchBooking: vi.fn(async () => []), searchPatientContext }),
    )
    await reg.submitBookingKeyword('XYZ')
    expect(reg.flow.value).toBe('FAILURE')
    expect(reg.errorContext.value?.code).toBe('PATIENT_NOT_REGISTERED')
  })

  it('calls intake instead of bookingAssistance when error code is PATIENT_NOT_REGISTERED', async () => {
    const emptyContext = {
      businessDate: '2026-08-03',
      bookings: { items: [], total: 0, hasMore: false },
      registrations: { items: [], total: 0, hasMore: false },
      patients: { items: [], total: 0, hasMore: false },
      bestMatch: null,
      canCreatePatient: true,
    }
    const deps = makeDeps({
      searchBooking: vi.fn(async () => []),
      searchPatientContext: vi.fn(async () => emptyContext),
      bookingAssistance: vi.fn(),
      intake: vi.fn(async () => ({
        antrianId: 'A123',
        queueLabel: 'A-010',
        noUrut: 10,
        createdAt: '2026-08-03T08:00:00',
      })),
    })
    const reg = useKioskRegistration(deps)
    await reg.submitBookingKeyword('XYZ')
    expect(reg.flow.value).toBe('FAILURE')
    expect(reg.errorContext.value?.code).toBe('PATIENT_NOT_REGISTERED')

    await reg.confirmAssistance('BPJS')
    expect(reg.flow.value).toBe('ASSISTANCE_QUEUE')
    expect(deps.intake).toHaveBeenCalledWith('BPJS')
    expect(deps.bookingAssistance).not.toHaveBeenCalled()
  })

  it('confirmPatientContext maps to goshow walkin flow', async () => {
    const searchPatientContext = vi.fn(async () => contextResponse)
    const reg = useKioskRegistration(
      makeDeps({ searchBooking: vi.fn(async () => []), searchPatientContext }),
    )
    await reg.submitBookingKeyword('Budi')
    expect(reg.flow.value).toBe('PATIENT_CONTEXT_CONFIRM')
    await reg.confirmPatientContext(contextItem)
    expect(reg.flow.value).toBe('WALKIN_SELECT_GUARANTEE')
    expect(reg.selectedPatient.value?.pasienId).toBe('PT1')
    expect(reg.selectedPatient.value?.pasienName).toBe('Budi')
  })

  it("confirmPatientContext maps to reprint flow when patient has today's registration", async () => {
    const searchPatientContext = vi.fn(async () => registrationContextResponse)
    const deps = makeDeps({
      searchBooking: vi.fn(async () => []),
      searchPatientContext,
      getRegistrationPrintData: vi.fn(async () => registrationPrintData),
    })
    const reg = useKioskRegistration(deps)
    await reg.submitBookingKeyword('Budi')
    expect(reg.flow.value).toBe('PATIENT_CONTEXT_CONFIRM')
    await reg.confirmPatientContext(contextItem)
    expect(reg.flow.value).toBe('REGISTRATION_REPRINT')
    expect(reg.registrationReprintData.value).toEqual(registrationPrintData)
    expect(deps.getRegistrationPrintData).toHaveBeenCalledWith('RG12345678')
  })

  it('confirmPatientContext with Registration kind re-queries when cached result has empty registrations', async () => {
    const registrationContextWithEmptyRegistrations = {
      businessDate: '2026-08-03',
      bookings: { items: [], total: 0, hasMore: false },
      registrations: { items: [], total: 0, hasMore: false },
      patients: { items: [], total: 0, hasMore: false },
      bestMatch: registrationItem,
      canCreatePatient: false,
    }
    const deps = makeDeps({
      searchBooking: vi.fn(async () => []),
      searchPatientContext: vi.fn(async () => registrationContextResponse),
      getRegistrationPrintData: vi.fn(async () => registrationPrintData),
    })
    const reg = useKioskRegistration(deps)
    await reg.submitBookingKeyword('Budi')
    reg.patientContextResult.value = registrationContextWithEmptyRegistrations
    expect(reg.patientContextResult.value?.registrations.items).toHaveLength(0)
    await reg.confirmPatientContext(registrationItem)
    expect(reg.flow.value).toBe('REGISTRATION_REPRINT')
    expect(deps.searchPatientContext).toHaveBeenCalledWith(
      expect.objectContaining({ keyword: '1' }),
    )
    expect(reg.registrationReprintData.value).toEqual(registrationPrintData)
  })

  it('confirmPatientContext with Registration kind re-queries using only pasienId numeric suffix', async () => {
    const prefixedPatient = { ...registrationItem, patientId: 'RS0100000001' }
    const prefixedRegistration = {
      ...registrationItem,
      patientId: 'RS0100000001',
    }
    const registrationContextWithEmptyRegistrations = {
      businessDate: '2026-08-03',
      bookings: { items: [], total: 0, hasMore: false },
      registrations: { items: [], total: 0, hasMore: false },
      patients: { items: [], total: 0, hasMore: false },
      bestMatch: prefixedPatient,
      canCreatePatient: false,
    }
    const deps = makeDeps({
      searchBooking: vi.fn(async () => []),
      searchPatientContext: vi.fn(async () => ({
        ...registrationContextResponse,
        registrations: { items: [prefixedRegistration], total: 1, hasMore: false },
      })),
      getRegistrationPrintData: vi.fn(async () => registrationPrintData),
    })
    const reg = useKioskRegistration(deps)
    await reg.submitBookingKeyword('Budi')
    reg.patientContextResult.value = registrationContextWithEmptyRegistrations
    await reg.confirmPatientContext(prefixedPatient)
    expect(deps.searchPatientContext).toHaveBeenCalledWith(
      expect.objectContaining({ keyword: '00000001' }),
    )
    expect(reg.flow.value).toBe('REGISTRATION_REPRINT')
  })

  it('confirmPatientContext re-queries but walks-in when still no registrations after re-query', async () => {
    const mockDeepSearchResult = {
      pasienId: 'PT1',
      isActive: true,
      person: {
        personName: 'Budi',
        tglLahir: '1990-01-01',
        gender: 'L' as const,
        alamat: { alamat: ['Jl. A'], kota: 'Jakarta', kodePos: '40111' },
        contact: { jenisContact: 2, contactDetail: '0812' },
        identity: { jenisId: 'NIK', nomorId: '3273' },
      },
    }
    const deps = makeDeps({
      searchBooking: vi.fn(async () => []),
      deepSearchPasien: vi.fn(async () => [mockDeepSearchResult]),
      searchPatientContext: vi.fn(async () => contextResponse),
    })
    const reg = useKioskRegistration(deps)
    await reg.submitBookingKeyword('Budi')
    expect(reg.flow.value).toBe('PATIENT_CONTEXT_CONFIRM')
    expect(reg.patientContextResult.value?.registrations.items).toHaveLength(0)
    await reg.confirmPatientContext(contextItem)
    expect(reg.flow.value).toBe('WALKIN_SELECT_GUARANTEE')
  })

  it('confirmPatientContext with booking item transitions to BOOKING_CONFIRM without re-query', async () => {
    const bookingContextItem = {
      ...contextItem,
      kind: 'Booking' as const,
      bookingId: 'BK-FROM-CONTEXT',
    }
    const deps = makeDeps({
      searchBooking: vi.fn(async () => []),
      searchPatientContext: vi.fn(async () => ({
        businessDate: '2026-08-03',
        bookings: { items: [bookingContextItem], total: 1, hasMore: false },
        registrations: { items: [], total: 0, hasMore: false },
        patients: { items: [], total: 0, hasMore: false },
        bestMatch: bookingContextItem,
        canCreatePatient: false,
      })),
      getBookingDetail: vi.fn(async () => bpjsDetail),
      listPolis: vi.fn(async () => [bpjsPolis]),
      getGroupJaminanMap: vi.fn(async () => group),
    })
    const reg = useKioskRegistration(deps)
    await reg.submitBookingKeyword('Budi')
    expect(reg.flow.value).toBe('PATIENT_CONTEXT_CONFIRM')

    await reg.confirmPatientContext(bookingContextItem)

    expect(reg.flow.value).toBe('BOOKING_CONFIRM')
    expect(reg.mode.value).toBe('booking')
    expect(reg.bookingDetail.value).toEqual(bpjsDetail)
  })

  it('confirmPatientContext with booking item by bookingId (Patient kind) transitions to BOOKING_CONFIRM', async () => {
    const patientWithBookingId = {
      ...contextItem,
      kind: 'Patient' as const,
      bookingId: 'BK-FROM-PATIENT',
    }
    const detailWithBookingId = { ...bpjsDetail, bookingId: 'BK-FROM-PATIENT' }
    const deps = makeDeps({
      searchBooking: vi.fn(async () => []),
      searchPatientContext: vi.fn(async () => ({
        businessDate: '2026-08-03',
        bookings: { items: [], total: 0, hasMore: false },
        registrations: { items: [], total: 0, hasMore: false },
        patients: { items: [patientWithBookingId], total: 1, hasMore: false },
        bestMatch: patientWithBookingId,
        canCreatePatient: true,
      })),
      getBookingDetail: vi.fn(async () => detailWithBookingId),
      listPolis: vi.fn(async () => [bpjsPolis]),
      getGroupJaminanMap: vi.fn(async () => group),
    })
    const reg = useKioskRegistration(deps)
    await reg.submitBookingKeyword('Budi')
    expect(reg.flow.value).toBe('PATIENT_CONTEXT_CONFIRM')

    await reg.confirmPatientContext(patientWithBookingId)

    expect(reg.flow.value).toBe('BOOKING_CONFIRM')
    expect(reg.mode.value).toBe('booking')
    expect(deps.getBookingDetail).toHaveBeenCalledWith('BK-FROM-PATIENT')
  })

  it('confirmPatientContext with Registration kind re-query does not overwrite patientContextResult', async () => {
    const regItem = {
      ...registrationItem,
      patientId: 'PT2',
      registrationId: 'RG99999999',
    }
    const regItemForRequery = {
      kind: 'Registration' as const,
      id: 'REG-FOR-REQUERY',
      patientName: 'Budi',
      patientId: 'PT2',
      birthDate: '1990-01-01',
      gender: 'L',
      locality: 'Jakarta',
      maskedNik: null,
      maskedPhone: null,
      visitDate: null,
      visitTime: null,
      serviceName: null,
      doctorName: null,
      state: 'Active',
      bookingId: null,
      registrationId: 'REG-FOR-REQUERY',
      matchType: 'Fuzzy',
      isExactMatch: false,
      rank: 5,
      warnings: [],
    }
    const originalContext = {
      businessDate: '2026-08-03',
      bookings: { items: [], total: 0, hasMore: false },
      registrations: { items: [], total: 0, hasMore: false },
      patients: { items: [regItemForRequery], total: 1, hasMore: false },
      bestMatch: regItemForRequery,
      canCreatePatient: false,
    }
    const freshContextWithReg = {
      businessDate: '2026-08-03',
      bookings: { items: [], total: 0, hasMore: false },
      registrations: { items: [regItem], total: 1, hasMore: false },
      patients: { items: [], total: 0, hasMore: false },
      bestMatch: regItem,
      canCreatePatient: false,
    }
    const deps = makeDeps({
      searchBooking: vi.fn(async () => []),
      searchPatientContext: vi.fn(async () => freshContextWithReg),
      getRegistrationPrintData: vi.fn(async () => ({
        ...registrationPrintData,
        regId: 'RG99999999',
      })),
    })
    const reg = useKioskRegistration(deps)
    await reg.submitBookingKeyword('PT2')

    reg.patientContextResult.value = originalContext

    await reg.confirmPatientContext(regItemForRequery)

    expect(reg.flow.value).toBe('REGISTRATION_REPRINT')
    expect(reg.patientContextResult.value).toEqual(originalContext)
    expect(deps.searchPatientContext).toHaveBeenCalled()
  })

  it('confirmPatientContext does not re-query for Patient kind with empty registrations', async () => {
    const searchPatientContextMock = vi.fn(async () => contextResponse)
    const deps = makeDeps({
      searchBooking: vi.fn(async () => []),
      searchPatientContext: searchPatientContextMock,
    })
    const reg = useKioskRegistration(deps)
    await reg.submitBookingKeyword('Budi')
    expect(reg.flow.value).toBe('PATIENT_CONTEXT_CONFIRM')

    const callCountBefore = searchPatientContextMock.mock.calls.length

    await reg.confirmPatientContext(contextItem)

    expect(reg.flow.value).toBe('WALKIN_SELECT_GUARANTEE')
    expect(searchPatientContextMock.mock.calls.length).toBe(callCountBefore)
  })

  it('cancelPatientContext returns to home', () => {
    const reg = useKioskRegistration(
      makeDeps({ searchPatientContext: vi.fn(async () => contextResponse) }),
    )
    reg.cancelPatientContext()
    expect(reg.flow.value).toBe('HOME')
    expect(reg.patientContextResult.value).toBeNull()
  })
})

describe('useKioskRegistration existing registration reprint', () => {
  it('routes an exact registration result from HOME to reprint without registering', async () => {
    const deps = makeDeps({
      searchBooking: vi.fn(async () => []),
      searchPatientContext: vi.fn(async () => ({ ...registrationContextResponse })),
      getRegistrationPrintData: vi.fn(async () => registrationPrintData),
    })
    const reg = useKioskRegistration(deps)

    await reg.submitBookingKeyword('RG12345678')

    expect(reg.flow.value).toBe('REGISTRATION_REPRINT')
    expect(reg.registrationReprintData.value).toEqual(registrationPrintData)
    expect(deps.getRegistrationPrintData).toHaveBeenCalledWith('RG12345678')
    expect(deps.registerBooking).not.toHaveBeenCalled()
    expect(deps.registerWalkin).not.toHaveBeenCalled()
    expect(deps.printRegistration).not.toHaveBeenCalled()
  })

  it('routes via bestMatch Registration when it is the exact requested id', async () => {
    const deps = makeDeps({
      searchBooking: vi.fn(async () => []),
      searchPatientContext: vi.fn(async () => ({
        ...registrationContextResponse,
        registrations: { items: [], total: 0, hasMore: false },
      })),
      getRegistrationPrintData: vi.fn(async () => registrationPrintData),
    })
    const reg = useKioskRegistration(deps)

    await reg.submitBookingKeyword('RG12345678')

    expect(reg.flow.value).toBe('REGISTRATION_REPRINT')
    expect(deps.getRegistrationPrintData).toHaveBeenCalledWith('RG12345678')
    expect(deps.printRegistration).not.toHaveBeenCalled()
  })

  it('does not route a bestMatch Booking to reprint', async () => {
    const bookingBestMatch = {
      ...registrationItem,
      kind: 'Booking' as const,
      id: 'BK-EXISTING',
      bookingId: 'BK-EXISTING',
      registrationId: null,
    }
    const deps = makeDeps({
      searchBooking: vi.fn(async () => []),
      searchPatientContext: vi.fn(async () => ({
        ...registrationContextResponse,
        registrations: { items: [], total: 0, hasMore: false },
        bestMatch: bookingBestMatch,
      })),
      getRegistrationPrintData: vi.fn(async () => registrationPrintData),
    })
    const reg = useKioskRegistration(deps)

    await reg.submitBookingKeyword('RG12345678')

    expect(reg.flow.value).not.toBe('REGISTRATION_REPRINT')
    expect(deps.getRegistrationPrintData).not.toHaveBeenCalled()
  })

  it('does not route a bestMatch Patient to reprint', async () => {
    const deps = makeDeps({
      searchBooking: vi.fn(async () => []),
      searchPatientContext: vi.fn(async () => ({
        ...registrationContextResponse,
        registrations: { items: [], total: 0, hasMore: false },
        patients: { items: [contextItem], total: 1, hasMore: false },
        bestMatch: contextItem,
      })),
      getRegistrationPrintData: vi.fn(async () => registrationPrintData),
    })
    const reg = useKioskRegistration(deps)

    await reg.submitBookingKeyword('RG12345678')

    expect(reg.flow.value).not.toBe('REGISTRATION_REPRINT')
    expect(deps.getRegistrationPrintData).not.toHaveBeenCalled()
  })

  it('falls back when no exact registration exists', async () => {
    const reg = useKioskRegistration(makeDeps({ searchBooking: vi.fn(async () => []) }))
    await reg.submitBookingKeyword('RG12345678')
    expect(reg.flow.value).not.toBe('REGISTRATION_REPRINT')
  })

  it('fails when multiple exact registration results exist', async () => {
    const deps = makeDeps({
      searchBooking: vi.fn(async () => []),
      searchPatientContext: vi.fn(async () => multipleRegistrationContextResponse),
    })
    const reg = useKioskRegistration(deps)
    await reg.submitBookingKeyword('RG12345678')
    expect(reg.flow.value).toBe('FAILURE')
    expect(deps.getRegistrationPrintData).not.toHaveBeenCalled()
  })

  it('fails when registration print data has no queue number', async () => {
    const deps = makeDeps({
      searchBooking: vi.fn(async () => []),
      searchPatientContext: vi.fn(async () => registrationContextResponse),
      getRegistrationPrintData: vi.fn(async () => {
        throw new Error('Invalid registration print data')
      }),
    })
    const reg = useKioskRegistration(deps)
    await reg.submitBookingKeyword('RG12345678')
    expect(reg.flow.value).toBe('FAILURE')
  })

  it('does not auto-print on the existing-registration path', async () => {
    const deps = makeDeps({
      searchBooking: vi.fn(async () => []),
      searchPatientContext: vi.fn(async () => registrationContextResponse),
      getRegistrationPrintData: vi.fn(async () => registrationPrintData),
    })
    const reg = useKioskRegistration(deps)
    await reg.submitBookingKeyword('RG12345678')
    expect(deps.printRegistration).not.toHaveBeenCalled()
  })

  it('reprintExistingRegistration prints stored data and no-ops when null', async () => {
    const deps = makeDeps({
      searchBooking: vi.fn(async () => []),
      searchPatientContext: vi.fn(async () => ({ ...registrationContextResponse })),
      getRegistrationPrintData: vi.fn(async () => registrationPrintData),
    })
    const reg = useKioskRegistration(deps)
    await reg.submitBookingKeyword('RG12345678')
    expect(reg.flow.value).toBe('REGISTRATION_REPRINT')

    await reg.reprintExistingRegistration()
    expect(deps.printRegistration).toHaveBeenCalledWith({
      result: { regId: 'RG12345678', noAntrian: 42 },
      pasienName: 'Cici',
      pasienId: 'PT2',
      tglLahir: '1985-05-05',
      tipeJaminanName: 'Umum',
      noSep: undefined,
      serviceName: 'Poli Saraf',
      dokterName: 'Dr. Y',
    })

    vi.mocked(deps.printRegistration).mockClear()
    reg.registrationReprintData.value = null
    await reg.reprintExistingRegistration()
    expect(deps.printRegistration).not.toHaveBeenCalled()
  })

  it('clears reprint data on goHome', async () => {
    const deps = makeDeps({
      searchBooking: vi.fn(async () => []),
      searchPatientContext: vi.fn(async () => ({ ...registrationContextResponse })),
      getRegistrationPrintData: vi.fn(async () => registrationPrintData),
    })
    const reg = useKioskRegistration(deps)
    await reg.submitBookingKeyword('RG12345678')
    expect(reg.registrationReprintData.value).toEqual(registrationPrintData)
    reg.goHome()
    expect(reg.registrationReprintData.value).toBeNull()
  })
})

describe('useKioskRegistration goshow walk-in flow', () => {
  function makeContextDeps(overrides: Partial<KioskRegistrationDeps> = {}): KioskRegistrationDeps {
    return makeDeps({
      searchBooking: vi.fn(async () => []),
      searchPatientContext: vi.fn(async () => contextResponse),
      ...overrides,
    })
  }

  async function reachContextConfirm(reg: ReturnType<typeof useKioskRegistration>) {
    await reg.submitBookingKeyword('Budi')
    expect(reg.flow.value).toBe('PATIENT_CONTEXT_CONFIRM')
  }

  it('routes a polis lookup rejection to failure', async () => {
    const reg = useKioskRegistration(
      makeContextDeps({
        listPolis: vi.fn(async () => {
          throw new ApiClientError('Failed to fetch', 0)
        }),
      }),
    )
    await reachContextConfirm(reg)
    await reg.confirmPatientContext(contextItem)
    expect(reg.flow.value).toBe('FAILURE')
    expect(reg.errorContext.value?.code).toBe('BACKEND_ERROR')
  })

  it('skips the jaminan group lookup when a walk-in patient has no polis', async () => {
    const deps = makeContextDeps({ listPolis: vi.fn(async () => []) })
    const reg = useKioskRegistration(deps)
    await reachContextConfirm(reg)
    await reg.confirmPatientContext(contextItem)
    expect(reg.flow.value).toBe('WALKIN_SELECT_GUARANTEE')
    await reg.selectWalkinGuarantee({
      tipeJaminanId: '00000',
      tipeJaminanName: 'Umum',
      noPeserta: null,
    })
    expect(reg.flow.value).toBe('WALKIN_SELECT_SERVICE')
    expect(deps.getGroupJaminanMap).not.toHaveBeenCalled()
    expect(reg.walkinEligibility.value?.needsEligibility).toBe(false)
  })

  it('walks through goshow patient → service → confirm → register', async () => {
    const deps = makeContextDeps()
    const reg = useKioskRegistration(deps)
    await reachContextConfirm(reg)
    await reg.confirmPatientContext(contextItem)
    expect(reg.flow.value).toBe('WALKIN_SELECT_GUARANTEE')
    await reg.selectWalkinGuarantee({
      tipeJaminanId: 'BPJS',
      tipeJaminanName: 'BPJS',
      noPeserta: '000123456',
    })
    expect(reg.flow.value).toBe('WALKIN_SELECT_SERVICE')
    expect(reg.walkinEligibility.value?.needsEligibility).toBe(true)
    reg.selectService({
      poli: { id: 'PO1', name: 'Poli Jantung' },
      dokter: { id: 'DP1', name: 'Dr. X' },
      jadwal: { jadwalId: 'J1', ppaId: 'DP1', jamPraktek: '08:00', sisaKuota: 5 },
    })
    expect(reg.flow.value).toBe('WALKIN_CONFIRM')
    await reg.confirmWalkin()
    expect(reg.flow.value).toBe('REGISTRATION_SUCCESS')
    expect(deps.registerWalkin).toHaveBeenCalledWith({
      pasienId: 'PT1',
      userId: 'hidokkiosk',
      tipeJaminanId: 'BPJS',
      caraMasukDkId: '5',
      rujukanId: 'RUJ-LOCAL-1',
      dokterId: 'DP1',
      layananId: 'PO1',
      jamPraktek: '08:00',
      karcisId: 'K-TEST',
      pesertaJaminanId: '000123456',
    })
    expect(deps.getRujukanByPpk).toHaveBeenCalledWith('0137R016')
  })

  it('runs biometric before walk-in service selection if patient is an adult', async () => {
    const deps = makeContextDeps({
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
          tglLahir: '1980-08-01',
        },
        rujukan: null,
        listSkdp: [
          {
            noSkdp: 'SKDP_99',
            tglRencanaKontrol: '2026-08-01',
            tglExpired: '2026-08-10',
            isSpri: false,
            poliPerujuk: { layananId: 'LY-1', layananName: 'Poli Penyakit Dalam' },
            poliTujuan: { layananId: 'LY-2', layananName: 'Poli Jantung' },
            diagnosa: { icd10Id: 'I10', icd10Name: 'Hypertension' },
            keterangan: '',
          },
        ],
      })),
      verifyBiometric: vi.fn(async () => {
        expect(reg.flow.value).toBe('BIOMETRIC_VERIFY')
        return { outcome: 'SUCCESS' as const }
      }),
    })
    const reg = useKioskRegistration(deps)
    await reachContextConfirm(reg)
    await reg.confirmPatientContext(contextItem)
    expect(reg.flow.value).toBe('WALKIN_SELECT_GUARANTEE')
    await reg.selectWalkinGuarantee({
      tipeJaminanId: 'BPJS',
      tipeJaminanName: 'BPJS',
      noPeserta: '000123456',
    })
    expect(deps.verifyBiometric).toHaveBeenCalledWith('000123456')
    expect(reg.flow.value).toBe('WALKIN_SELECT_SERVICE')
  })

  it('falls back to intake on walk-in failure', async () => {
    const deps = makeContextDeps({
      listPolis: vi.fn(async () => []),
      registerWalkin: vi.fn(async () => {
        throw new Error('full')
      }),
    })
    const reg = useKioskRegistration(deps)
    await reachContextConfirm(reg)
    await reg.confirmPatientContext(contextItem)
    expect(reg.flow.value).toBe('WALKIN_SELECT_GUARANTEE')
    await reg.selectWalkinGuarantee({
      tipeJaminanId: '00000',
      tipeJaminanName: 'Umum',
      noPeserta: null,
    })
    expect(reg.flow.value).toBe('WALKIN_SELECT_SERVICE')
    expect(reg.walkinEligibility.value?.needsEligibility).toBe(false)
    reg.selectService({
      poli: { id: 'PO1', name: 'Poli Jantung' },
      dokter: { id: 'DP1', name: 'Dr. X' },
      jadwal: { jadwalId: 'J1', ppaId: 'DP1', jamPraktek: '08:00', sisaKuota: 5 },
    })
    await reg.confirmWalkin()
    expect(reg.flow.value).toBe('FAILURE')
    await reg.confirmAssistance('REG')
    expect(reg.flow.value).toBe('ASSISTANCE_QUEUE')
    expect(reg.assistanceTicket.value?.queueLabel).toBe('A0002')
    expect(deps.intake).toHaveBeenCalledWith('REG')
  })
})

describe('useKioskRegistration guards and reset', () => {
  it('ignores a second submit while pending', async () => {
    let resolveSearch!: (v: BookingSearchItem[]) => void
    const pendingSearch = new Promise<BookingSearchItem[]>((resolve) => {
      resolveSearch = resolve
    })
    const deps = makeDeps({ searchBooking: vi.fn(() => pendingSearch) })
    const reg = useKioskRegistration(deps)
    const first = reg.submitBookingKeyword('BK1')
    const second = reg.submitBookingKeyword('BK1')
    resolveSearch([bookingItem])
    await Promise.all([first, second])
    expect(deps.searchBooking).toHaveBeenCalledTimes(1)
  })

  it('returns to HOME after 60s idle while on a flow', async () => {
    let nowMs = 1000
    vi.useFakeTimers()
    const reg = useKioskRegistration(makeDeps({ now: () => nowMs }))
    reg.startIdleReset()
    await reg.submitBookingKeyword('BK1')
    expect(reg.flow.value).toBe('BOOKING_CONFIRM')
    nowMs = 2000 + 60_000
    await vi.advanceTimersByTimeAsync(1100)
    expect(reg.flow.value).toBe('HOME')
  })

  it('stays on REGISTRATION_SUCCESS after successful registration print', async () => {
    vi.useFakeTimers()
    const deps = makeDeps({ getBookingDetail: vi.fn(async () => umumDetail) })
    const reg = useKioskRegistration(deps)
    await reg.submitBookingKeyword('BK1')
    await reg.confirmBooking()
    expect(reg.flow.value).toBe('REGISTRATION_SUCCESS')
    await vi.advanceTimersByTimeAsync(10_100)
    expect(reg.flow.value).toBe('REGISTRATION_SUCCESS')
  })
})

describe('useKioskRegistration gap closure features', () => {
  it('bypasses biometric verification for children under 17 years old', async () => {
    const deps = makeDeps({
      getRujukanSkpd: vi.fn(async () => ({
        peserta: {
          noPeserta: '000123456',
          nama: 'Child Patient',
          hakKelas: { kode: '3', nama: 'Kelas 3' },
          status: { kode: '1', info: 'AKTIF' },
          jenisPeserta: { kode: 'PBI', nama: 'PBI' },
          provider: { kode: 'P1', nama: 'RS A' },
          prbInfo: null,
          tglTat: '2026-08-06',
          tglLahir: '2015-01-01', // 11 years old relative to 2026-08-03
        },
        rujukan: {
          noRujukan: 'REF_CHILD',
          tglRujukan: '2026-08-01',
          tujuan: { poliBpjsId: 'POL-1', poliBpjsName: 'Poli Umum' },
          faskesPerujuk: { faskesId: '0137R016', faskesName: 'Puskesmas Sehat' },
          diagnosaRujukan: { icd10Id: 'Z00.0', icd10Name: 'Checkup' },
        },
        listSkdp: [],
      })),
      verifyBiometric: vi.fn(async () => ({ outcome: 'SUCCESS' as const })),
    })
    const reg = useKioskRegistration(deps)
    await reg.submitBookingKeyword('BK1')
    await reg.confirmBooking()

    expect(deps.verifyBiometric).not.toHaveBeenCalled()
    expect(reg.flow.value).toBe('REGISTRATION_SUCCESS')
    expect(deps.registerBooking).toHaveBeenCalledWith(
      expect.objectContaining({
        rujukanId: 'RUJ-LOCAL-1',
        caraMasukDkId: '5',
      }),
    )
    expect(deps.getRujukanByPpk).toHaveBeenCalledWith('0137R016')
  })

  it('falls back to SKDP if rujukan is null and listSkdp is populated', async () => {
    const deps = makeDeps({
      getRujukanSkpd: vi.fn(async () => ({
        peserta: {
          noPeserta: '000123456',
          nama: 'Adult SKDP Patient',
          hakKelas: { kode: '1', nama: 'Kelas 1' },
          status: { kode: '1', info: 'AKTIF' },
          jenisPeserta: { kode: 'PNS', nama: 'PNS' },
          provider: { kode: 'P1', nama: 'RS A' },
          prbInfo: null,
          tglTat: '2026-08-06',
          tglLahir: '1980-01-01', // 46 years old
        },
        rujukan: null,
        listSkdp: [
          {
            noSkdp: 'SKDP_99',
            tglRencanaKontrol: '2026-08-01',
            tglExpired: '2026-08-10',
            isSpri: false,
            poliPerujuk: { layananId: 'LY-1', layananName: 'Poli Penyakit Dalam' },
            poliTujuan: { layananId: 'LY-2', layananName: 'Poli Jantung' },
            diagnosa: { icd10Id: 'I10', icd10Name: 'Hypertension' },
            keterangan: '',
          },
        ],
      })),
      verifyBiometric: vi.fn(async () => ({ outcome: 'SUCCESS' as const })),
    })
    const reg = useKioskRegistration(deps)
    await reg.submitBookingKeyword('BK1')
    await reg.confirmBooking()

    expect(deps.verifyBiometric).toHaveBeenCalledWith('000123456')
    expect(reg.flow.value).toBe('REGISTRATION_SUCCESS')
    expect(deps.registerBooking).toHaveBeenCalledWith(
      expect.objectContaining({
        rujukanId: '',
        caraMasukDkId: '8',
      }),
    )
    expect(deps.getRujukanByPpk).not.toHaveBeenCalled()
  })

  it('fails registration if both rujukan and listSkdp are empty/null', async () => {
    const deps = makeDeps({
      getRujukanSkpd: vi.fn(async () => ({
        peserta: {
          noPeserta: '000123456',
          nama: 'Adult SKDP Patient',
          hakKelas: { kode: '1', nama: 'Kelas 1' },
          status: { kode: '1', info: 'AKTIF' },
          jenisPeserta: { kode: 'PNS', nama: 'PNS' },
          provider: { kode: 'P1', nama: 'RS A' },
          prbInfo: null,
          tglTat: '2026-08-06',
          tglLahir: '1980-01-01',
        },
        rujukan: null,
        listSkdp: [],
      })),
    })
    const reg = useKioskRegistration(deps)
    await reg.submitBookingKeyword('BK1')
    await reg.confirmBooking()

    expect(reg.flow.value).toBe('FAILURE')
    expect(reg.errorContext.value?.message).toContain(
      'Rujukan atau SKDP BPJS tidak aktif/tidak ditemukan',
    )
  })

  it('resolves karcis via mappingJmnLayananKarcis and fails if inactive', async () => {
    const deps = makeDeps({
      appConfig: {
        bilregApiBase: '',
        kioskDefaultKarcisId: 'K-DEFAULT',
        mappingJmnLayananKarcis: [
          { tipeJaminanId: 'BPJS', layananId: 'LY1', karcisId: 'K-MAP-JMN' },
        ],
      },
      listKarcis: vi.fn(async () => [{ id: 'K-DEFAULT', name: 'Default' }]),
    })
    const reg = useKioskRegistration(deps)
    await reg.submitBookingKeyword('BK1')
    await reg.confirmBooking()

    expect(reg.flow.value).toBe('FAILURE')
    expect(reg.errorContext.value?.message).toContain("Karcis dengan ID 'K-MAP-JMN' tidak aktif")
  })

  it('resolves karcis via mappingLayananKarcis successfully if active', async () => {
    const deps = makeDeps({
      appConfig: {
        bilregApiBase: '',
        kioskDefaultKarcisId: 'K-DEFAULT',
        mappingLayananKarcis: [{ layananId: 'LY1', karcisId: 'K-MAP-LAY' }],
      },
      listKarcis: vi.fn(async () => [
        { id: 'K-DEFAULT', name: 'Default' },
        { id: 'K-MAP-LAY', name: 'Mapped Layanan Karcis' },
      ]),
    })
    const reg = useKioskRegistration(deps)
    await reg.submitBookingKeyword('BK1')
    await reg.confirmBooking()

    expect(reg.flow.value).toBe('REGISTRATION_SUCCESS')
    expect(deps.registerBooking).toHaveBeenCalledWith(
      expect.objectContaining({
        karcisId: 'K-MAP-LAY',
      }),
    )
  })

  it('resolves karcis via mappingJmnLayananKarcis wildcard matching and prioritizing specific matches', async () => {
    const deps = makeDeps({
      appConfig: {
        bilregApiBase: '',
        kioskDefaultKarcisId: 'K-DEFAULT',
        mappingJmnLayananKarcis: [
          { tipeJaminanId: 'BPJS', layananId: '', karcisId: 'K-BPJS-WILDCARD' },
          { tipeJaminanId: 'BPJS', layananId: 'LY1', karcisId: 'K-BPJS-SPECIFIC' },
        ],
      },
      listKarcis: vi.fn(async () => [
        { id: 'K-DEFAULT', name: 'Default' },
        { id: 'K-BPJS-WILDCARD', name: 'BPJS Wildcard' },
        { id: 'K-BPJS-SPECIFIC', name: 'BPJS Specific' },
      ]),
    })
    const reg = useKioskRegistration(deps)
    await reg.submitBookingKeyword('BK1')
    await reg.confirmBooking()

    expect(reg.flow.value).toBe('REGISTRATION_SUCCESS')
    expect(deps.registerBooking).toHaveBeenCalledWith(
      expect.objectContaining({
        karcisId: 'K-BPJS-SPECIFIC',
      }),
    )
  })

  it('resolves karcis via mappingJmnLayananKarcis wildcard when no specific match is found', async () => {
    const deps = makeDeps({
      appConfig: {
        bilregApiBase: '',
        kioskDefaultKarcisId: 'K-DEFAULT',
        mappingJmnLayananKarcis: [
          { tipeJaminanId: 'BPJS', layananId: '', karcisId: 'K-BPJS-WILDCARD' },
          { tipeJaminanId: 'BPJS', layananId: 'LY1', karcisId: 'K-BPJS-SPECIFIC' },
        ],
      },
      getBookingDetail: vi.fn(async () => ({
        ...bpjsDetail,
        layanan: { layananId: 'LY2', layananName: 'Poli Gigi' },
      })),
      listKarcis: vi.fn(async () => [
        { id: 'K-DEFAULT', name: 'Default' },
        { id: 'K-BPJS-WILDCARD', name: 'BPJS Wildcard' },
        { id: 'K-BPJS-SPECIFIC', name: 'BPJS Specific' },
      ]),
    })
    const reg = useKioskRegistration(deps)
    await reg.submitBookingKeyword('BK1')
    await reg.confirmBooking()

    expect(reg.flow.value).toBe('REGISTRATION_SUCCESS')
    expect(deps.registerBooking).toHaveBeenCalledWith(
      expect.objectContaining({
        karcisId: 'K-BPJS-WILDCARD',
      }),
    )
  })

  it('resolves karcis via mappingJmnLayananKarcis asterisk wildcard', async () => {
    const deps = makeDeps({
      appConfig: {
        bilregApiBase: '',
        kioskDefaultKarcisId: 'K-DEFAULT',
        mappingJmnLayananKarcis: [
          { tipeJaminanId: 'BPJS', layananId: '*', karcisId: 'K-BPJS-ASTERISK' },
        ],
      },
      listKarcis: vi.fn(async () => [
        { id: 'K-DEFAULT', name: 'Default' },
        { id: 'K-BPJS-ASTERISK', name: 'BPJS Asterisk' },
      ]),
    })
    const reg = useKioskRegistration(deps)
    await reg.submitBookingKeyword('BK1')
    await reg.confirmBooking()

    expect(reg.flow.value).toBe('REGISTRATION_SUCCESS')
    expect(deps.registerBooking).toHaveBeenCalledWith(
      expect.objectContaining({
        karcisId: 'K-BPJS-ASTERISK',
      }),
    )
  })

  describe('BPJS Rujukan & SKDP Multiple Reference and Cascade Search', () => {
    it('prioritizes SKDPs over Rujukan in the reference list', async () => {
      const mockRujukanSkpd = {
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
          noRujukan: 'RUJ-999',
          tglRujukan: '2026-08-01',
          tujuan: { poliBpjsId: 'POL-1', poliBpjsName: 'Poli Umum' },
          faskesPerujuk: { faskesId: '0137R016', faskesName: 'Puskesmas Sehat' },
          diagnosaRujukan: { icd10Id: 'Z00.0', icd10Name: 'DM' },
        },
        listSkdp: [
          {
            noSkdp: 'SKDP-111',
            tglRencanaKontrol: '2026-08-02',
            tglExpired: '2026-08-10',
            isSpri: false,
            poliPerujuk: { layananId: 'LY-1', layananName: 'Poli Penyakit Dalam' },
            poliTujuan: { layananId: 'LY-2', layananName: 'Poli Jantung' },
            diagnosa: { icd10Id: 'I10', icd10Name: 'Hipertensi' },
            keterangan: '',
          },
          {
            noSkdp: 'SKDP-222',
            tglRencanaKontrol: '2026-08-03',
            tglExpired: '2026-08-10',
            isSpri: false,
            poliPerujuk: { layananId: 'LY-1', layananName: 'Poli Penyakit Dalam' },
            poliTujuan: { layananId: 'LY-3', layananName: 'Poli Mata' },
            diagnosa: { icd10Id: 'E11', icd10Name: 'Diabetes' },
            keterangan: '',
          },
        ],
      }
      const deps = makeDeps({
        getRujukanSkpd: vi.fn(async () => mockRujukanSkpd),
      })
      const reg = useKioskRegistration(deps)

      reg.selectedPatient.value = {
        pasienId: 'PT1',
        pasienName: 'Andi',
        nik: '123',
        noMR: 'MR1',
        tglLahir: '1990-01-01',
      }
      reg.flow.value = 'WALKIN_SELECT_GUARANTEE'
      reg.mode.value = 'walkin'

      await reg.selectWalkinGuarantee({
        tipeJaminanId: 'BPJS',
        tipeJaminanName: 'BPJS Kesehatan',
        noPeserta: '000123456',
      })

      expect(reg.bpjsReferences.value).toHaveLength(3)
      expect(reg.bpjsReferences.value[0].id).toBe('SKDP-111')
      expect(reg.bpjsReferences.value[0].type).toBe('skdp')
      expect(reg.bpjsReferences.value[1].id).toBe('SKDP-222')
      expect(reg.bpjsReferences.value[1].type).toBe('skdp')
      expect(reg.bpjsReferences.value[2].id).toBe('RUJ-999')
      expect(reg.bpjsReferences.value[2].type).toBe('rujukan')
    })

    it('transitions to BPJS_SELECT_REFERENCE after biometric verification when multiple references exist', async () => {
      const mockRujukanSkpd = {
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
          noRujukan: 'RUJ-999',
          tglRujukan: '2026-08-01',
          tujuan: { poliBpjsId: 'POL-1', poliBpjsName: 'Poli Umum' },
          faskesPerujuk: { faskesId: '0137R016', faskesName: 'Puskesmas Sehat' },
          diagnosaRujukan: { icd10Id: 'Z00.0', icd10Name: 'DM' },
        },
        listSkdp: [
          {
            noSkdp: 'SKDP-111',
            tglRencanaKontrol: '2026-08-02',
            tglExpired: '2026-08-10',
            isSpri: false,
            poliPerujuk: { layananId: 'LY-1', layananName: 'Poli Penyakit Dalam' },
            poliTujuan: { layananId: 'LY-2', layananName: 'Poli Jantung' },
            diagnosa: { icd10Id: 'I10', icd10Name: 'Hipertensi' },
            keterangan: '',
          },
        ],
      }
      const deps = makeDeps({
        getRujukanSkpd: vi.fn(async () => mockRujukanSkpd),
        verifyBiometric: vi.fn(async () => ({ outcome: 'SUCCESS' as const })),
      })
      const reg = useKioskRegistration(deps)

      reg.selectedPatient.value = {
        pasienId: 'PT1',
        pasienName: 'Andi',
        nik: '123',
        noMR: 'MR1',
        tglLahir: '1990-01-01',
      }
      reg.flow.value = 'WALKIN_SELECT_GUARANTEE'
      reg.mode.value = 'walkin'

      await reg.selectWalkinGuarantee({
        tipeJaminanId: 'BPJS',
        tipeJaminanName: 'BPJS Kesehatan',
        noPeserta: '000123456',
      })

      expect(reg.flow.value).toBe('BPJS_SELECT_REFERENCE')

      await reg.selectBpjsReference(reg.bpjsReferences.value[0])
      expect(reg.flow.value).toBe('WALKIN_SELECT_SERVICE')
      expect(reg.selectedBpjsReference.value?.id).toBe('SKDP-111')
    })

    it('bypasses BPJS_SELECT_REFERENCE when only exactly 1 reference exists', async () => {
      const mockRujukanSkpd = {
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
          noRujukan: 'RUJ-999',
          tglRujukan: '2026-08-01',
          tujuan: { poliBpjsId: 'POL-1', poliBpjsName: 'Poli Umum' },
          faskesPerujuk: { faskesId: '0137R016', faskesName: 'Puskesmas Sehat' },
          diagnosaRujukan: { icd10Id: 'Z00.0', icd10Name: 'DM' },
        },
        listSkdp: [],
      }
      const deps = makeDeps({
        getRujukanSkpd: vi.fn(async () => mockRujukanSkpd),
        verifyBiometric: vi.fn(async () => ({ outcome: 'SUCCESS' as const })),
      })
      const reg = useKioskRegistration(deps)

      reg.selectedPatient.value = {
        pasienId: 'PT1',
        pasienName: 'Andi',
        nik: '123',
        noMR: 'MR1',
        tglLahir: '1990-01-01',
      }
      reg.flow.value = 'WALKIN_SELECT_GUARANTEE'
      reg.mode.value = 'walkin'

      await reg.selectWalkinGuarantee({
        tipeJaminanId: 'BPJS',
        tipeJaminanName: 'BPJS Kesehatan',
        noPeserta: '000123456',
      })

      expect(reg.flow.value).toBe('WALKIN_SELECT_SERVICE')
      expect(reg.selectedBpjsReference.value?.id).toBe('RUJ-999')
    })

    it('runs deepSearchPasien and transitions to PATIENT_CONTEXT_CONFIRM on booking search miss but deep patient search hit', async () => {
      const mockDeepSearchResult = {
        pasienId: 'PT-DEEP',
        isActive: true,
        person: {
          personName: 'Rina Deep',
          tglLahir: '1995-05-15',
          gender: 'P' as const,
          alamat: {
            alamat: ['Jl. Merdeka 10'],
            kota: 'Bandung',
            kodePos: '40111',
          },
          contact: {
            jenisContact: 2,
            contactDetail: '08123456789',
          },
          identity: {
            jenisId: 'NIK',
            nomorId: '3273123456789001',
          },
        },
      }
      const deps = makeDeps({
        searchBooking: vi.fn(async () => []),
        deepSearchPasien: vi.fn(async () => [mockDeepSearchResult]),
      })
      const reg = useKioskRegistration(deps)

      await reg.submitBookingKeyword('08123456789')

      expect(deps.searchBooking).toHaveBeenCalled()
      expect(deps.deepSearchPasien).toHaveBeenCalledWith('08123456789')
      expect(reg.flow.value).toBe('PATIENT_CONTEXT_CONFIRM')
      expect(reg.patientContextResult.value?.patients.items).toHaveLength(1)
      expect(reg.patientContextResult.value?.patients.items[0].patientName).toBe('Rina Deep')
      expect(reg.patientContextResult.value?.patients.items[0].patientId).toBe('PT-DEEP')
    })
  })
})

describe('useKioskRegistration PATIENT_CONTEXT_SEARCH entry', () => {
  it('enters PATIENT_CONTEXT_SEARCH while searching, then confirms', async () => {
    let release!: (v: typeof contextResponse) => void
    const deps = makeDeps({
      searchBooking: vi.fn(async () => []),
      searchPatientContext: vi.fn(
        () =>
          new Promise<typeof contextResponse>((resolve) => {
            release = resolve
          }),
      ),
    })
    const reg = useKioskRegistration(deps)
    const p = reg.submitBookingKeyword('Andi')
    expect(reg.flow.value).toBe('PATIENT_CONTEXT_SEARCH')
    await vi.waitFor(() => expect(release).toBeDefined())
    release(contextResponse)
    await p
    expect(reg.flow.value).toBe('PATIENT_CONTEXT_CONFIRM')
  })

  it('ignores a late booking result after cancelling the search', async () => {
    let release!: (v: BookingSearchItem[]) => void
    const deps = makeDeps({
      searchBooking: vi.fn(
        () =>
          new Promise<BookingSearchItem[]>((resolve) => {
            release = resolve
          }),
      ),
    })
    const reg = useKioskRegistration(deps)
    const p = reg.submitBookingKeyword('BK1')
    expect(reg.flow.value).toBe('PATIENT_CONTEXT_SEARCH')
    await vi.waitFor(() => expect(release).toBeDefined())
    reg.cancelPatientContext()
    expect(reg.flow.value).toBe('HOME')
    release([bookingItem])
    await p
    expect(reg.flow.value).toBe('HOME')
    expect(deps.getBookingDetail).not.toHaveBeenCalled()
  })

  it('ignores a late biometric verdict after going home', async () => {
    let release!: (v: { outcome: 'SUCCESS' }) => void
    const deps = makeDeps({
      verifyBiometric: vi.fn(
        () =>
          new Promise<{ outcome: 'SUCCESS' }>((r) => {
            release = r
          }),
      ),
    })
    const reg = useKioskRegistration(deps)
    await reg.submitBookingKeyword('BK1')
    const p = reg.confirmBooking()
    await flushPromises()
    expect(reg.flow.value).toBe('BIOMETRIC_VERIFY')
    await vi.waitFor(() => expect(release).toBeDefined())
    reg.goHome()
    release({ outcome: 'SUCCESS' })
    await p
    await flushPromises()
    expect(reg.flow.value).toBe('HOME')
    expect(reg.errorContext.value).toBeNull()
  })
})

describe('useKioskRegistration P2-S04 reference-specific pre-registration preparation', () => {
  it('resolves the rujukan PPK mapping before the booking registration and uses local ids', async () => {
    const deps = makeDeps()
    const reg = useKioskRegistration(deps)
    await reg.submitBookingKeyword('BK1')
    await reg.confirmBooking()

    expect(reg.flow.value).toBe('REGISTRATION_SUCCESS')
    expect(deps.getRujukanByPpk).toHaveBeenCalledWith('0137R016')
    expect(vi.mocked(deps.getRujukanByPpk).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(deps.registerBooking).mock.invocationCallOrder[0],
    )
    expect(deps.registerBooking).toHaveBeenCalledWith(
      expect.objectContaining({
        rujukanId: 'RUJ-LOCAL-1',
        caraMasukDkId: '5',
        tipeJaminanId: 'BPJS',
      }),
    )
  })

  it('never copies the BPJS rujukan number into the local rujukanId', async () => {
    const deps = makeDeps()
    const reg = useKioskRegistration(deps)
    await reg.submitBookingKeyword('BK1')
    await reg.confirmBooking()

    const payload = vi.mocked(deps.registerBooking).mock.calls[0][0]
    expect(payload.rujukanId).not.toBe('REF1')
    expect(payload.rujukanId).toBe('RUJ-LOCAL-1')
  })

  it('skips the PPK lookup and registers SKDP walk-in with empty local rujukanId and caraMasukDkId 8', async () => {
    const deps = makeDeps({
      searchBooking: vi.fn(async () => []),
      searchPatientContext: vi.fn(async () => contextResponse),
      getRujukanSkpd: vi.fn(async () => ({
        peserta: {
          noPeserta: '000123456',
          nama: 'Andi',
          hakKelas: { kode: '1', nama: 'Kelas 1' },
          status: { kode: '1', info: 'AKTIF' },
          jenisPeserta: { kode: 'PNS', nama: 'PNS' },
          provider: { kode: 'P1', nama: 'RS A' },
          prbInfo: null,
          tglTat: '2026-08-06',
          tglLahir: '1980-01-01',
        },
        rujukan: null,
        listSkdp: [
          {
            noSkdp: 'SKDP_99',
            tglRencanaKontrol: '2026-08-01',
            tglExpired: '2026-08-10',
            isSpri: false,
            poliPerujuk: { layananId: 'LY-1', layananName: 'Poli Penyakit Dalam' },
            poliTujuan: { layananId: 'LY-2', layananName: 'Poli Jantung' },
            diagnosa: { icd10Id: 'I10', icd10Name: 'Hypertension' },
            keterangan: '',
          },
        ],
      })),
      verifyBiometric: vi.fn(async () => ({ outcome: 'SUCCESS' as const })),
    })
    const reg = useKioskRegistration(deps)
    await reg.submitBookingKeyword('Budi')
    expect(reg.flow.value).toBe('PATIENT_CONTEXT_CONFIRM')
    await reg.confirmPatientContext(contextItem)
    await reg.selectWalkinGuarantee({
      tipeJaminanId: 'BPJS',
      tipeJaminanName: 'BPJS',
      noPeserta: '000123456',
    })
    expect(reg.flow.value).toBe('WALKIN_SELECT_SERVICE')
    reg.selectService({
      poli: { id: 'PO1', name: 'Poli Jantung' },
      dokter: { id: 'DP1', name: 'Dr. X' },
      jadwal: { jadwalId: 'J1', ppaId: 'DP1', jamPraktek: '08:00', sisaKuota: 5 },
    })
    await reg.confirmWalkin()

    expect(reg.flow.value).toBe('REGISTRATION_SUCCESS')
    expect(deps.getRujukanByPpk).not.toHaveBeenCalled()
    expect(deps.registerWalkin).toHaveBeenCalledWith(
      expect.objectContaining({
        rujukanId: '',
        caraMasukDkId: '8',
        tipeJaminanId: 'BPJS',
      }),
    )
  })

  it('walks-in with a rujukan reference using the mapped local ids and no BPJS number', async () => {
    const deps = makeDeps({
      searchBooking: vi.fn(async () => []),
      searchPatientContext: vi.fn(async () => contextResponse),
      verifyBiometric: vi.fn(async () => ({ outcome: 'SUCCESS' as const })),
    })
    const reg = useKioskRegistration(deps)
    await reg.submitBookingKeyword('Budi')
    await reg.confirmPatientContext(contextItem)
    await reg.selectWalkinGuarantee({
      tipeJaminanId: 'BPJS',
      tipeJaminanName: 'BPJS',
      noPeserta: '000123456',
    })
    expect(reg.flow.value).toBe('WALKIN_SELECT_SERVICE')
    reg.selectService({
      poli: { id: 'PO1', name: 'Poli Jantung' },
      dokter: { id: 'DP1', name: 'Dr. X' },
      jadwal: { jadwalId: 'J1', ppaId: 'DP1', jamPraktek: '08:00', sisaKuota: 5 },
    })
    await reg.confirmWalkin()

    expect(reg.flow.value).toBe('REGISTRATION_SUCCESS')
    expect(deps.getRujukanByPpk).toHaveBeenCalledWith('0137R016')
    expect(deps.registerWalkin).toHaveBeenCalledWith(
      expect.objectContaining({
        rujukanId: 'RUJ-LOCAL-1',
        caraMasukDkId: '5',
      }),
    )
  })

  it('fails rujukan registration when the PPK mapping key is missing', async () => {
    const deps = makeDeps({
      searchBooking: vi.fn(async () => []),
      searchPatientContext: vi.fn(async () => contextResponse),
      verifyBiometric: vi.fn(async () => ({ outcome: 'SUCCESS' as const })),
    })
    const reg = useKioskRegistration(deps)
    await reg.submitBookingKeyword('Budi')
    await reg.confirmPatientContext(contextItem)
    await reg.selectWalkinGuarantee({
      tipeJaminanId: 'BPJS',
      tipeJaminanName: 'BPJS',
      noPeserta: '000123456',
    })
    expect(reg.flow.value).toBe('WALKIN_SELECT_SERVICE')
    reg.selectedBpjsReference.value = {
      type: 'rujukan',
      id: 'REF-X',
      date: '2026-08-01',
      diagnosaId: 'Z00.0',
      diagnosaName: 'Checkup',
      kelasRawatId: '3',
      tglLahir: '1990-01-01',
      original: {},
    }
    reg.selectService({
      poli: { id: 'PO1', name: 'Poli Jantung' },
      dokter: { id: 'DP1', name: 'Dr. X' },
      jadwal: { jadwalId: 'J1', ppaId: 'DP1', jamPraktek: '08:00', sisaKuota: 5 },
    })
    await reg.confirmWalkin()

    expect(reg.flow.value).toBe('FAILURE')
    expect(reg.errorContext.value?.message).toContain('faskes perujuk')
    expect(deps.getRujukanByPpk).not.toHaveBeenCalled()
    expect(deps.registerWalkin).not.toHaveBeenCalled()
  })
})

describe('useKioskRegistration P2-S05 reference-specific SEP payload construction', () => {
  const rujukanOnlyResponse = {
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
  }

  const skdpOnlyResponse = {
    peserta: {
      noPeserta: '000123456',
      nama: 'Andi',
      hakKelas: { kode: '1', nama: 'Kelas 1' },
      status: { kode: '1', info: 'AKTIF' },
      jenisPeserta: { kode: 'PNS', nama: 'PNS' },
      provider: { kode: 'P1', nama: 'RS A' },
      prbInfo: null,
      tglTat: '2026-08-06',
      tglLahir: '1980-01-01',
    },
    rujukan: null,
    listSkdp: [
      {
        noSkdp: 'SKDP_99',
        tglRencanaKontrol: '2026-08-01',
        tglExpired: '2026-08-10',
        isSpri: false,
        poliPerujuk: { layananId: 'LY-1', layananName: 'Poli Penyakit Dalam' },
        poliTujuan: { layananId: 'LY-2', layananName: 'Poli Jantung' },
        diagnosa: { icd10Id: 'I10', icd10Name: 'Hypertension' },
        keterangan: '',
      },
    ],
  }

  it('builds the standard outpatient SEP payload for a rujukan booking', async () => {
    const deps = makeDeps({
      getRujukanSkpd: vi.fn(async () => rujukanOnlyResponse),
      now: () => SEP_CLOCK,
    })
    const reg = useKioskRegistration(deps)
    await reg.submitBookingKeyword('BK1')
    await reg.confirmBooking()

    expect(reg.flow.value).toBe('REGISTRATION_SUCCESS')
    const payload = vi.mocked(deps.createSep).mock.calls[0][0]
    expect(payload).toMatchObject({
      sepId: '',
      noPeserta: '000123456',
      sepDate: '2026-08-03 14:05:06',
      noRujukan: 'REF1',
      pasienId: 'PT1',
      kelasRawatId: '3',
      tujuanKunjunganId: '0',
      flagProcedureId: '',
      assesmentPelayananId: '',
      penunjangId: '',
      diagnosaId: 'E11.8',
      katarak: '0',
      catatan: 'Kiosk Self Registration',
      kll: '0',
      userId: 'hidokkiosk',
    })
    expect(payload.faskesPerujukId).toBeUndefined()
  })

  it('builds the SKDP control SEP payload for a skdp booking', async () => {
    const deps = makeDeps({
      getRujukanSkpd: vi.fn(async () => skdpOnlyResponse),
      now: () => SEP_CLOCK,
    })
    const reg = useKioskRegistration(deps)
    await reg.submitBookingKeyword('BK1')
    await reg.confirmBooking()

    expect(reg.flow.value).toBe('REGISTRATION_SUCCESS')
    expect(deps.getRujukanByPpk).not.toHaveBeenCalled()
    const payload = vi.mocked(deps.createSep).mock.calls[0][0]
    expect(payload).toMatchObject({
      noPeserta: '000123456',
      sepDate: '2026-08-03 14:05:06',
      pasienId: 'PT1',
      noRujukan: 'SKDP_99',
      tujuanKunjunganId: '2',
      assesmentPelayananId: '5',
      flagProcedureId: '',
      penunjangId: '',
      faskesPerujukId: '',
      diagnosaId: 'I10',
      kelasRawatId: '1',
      userId: 'hidokkiosk',
    })
  })

  it('uses the same SKDP payload policy on the walk-in flow', async () => {
    const deps = makeDeps({
      searchBooking: vi.fn(async () => []),
      searchPatientContext: vi.fn(async () => contextResponse),
      getRujukanSkpd: vi.fn(async () => skdpOnlyResponse),
      verifyBiometric: vi.fn(async () => ({ outcome: 'SUCCESS' as const })),
      now: () => SEP_CLOCK,
    })
    const reg = useKioskRegistration(deps)
    await reg.submitBookingKeyword('Budi')
    await reg.confirmPatientContext(contextItem)
    await reg.selectWalkinGuarantee({
      tipeJaminanId: 'BPJS',
      tipeJaminanName: 'BPJS',
      noPeserta: '000123456',
    })
    expect(reg.flow.value).toBe('WALKIN_SELECT_SERVICE')
    reg.selectService({
      poli: { id: 'PO1', name: 'Poli Jantung' },
      dokter: { id: 'DP1', name: 'Dr. X' },
      jadwal: { jadwalId: 'J1', ppaId: 'DP1', jamPraktek: '08:00', sisaKuota: 5 },
    })
    await reg.confirmWalkin()

    expect(reg.flow.value).toBe('REGISTRATION_SUCCESS')
    const payload = vi.mocked(deps.createSep).mock.calls[0][0]
    expect(payload).toMatchObject({
      noPeserta: '000123456',
      sepDate: '2026-08-03 14:05:06',
      pasienId: 'PT1',
      noRujukan: 'SKDP_99',
      tujuanKunjunganId: '2',
      assesmentPelayananId: '5',
      flagProcedureId: '',
      penunjangId: '',
      faskesPerujukId: '',
      diagnosaId: 'I10',
      kelasRawatId: '1',
      userId: 'hidokkiosk',
    })
  })

  it('attempts SEP creation exactly once per registration flow', async () => {
    const deps = makeDeps()
    const reg = useKioskRegistration(deps)
    await reg.submitBookingKeyword('BK1')
    await reg.confirmBooking()

    expect(reg.flow.value).toBe('REGISTRATION_SUCCESS')
    expect(deps.createSep).toHaveBeenCalledTimes(1)
  })

  it('does not re-attempt SEP creation when SEP upload fails', async () => {
    const deps = makeDeps({
      uploadSep: vi.fn(async () => {
        throw new Error('upload failed')
      }),
    })
    const reg = useKioskRegistration(deps)
    await reg.submitBookingKeyword('BK1')
    await reg.confirmBooking()

    expect(reg.flow.value).toBe('FAILURE')
    expect(deps.createSep).toHaveBeenCalledTimes(1)
    expect(deps.setDataEligibility).not.toHaveBeenCalled()
  })

  it('buildSepPayloadPolicy applies the standard outpatient policy for a rujukan reference', () => {
    const ref: BpjsReference = {
      type: 'rujukan',
      id: 'REF1',
      date: '2026-08-01',
      diagnosaId: 'E11.8',
      diagnosaName: 'Type 2 DM',
      kelasRawatId: '3',
      tglLahir: '1990-01-01',
      faskesPerujukId: '0137R016',
      original: {},
    }
    const payload = buildSepPayloadPolicy({
      ref,
      noPeserta: '000123456',
      businessDate: '2026-08-03',
      clock: SEP_CLOCK,
      pasienId: 'PT1',
      fallbackNoRujukan: '',
    })
    expect(payload).toMatchObject({
      noRujukan: 'REF1',
      tujuanKunjunganId: '0',
      flagProcedureId: '',
      assesmentPelayananId: '',
      penunjangId: '',
      diagnosaId: 'E11.8',
    })
    expect(payload.faskesPerujukId).toBeUndefined()
  })

  it('buildSepPayloadPolicy applies the SKDP control policy with selected NoSkdp as NoRujukan', () => {
    const ref: BpjsReference = {
      type: 'skdp',
      id: 'SKDP_X',
      date: '2026-08-01',
      diagnosaId: 'I10',
      diagnosaName: 'Hypertension',
      kelasRawatId: '1',
      tglLahir: '1980-01-01',
      original: {},
    }
    const payload = buildSepPayloadPolicy({
      ref,
      noPeserta: '000123456',
      businessDate: '2026-08-03',
      clock: SEP_CLOCK,
      pasienId: 'PT1',
      fallbackNoRujukan: 'BOOKING-REF-NOT-USED',
    })
    expect(payload).toMatchObject({
      noRujukan: 'SKDP_X',
      tujuanKunjunganId: '2',
      assesmentPelayananId: '5',
      flagProcedureId: '',
      penunjangId: '',
      faskesPerujukId: '',
      diagnosaId: 'I10',
    })
  })

  it('buildSepPayloadPolicy rejects a missing diagnosis without an implicit fallback', () => {
    const emptyDiagnosis: BpjsReference = {
      type: 'rujukan',
      id: 'REF-X',
      date: '2026-08-01',
      diagnosaId: '',
      diagnosaName: '',
      kelasRawatId: '3',
      tglLahir: '1990-01-01',
      faskesPerujukId: '0137R016',
      original: {},
    }
    expect(() =>
      buildSepPayloadPolicy({
        ref: emptyDiagnosis,
        noPeserta: '000123456',
        businessDate: '2026-08-03',
        clock: SEP_CLOCK,
        pasienId: 'PT1',
        fallbackNoRujukan: '',
      }),
    ).toThrow('Diagnosa')
    expect(() =>
      buildSepPayloadPolicy({
        ref: null,
        noPeserta: '000123456',
        businessDate: '2026-08-03',
        clock: SEP_CLOCK,
        pasienId: 'PT1',
        fallbackNoRujukan: 'BOOKING-REF',
      }),
    ).toThrow('Diagnosa')
  })

  it('composes sepDate as the business date plus the injected clock time', () => {
    const rujukanRef: BpjsReference = {
      type: 'rujukan',
      id: 'REF1',
      date: '2026-08-01',
      diagnosaId: 'E11.8',
      diagnosaName: 'Type 2 DM',
      kelasRawatId: '3',
      tglLahir: '1990-01-01',
      faskesPerujukId: '0137R016',
      original: {},
    }
    const skdpRef: BpjsReference = { ...rujukanRef, type: 'skdp', id: 'SKDP_X' }

    const rujukanPayload = buildSepPayloadPolicy({
      ref: rujukanRef,
      noPeserta: '000123456',
      businessDate: '2026-08-03',
      clock: SEP_CLOCK,
      pasienId: 'PT1',
      fallbackNoRujukan: '',
    })
    expect(rujukanPayload.sepDate).toBe('2026-08-03 14:05:06')
    expect(rujukanPayload.sepDate).toMatch(SEP_DATE_TIME_PATTERN)
    expect(sepCreateBodySchema.parse(rujukanPayload).sepDate).toBe('2026-08-03 14:05:06')

    const skdpPayload = buildSepPayloadPolicy({
      ref: skdpRef,
      noPeserta: '000123456',
      businessDate: '2026-08-03',
      clock: SEP_CLOCK,
      pasienId: 'PT1',
      fallbackNoRujukan: '',
    })
    expect(skdpPayload.sepDate).toBe('2026-08-03 14:05:06')
    expect(sepCreateBodySchema.parse(skdpPayload).sepDate).toBe('2026-08-03 14:05:06')
  })

  it('keeps the business date as the date component when it differs from the clock date', () => {
    const ref: BpjsReference = {
      type: 'rujukan',
      id: 'REF1',
      date: '2026-08-01',
      diagnosaId: 'E11.8',
      diagnosaName: 'Type 2 DM',
      kelasRawatId: '3',
      tglLahir: '1990-01-01',
      faskesPerujukId: '0137R016',
      original: {},
    }
    const payload = buildSepPayloadPolicy({
      ref,
      noPeserta: '000123456',
      businessDate: '2026-08-03',
      clock: SEP_CLOCK_OTHER_DAY,
      pasienId: 'PT1',
      fallbackNoRujukan: '',
    })
    expect(payload.sepDate).toBe('2026-08-03 22:30:09')
  })

  it('rejects a business date that is not yyyy-MM-dd as a contract failure', () => {
    const ref: BpjsReference = {
      type: 'rujukan',
      id: 'REF1',
      date: '2026-08-01',
      diagnosaId: 'E11.8',
      diagnosaName: 'Type 2 DM',
      kelasRawatId: '3',
      tglLahir: '1990-01-01',
      faskesPerujukId: '0137R016',
      original: {},
    }
    expect(() =>
      buildSepPayloadPolicy({
        ref,
        noPeserta: '000123456',
        businessDate: '',
        clock: SEP_CLOCK,
        pasienId: 'PT1',
        fallbackNoRujukan: '',
      }),
    ).toThrow(SepDateContractError)
  })

  it('emits a sepDate conforming to the Jetli contract from the rujukan branch when the clock date differs', async () => {
    const deps = makeDeps({
      getRujukanSkpd: vi.fn(async () => rujukanOnlyResponse),
      now: () => SEP_CLOCK_OTHER_DAY,
    })
    const reg = useKioskRegistration(deps)
    await reg.submitBookingKeyword('BK1')
    await reg.confirmBooking()

    const payload = vi.mocked(deps.createSep).mock.calls[0][0]
    expect(payload.sepDate).toBe('2026-08-03 22:30:09')
    expect(payload.sepDate).toMatch(SEP_DATE_TIME_PATTERN)
    expect(sepCreateBodySchema.parse(payload).sepDate).toBe('2026-08-03 22:30:09')
  })

  it('rejects the SEP payload when the business date is unavailable, without a fallback date', async () => {
    const deps = makeDeps({
      getRujukanSkpd: vi.fn(async () => rujukanOnlyResponse),
      getBusinessDate: vi.fn(async () => ''),
    })
    const reg = useKioskRegistration(deps)
    await reg.submitBookingKeyword('BK1')
    await reg.confirmBooking()

    expect(deps.createSep).not.toHaveBeenCalled()
  })
})

describe('useKioskRegistration P2-S04 SEP contract-failure behaviour', () => {
  async function reachBookingRegister(reg: ReturnType<typeof useKioskRegistration>) {
    await reg.submitBookingKeyword('BK1')
    await reg.confirmBooking()
  }

  function warnSpy() {
    return vi.spyOn(console, 'warn').mockImplementation(() => {})
  }

  function contractLogLines(warn: ReturnType<typeof warnSpy>): string[] {
    return warn.mock.calls
      .map((call) => String(call[0]))
      .filter((line) => line.includes(SEP_CONTRACT_FAILURE_LOG_PREFIX))
  }

  it('issues no SEP request and preserves the regId when sepDate cannot be composed', async () => {
    const warn = warnSpy()
    const deps = makeDeps({ now: () => Number.NaN })
    const reg = useKioskRegistration(deps)
    await reachBookingRegister(reg)

    expect(deps.createSep).not.toHaveBeenCalled()
    expect(deps.registerBooking).toHaveBeenCalledTimes(1)
    expect(deps.uploadSep).not.toHaveBeenCalled()
    expect(deps.setDataEligibility).not.toHaveBeenCalled()
    expect(reg.flow.value).toBe('FAILURE')
    expect(reg.postRegistrationPhase.value).toBe('ADMISI_FALLBACK')
    expect(reg.registrationResult.value?.regId).toBe('R1')
    expect(reg.errorContext.value?.message).toContain('Pendaftaran berhasil (R1)')
    warn.mockRestore()
  })

  it('logs the rejection as a contract failure naming sepDate, without identity or body', async () => {
    const warn = warnSpy()
    const deps = makeDeps({ now: () => Number.NaN })
    const reg = useKioskRegistration(deps)
    await reachBookingRegister(reg)

    const lines = contractLogLines(warn)
    expect(lines).toHaveLength(1)
    expect(lines[0]).toContain('field=sepDate')
    expect(lines[0]).not.toContain('000123456')
    expect(lines[0]).not.toContain('Andi')
    expect(lines[0]).not.toContain('diagnosaId')
    warn.mockRestore()
  })

  it('recovers once, without retrying, when the shared client contract rejects the payload', async () => {
    const warn = warnSpy()
    const createSep = vi.fn(() => {
      // Mirrors the shared client contract in the API client: a synchronous
      // rejection before any POST /sep request is issued.
      sepCreateBodySchema.parse({ noPeserta: '000123456', sepDate: '2026-08-03' })
      return Promise.resolve({ sepId: 'sep-1', sepNo: '0112R' })
    })
    const deps = makeDeps({ createSep: createSep as unknown as KioskRegistrationDeps['createSep'] })
    const reg = useKioskRegistration(deps)
    await reachBookingRegister(reg)

    expect(createSep).toHaveBeenCalledTimes(1)
    expect(deps.uploadSep).not.toHaveBeenCalled()
    expect(deps.setDataEligibility).not.toHaveBeenCalled()
    expect(deps.registerBooking).toHaveBeenCalledTimes(1)
    expect(reg.postRegistrationPhase.value).toBe('ADMISI_FALLBACK')
    expect(reg.registrationResult.value?.regId).toBe('R1')
    expect(reg.errorContext.value?.message).toContain('Pendaftaran berhasil (R1)')
    const lines = contractLogLines(warn)
    expect(lines).toHaveLength(1)
    expect(lines[0]).toContain('field=sepDate')
    warn.mockRestore()
  })

  it('does not log a contract failure for a Jetli business rejection', async () => {
    const warn = warnSpy()
    const deps = makeDeps({
      createSep: vi.fn(async () => 'SEP sudah ada untuk pasien ini' as ResponseCreateSep),
    })
    const reg = useKioskRegistration(deps)
    await reachBookingRegister(reg)

    expect(reg.postRegistrationPhase.value).toBe('ADMISI_FALLBACK')
    expect(reg.registrationResult.value?.regId).toBe('R1')
    expect(contractLogLines(warn)).toHaveLength(0)
    warn.mockRestore()
  })

  it('does not log a contract failure for a transport error', async () => {
    const warn = warnSpy()
    const deps = makeDeps({
      createSep: vi.fn(async () => {
        throw new ApiClientError('Network request failed', 0)
      }),
    })
    const reg = useKioskRegistration(deps)
    await reachBookingRegister(reg)

    expect(reg.postRegistrationPhase.value).toBe('ADMISI_FALLBACK')
    expect(contractLogLines(warn)).toHaveLength(0)
    warn.mockRestore()
  })
})

describe('useKioskRegistration P3-S06 post-registration retry and admisi fallback', () => {
  async function reachBookingRegister(reg: ReturnType<typeof useKioskRegistration>) {
    await reg.submitBookingKeyword('BK1')
    await reg.confirmBooking()
  }

  it('retains registration success before SEP processing begins', async () => {
    let resolveCreate!: (v: ResponseCreateSep) => void
    const deps = makeDeps({
      createSep: vi.fn(
        () =>
          new Promise<ResponseCreateSep>((resolve) => {
            resolveCreate = resolve
          }),
      ),
    })
    const reg = useKioskRegistration(deps)
    await reg.submitBookingKeyword('BK1')
    const pending = reg.confirmBooking()
    await flushPromises()
    await vi.waitFor(() => expect(resolveCreate).toBeDefined())

    expect(reg.registrationResult.value?.regId).toBe('R1')
    expect(reg.postRegistrationPhase.value).toBe('SEP_CREATE_ATTEMPTED')
    expect(reg.flow.value).not.toBe('FAILURE')
    expect(deps.registerBooking).toHaveBeenCalledTimes(1)
    expect(deps.createSep).toHaveBeenCalledTimes(1)

    resolveCreate({ sepId: 'sep-1', sepNo: '0112R' })
    await pending
    expect(reg.flow.value).toBe('REGISTRATION_SUCCESS')
    expect(reg.postRegistrationPhase.value).toBe('ELIGIBILITY_RECORDED')
  })

  it('advances to ELIGIBILITY_RECORDED and keeps the regId on success', async () => {
    const deps = makeDeps()
    const reg = useKioskRegistration(deps)
    await reachBookingRegister(reg)

    expect(reg.flow.value).toBe('REGISTRATION_SUCCESS')
    expect(reg.postRegistrationPhase.value).toBe('ELIGIBILITY_RECORDED')
    expect(reg.registrationResult.value?.regId).toBe('R1')
    expect(deps.uploadSep).toHaveBeenCalledTimes(1)
    expect(deps.setDataEligibility).toHaveBeenCalledTimes(1)
  })

  it('records eligibility with the upload SEP identity when create returns a placeholder number', async () => {
    const deps = makeDeps({
      createSep: vi.fn(async () => ({
        sepId: 'sep-create',
        sepNo: '-',
        noPeserta: '123',
        namaPeserta: 'A',
      })),
      uploadSep: vi.fn(async () => ({
        sepId: 'sep-upload',
        sepNo: '0112R',
        noPeserta: '123',
        namaPeserta: 'A',
      })),
    })
    const reg = useKioskRegistration(deps)
    await reachBookingRegister(reg)

    expect(deps.createSep).toHaveBeenCalledTimes(1)
    expect(deps.uploadSep).toHaveBeenCalledTimes(1)
    // TD-SJP-01: the create `sepId` survives only as the upload request key.
    expect(deps.uploadSep).toHaveBeenCalledWith({ sepId: 'sep-create', regId: 'R1' })
    expect(deps.setDataEligibility).toHaveBeenCalledTimes(1)
    expect(deps.setDataEligibility).toHaveBeenCalledWith({
      regId: 'R1',
      sjpNo: '0112R',
      pesertaJaminanId: '000123456',
      sjpId: 'sep-upload',
    })
    expect(reg.postRegistrationPhase.value).toBe('ELIGIBILITY_RECORDED')
    expect(reg.flow.value).toBe('REGISTRATION_SUCCESS')
    expect(deps.printRegistration).toHaveBeenCalledWith(expect.objectContaining({ noSep: '0112R' }))
  })

  it('keeps REGISTRATION_CREATED when no SEP processing is required', async () => {
    const deps = makeDeps({ getBookingDetail: vi.fn(async () => umumDetail) })
    const reg = useKioskRegistration(deps)
    await reg.submitBookingKeyword('BK1')
    await reg.confirmBooking()

    expect(reg.flow.value).toBe('REGISTRATION_SUCCESS')
    expect(reg.postRegistrationPhase.value).toBe('REGISTRATION_CREATED')
    expect(deps.createSep).not.toHaveBeenCalled()
  })

  it('does not trigger a blind second SEP create for an unknown create outcome', async () => {
    const deps = makeDeps({
      createSep: vi.fn(async () => {
        throw new ApiClientError('Network request failed', 0)
      }),
    })
    const reg = useKioskRegistration(deps)
    await reachBookingRegister(reg)

    expect(reg.flow.value).toBe('FAILURE')
    expect(reg.postRegistrationPhase.value).toBe('ADMISI_FALLBACK')
    expect(deps.createSep).toHaveBeenCalledTimes(1)
    expect(deps.uploadSep).not.toHaveBeenCalled()
    expect(deps.setDataEligibility).not.toHaveBeenCalled()
    expect(deps.registerBooking).toHaveBeenCalledTimes(1)
    expect(reg.registrationResult.value?.regId).toBe('R1')
  })

  it('treats a business-error SEP create response as a non-repeatable failure', async () => {
    const deps = makeDeps({
      createSep: vi.fn(async () => 'SEP sudah ada untuk pasien ini' as ResponseCreateSep),
    })
    const reg = useKioskRegistration(deps)
    await reachBookingRegister(reg)

    expect(reg.flow.value).toBe('FAILURE')
    expect(reg.postRegistrationPhase.value).toBe('ADMISI_FALLBACK')
    expect(deps.createSep).toHaveBeenCalledTimes(1)
    expect(deps.uploadSep).not.toHaveBeenCalled()
    expect(reg.errorContext.value?.message).toContain('Pendaftaran berhasil (R1)')
  })

  it('retries SEP upload at most three times before admisi fallback', async () => {
    const deps = makeDeps({
      uploadSep: vi.fn(async () => {
        throw new Error('upload down')
      }),
    })
    const reg = useKioskRegistration(deps)
    await reachBookingRegister(reg)

    expect(deps.createSep).toHaveBeenCalledTimes(1)
    expect(deps.uploadSep).toHaveBeenCalledTimes(3)
    expect(deps.setDataEligibility).not.toHaveBeenCalled()
    expect(reg.flow.value).toBe('FAILURE')
    expect(reg.postRegistrationPhase.value).toBe('ADMISI_FALLBACK')
    expect(reg.registrationResult.value?.regId).toBe('R1')
    for (const call of vi.mocked(deps.uploadSep).mock.calls) {
      expect(call[0]).toEqual({ sepId: 'sep-1', regId: 'R1' })
    }
  })

  it('treats a business-error SEP upload response as a failed attempt', async () => {
    const deps = makeDeps({
      uploadSep: vi.fn(async () => 'Upload SEP ditolak' as ResponseUploadSep),
    })
    const reg = useKioskRegistration(deps)
    await reachBookingRegister(reg)

    expect(deps.uploadSep).toHaveBeenCalledTimes(3)
    expect(deps.setDataEligibility).not.toHaveBeenCalled()
    expect(reg.flow.value).toBe('FAILURE')
    expect(reg.postRegistrationPhase.value).toBe('ADMISI_FALLBACK')
    expect(reg.registrationResult.value?.regId).toBe('R1')
  })

  it('continues when SEP upload recovers within the attempt limit', async () => {
    const uploadSep = vi
      .fn<() => Promise<ResponseUploadSep>>()
      .mockRejectedValueOnce(new Error('down'))
      .mockRejectedValueOnce(new Error('down'))
      .mockResolvedValueOnce({ sepId: 'sep-1', sepNo: '0112R' })
    const deps = makeDeps({ uploadSep })
    const reg = useKioskRegistration(deps)
    await reachBookingRegister(reg)

    expect(deps.uploadSep).toHaveBeenCalledTimes(3)
    expect(deps.setDataEligibility).toHaveBeenCalledTimes(1)
    expect(reg.flow.value).toBe('REGISTRATION_SUCCESS')
    expect(reg.postRegistrationPhase.value).toBe('ELIGIBILITY_RECORDED')
  })

  it('retries Reg/setDataEligibility at most three times before admisi fallback', async () => {
    const deps = makeDeps({
      setDataEligibility: vi.fn(async () => {
        throw new Error('eligibility down')
      }),
    })
    const reg = useKioskRegistration(deps)
    await reachBookingRegister(reg)

    expect(deps.createSep).toHaveBeenCalledTimes(1)
    expect(deps.uploadSep).toHaveBeenCalledTimes(1)
    expect(deps.setDataEligibility).toHaveBeenCalledTimes(3)
    expect(reg.flow.value).toBe('FAILURE')
    expect(reg.postRegistrationPhase.value).toBe('ADMISI_FALLBACK')
    expect(reg.registrationResult.value?.regId).toBe('R1')
    for (const call of vi.mocked(deps.setDataEligibility).mock.calls) {
      expect(call[0]).toEqual({
        regId: 'R1',
        sjpNo: '0112R',
        pesertaJaminanId: '000123456',
        sjpId: 'sep-1',
      })
    }
  })

  it('continues when the eligibility update recovers within the attempt limit', async () => {
    const setDataEligibility = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('down'))
      .mockRejectedValueOnce(new Error('down'))
      .mockResolvedValueOnce('OK')
    const deps = makeDeps({ setDataEligibility })
    const reg = useKioskRegistration(deps)
    await reachBookingRegister(reg)

    expect(deps.setDataEligibility).toHaveBeenCalledTimes(3)
    expect(reg.flow.value).toBe('REGISTRATION_SUCCESS')
    expect(reg.postRegistrationPhase.value).toBe('ELIGIBILITY_RECORDED')
  })

  it('preserves the existing regId on every post-registration failure path', async () => {
    const scenarios: Array<[string, (deps: KioskRegistrationDeps) => void]> = [
      [
        'SEP create',
        (deps) => {
          deps.createSep = vi.fn(async () => {
            throw new Error('create down')
          })
        },
      ],
      [
        'SEP upload',
        (deps) => {
          deps.uploadSep = vi.fn(async () => {
            throw new Error('upload down')
          })
        },
      ],
      [
        'eligibility',
        (deps) => {
          deps.setDataEligibility = vi.fn(async () => {
            throw new Error('eligibility down')
          })
        },
      ],
    ]

    for (const [name, apply] of scenarios) {
      const deps = makeDeps()
      apply(deps)
      const reg = useKioskRegistration(deps)
      await reachBookingRegister(reg)

      expect(reg.flow.value, name).toBe('FAILURE')
      expect(reg.postRegistrationPhase.value, name).toBe('ADMISI_FALLBACK')
      expect(reg.registrationResult.value?.regId, name).toBe('R1')
      expect(deps.registerBooking, name).toHaveBeenCalledTimes(1)
      expect(reg.errorContext.value?.message, name).toContain('Pendaftaran berhasil (R1)')
    }
  })

  it('shares the same recovery invariants with the walk-in flow', async () => {
    const deps = makeDeps({
      searchBooking: vi.fn(async () => []),
      searchPatientContext: vi.fn(async () => contextResponse),
      uploadSep: vi.fn(async () => {
        throw new Error('upload down')
      }),
      verifyBiometric: vi.fn(async () => ({ outcome: 'SUCCESS' as const })),
    })
    const reg = useKioskRegistration(deps)
    await reg.submitBookingKeyword('Budi')
    await reg.confirmPatientContext(contextItem)
    await reg.selectWalkinGuarantee({
      tipeJaminanId: 'BPJS',
      tipeJaminanName: 'BPJS',
      noPeserta: '000123456',
    })
    expect(reg.flow.value).toBe('WALKIN_SELECT_SERVICE')
    reg.selectService({
      poli: { id: 'PO1', name: 'Poli Jantung' },
      dokter: { id: 'DP1', name: 'Dr. X' },
      jadwal: { jadwalId: 'J1', ppaId: 'DP1', jamPraktek: '08:00', sisaKuota: 5 },
    })
    await reg.confirmWalkin()

    expect(deps.createSep).toHaveBeenCalledTimes(1)
    expect(deps.uploadSep).toHaveBeenCalledTimes(3)
    expect(deps.setDataEligibility).not.toHaveBeenCalled()
    expect(deps.registerWalkin).toHaveBeenCalledTimes(1)
    expect(reg.flow.value).toBe('FAILURE')
    expect(reg.postRegistrationPhase.value).toBe('ADMISI_FALLBACK')
    expect(reg.registrationResult.value?.regId).toBe('R2')

    await reg.confirmAssistance('ADMISI')
    expect(reg.flow.value).toBe('ASSISTANCE_QUEUE')
    expect(deps.intake).toHaveBeenCalledWith('ADMISI')
    expect(reg.registrationResult.value?.regId).toBe('R2')
  })

  it('routes exhausted booking recovery to the admisi fallback at the configured service point', async () => {
    const deps = makeDeps({
      uploadSep: vi.fn(async () => {
        throw new Error('upload down')
      }),
    })
    const reg = useKioskRegistration(deps)
    await reachBookingRegister(reg)
    expect(reg.flow.value).toBe('FAILURE')

    await reg.confirmAssistance('ADMISI')
    expect(reg.flow.value).toBe('ASSISTANCE_QUEUE')
    expect(deps.bookingAssistance).toHaveBeenCalledWith(
      expect.objectContaining({ bookingId: 'BK1', servicePointId: 'ADMISI' }),
    )
    expect(reg.registrationResult.value?.regId).toBe('R1')
  })
})

describe('useKioskRegistration P1-S02 invalid upload identity guard', () => {
  async function reachBookingRegister(reg: ReturnType<typeof useKioskRegistration>) {
    await reg.submitBookingKeyword('BK1')
    await reg.confirmBooking()
  }

  async function reachWalkinRegister(reg: ReturnType<typeof useKioskRegistration>) {
    await reg.submitBookingKeyword('Budi')
    await reg.confirmPatientContext(contextItem)
    await reg.selectWalkinGuarantee({
      tipeJaminanId: 'BPJS',
      tipeJaminanName: 'BPJS',
      noPeserta: '000123456',
    })
    reg.selectService({
      poli: { id: 'PO1', name: 'Poli Jantung' },
      dokter: { id: 'DP1', name: 'Dr. X' },
      jadwal: { jadwalId: 'J1', ppaId: 'DP1', jamPraktek: '08:00', sisaKuota: 5 },
    })
    await reg.confirmWalkin()
  }

  function warnSpy() {
    return vi.spyOn(console, 'warn').mockImplementation(() => {})
  }

  function uploadIdentityLogLines(warn: ReturnType<typeof warnSpy>): string[] {
    return warn.mock.calls
      .map((call) => String(call[0]))
      .filter((line) => line.includes(UPLOAD_IDENTITY_INVALID_LOG_PREFIX))
  }

  const invalidIdentities: Array<[string, () => Promise<ResponseUploadSep>]> = [
    ['placeholder', async () => ({ sepId: 'sep-upload', sepNo: '-' }) as ResponseUploadSep],
    [
      'padded-placeholder',
      async () => ({ sepId: 'sep-upload', sepNo: '  -  ' }) as ResponseUploadSep,
    ],
    ['blank', async () => ({ sepId: 'sep-upload', sepNo: '   ' }) as ResponseUploadSep],
    ['empty', async () => ({ sepId: 'sep-upload', sepNo: '' }) as ResponseUploadSep],
    ['missing', async () => ({ sepId: 'sep-upload' }) as unknown as ResponseUploadSep],
  ]

  for (const [name, upload] of invalidIdentities) {
    it(`routes an ${name} upload number to admisi fallback without calling eligibility`, async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const deps = makeDeps({
        // The create result carries a real number so a create-identity
        // substitution would be observable; the guard must ignore it.
        createSep: vi.fn(async () => ({
          sepId: 'sep-create',
          sepNo: '0112CREATE',
          noPeserta: '123',
          namaPeserta: 'A',
        })),
        uploadSep: vi.fn(upload),
      })
      const reg = useKioskRegistration(deps)
      await reachBookingRegister(reg)

      expect(deps.createSep).toHaveBeenCalledTimes(1)
      expect(deps.uploadSep).toHaveBeenCalledTimes(1)
      expect(deps.setDataEligibility).not.toHaveBeenCalled()
      expect(deps.printRegistration).not.toHaveBeenCalled()
      expect(reg.flow.value).toBe('FAILURE')
      expect(reg.postRegistrationPhase.value).toBe('ADMISI_FALLBACK')
      expect(reg.registrationResult.value?.regId).toBe('R1')
      expect(reg.errorContext.value?.message).toContain('Pendaftaran berhasil (R1)')
      const lines = uploadIdentityLogLines(warn)
      expect(lines).toHaveLength(1)
      expect(lines[0]).toContain('regId=R1')
      expect(lines[0]).not.toContain('0112CREATE')
      warn.mockRestore()
    })
  }

  it('routes the invalid identity to the configured admisi fallback intake', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const deps = makeDeps({
      uploadSep: vi.fn(async () => ({ sepId: 'sep-upload', sepNo: '-' }) as ResponseUploadSep),
    })
    const reg = useKioskRegistration(deps)
    await reachBookingRegister(reg)
    expect(reg.postRegistrationPhase.value).toBe('ADMISI_FALLBACK')

    await reg.confirmAssistance('ADMISI')

    expect(reg.flow.value).toBe('ASSISTANCE_QUEUE')
    expect(deps.bookingAssistance).toHaveBeenCalledWith(
      expect.objectContaining({ bookingId: 'BK1', servicePointId: 'ADMISI' }),
    )
    expect(deps.printQueueTicket).toHaveBeenCalledWith(
      expect.anything(),
      'ADMISI',
      expect.objectContaining({ regId: 'R1', instruction: ADMISI_FALLBACK_NOTICE_TEXT }),
    )
    expect(reg.registrationResult.value?.regId).toBe('R1')
    warn.mockRestore()
  })

  it('keeps a string business-error upload out of the identity guard and eligibility', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const deps = makeDeps({
      uploadSep: vi.fn(async () => 'Upload SEP ditolak' as ResponseUploadSep),
    })
    const reg = useKioskRegistration(deps)
    await reachBookingRegister(reg)

    expect(deps.uploadSep).toHaveBeenCalledTimes(3)
    expect(deps.setDataEligibility).not.toHaveBeenCalled()
    expect(reg.flow.value).toBe('FAILURE')
    expect(reg.postRegistrationPhase.value).toBe('ADMISI_FALLBACK')
    expect(reg.registrationResult.value?.regId).toBe('R1')
    expect(uploadIdentityLogLines(warn)).toHaveLength(0)
    warn.mockRestore()
  })

  it('applies the same guard to the walk-in flow', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const deps = makeDeps({
      searchBooking: vi.fn(async () => []),
      searchPatientContext: vi.fn(async () => contextResponse),
      uploadSep: vi.fn(async () => ({ sepId: 'sep-upload', sepNo: '-' }) as ResponseUploadSep),
      verifyBiometric: vi.fn(async () => ({ outcome: 'SUCCESS' as const })),
    })
    const reg = useKioskRegistration(deps)
    await reachWalkinRegister(reg)

    expect(deps.registerWalkin).toHaveBeenCalledTimes(1)
    expect(deps.createSep).toHaveBeenCalledTimes(1)
    expect(deps.uploadSep).toHaveBeenCalledTimes(1)
    expect(deps.setDataEligibility).not.toHaveBeenCalled()
    expect(reg.flow.value).toBe('FAILURE')
    expect(reg.postRegistrationPhase.value).toBe('ADMISI_FALLBACK')
    expect(reg.registrationResult.value?.regId).toBe('R2')
    expect(reg.errorContext.value?.message).toContain('Pendaftaran berhasil (R2)')
    const lines = uploadIdentityLogLines(warn)
    expect(lines).toHaveLength(1)
    expect(lines[0]).toContain('regId=R2')
    warn.mockRestore()
  })

  it('sends and prints the upload number when the create number differs', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const deps = makeDeps({
      createSep: vi.fn(async () => ({
        sepId: 'sep-create',
        sepNo: '0112CREATE',
        noPeserta: '123',
        namaPeserta: 'A',
      })),
      uploadSep: vi.fn(async () => ({
        sepId: 'sep-upload',
        sepNo: '0112UPLOAD',
        noPeserta: '123',
        namaPeserta: 'A',
      })),
    })
    const reg = useKioskRegistration(deps)
    await reachBookingRegister(reg)

    expect(deps.setDataEligibility).toHaveBeenCalledTimes(1)
    expect(deps.setDataEligibility).toHaveBeenCalledWith({
      regId: 'R1',
      sjpNo: '0112UPLOAD',
      pesertaJaminanId: '000123456',
      sjpId: 'sep-upload',
    })
    expect(reg.postRegistrationPhase.value).toBe('ELIGIBILITY_RECORDED')
    expect(reg.flow.value).toBe('REGISTRATION_SUCCESS')
    expect(deps.printRegistration).toHaveBeenCalledWith(
      expect.objectContaining({ noSep: '0112UPLOAD' }),
    )
    expect(uploadIdentityLogLines(warn)).toHaveLength(0)
    warn.mockRestore()
  })

  it('sends and prints the upload number for a valid number padded with whitespace', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const deps = makeDeps({
      uploadSep: vi.fn(async () => ({ sepId: 'sep-upload', sepNo: ' 0112R ' })),
    })
    const reg = useKioskRegistration(deps)
    await reachBookingRegister(reg)

    expect(deps.setDataEligibility).toHaveBeenCalledTimes(1)
    expect(reg.postRegistrationPhase.value).toBe('ELIGIBILITY_RECORDED')
    expect(uploadIdentityLogLines(warn)).toHaveLength(0)
    warn.mockRestore()
  })
})

describe('useKioskRegistration P3-S07 recovery print output', () => {
  async function reachBookingRegister(reg: ReturnType<typeof useKioskRegistration>) {
    await reg.submitBookingKeyword('BK1')
    await reg.confirmBooking()
  }

  it('prints the admisi fallback notice with the preserved regId after exhausted booking recovery', async () => {
    const deps = makeDeps({
      uploadSep: vi.fn(async () => {
        throw new Error('upload down')
      }),
    })
    const reg = useKioskRegistration(deps)
    await reachBookingRegister(reg)
    expect(reg.postRegistrationPhase.value).toBe('ADMISI_FALLBACK')

    await reg.confirmAssistance('ADMISI')

    expect(deps.printQueueTicket).toHaveBeenCalledWith(
      expect.objectContaining({ queueLabel: 'B-001' }),
      'ADMISI',
      expect.objectContaining({
        regId: 'R1',
        instruction: ADMISI_FALLBACK_NOTICE_TEXT,
      }),
    )
    expect(deps.printRegistration).not.toHaveBeenCalled()
    expect(reg.registrationResult.value?.regId).toBe('R1')
  })

  it('prints the admisi fallback notice for a walk-in post-registration recovery', async () => {
    const deps = makeDeps({
      searchBooking: vi.fn(async () => []),
      searchPatientContext: vi.fn(async () => contextResponse),
      uploadSep: vi.fn(async () => {
        throw new Error('upload down')
      }),
      verifyBiometric: vi.fn(async () => ({ outcome: 'SUCCESS' as const })),
    })
    const reg = useKioskRegistration(deps)
    await reg.submitBookingKeyword('Budi')
    await reg.confirmPatientContext(contextItem)
    await reg.selectWalkinGuarantee({
      tipeJaminanId: 'BPJS',
      tipeJaminanName: 'BPJS',
      noPeserta: '000123456',
    })
    reg.selectService({
      poli: { id: 'PO1', name: 'Poli Jantung' },
      dokter: { id: 'DP1', name: 'Dr. X' },
      jadwal: { jadwalId: 'J1', ppaId: 'DP1', jamPraktek: '08:00', sisaKuota: 5 },
    })
    await reg.confirmWalkin()
    expect(reg.postRegistrationPhase.value).toBe('ADMISI_FALLBACK')

    await reg.confirmAssistance('ADMISI')

    expect(deps.printQueueTicket).toHaveBeenCalledWith(
      expect.objectContaining({ queueLabel: 'A0002' }),
      'ADMISI',
      expect.objectContaining({ regId: 'R2' }),
    )
    expect(deps.printQueueTicket).toHaveBeenCalledTimes(1)
  })

  it('keeps queue-ticket printing unchanged for a normal assistance failure without a notice', async () => {
    const deps = makeDeps({
      getBookingDetail: vi.fn(async () => umumDetail),
      registerBooking: vi.fn(async () => {
        throw new Error('boom')
      }),
    })
    const reg = useKioskRegistration(deps)
    await reg.submitBookingKeyword('BK1')
    await reg.confirmBooking()
    expect(reg.postRegistrationPhase.value).toBeNull()

    await reg.confirmAssistance('REG')

    expect(deps.printQueueTicket).toHaveBeenCalledWith(expect.anything(), 'REG', undefined)
  })

  it('prints the normal SEP registration receipt unchanged when SEP processing succeeds', async () => {
    const deps = makeDeps()
    const reg = useKioskRegistration(deps)
    await reachBookingRegister(reg)

    expect(reg.flow.value).toBe('REGISTRATION_SUCCESS')
    expect(deps.printRegistration).toHaveBeenCalledWith(
      expect.objectContaining({
        result: expect.objectContaining({ regId: 'R1' }),
        noSep: '0112R',
      }),
    )
    expect(deps.printQueueTicket).not.toHaveBeenCalled()
  })
})
