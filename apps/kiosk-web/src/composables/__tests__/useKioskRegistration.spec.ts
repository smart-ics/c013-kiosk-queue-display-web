import { afterEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { ApiClientError } from '@aq/api-client'
import type {
  BookingDetail,
  BookingSearchItem,
  GroupJaminanMap,
  PasienSearchItem,
  Polis,
} from '@aq/shared-types'
import { useKioskRegistration, type KioskRegistrationDeps } from '../useKioskRegistration'

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

const group: GroupJaminanMap = { tipeJaminanId: 'BPJS', groupJaminanId: 'G1', groupJaminanName: 'BPJS' }
const pasien: PasienSearchItem = { pasienId: 'PT1', pasienName: 'Andi' }

function makeDeps(overrides: Partial<KioskRegistrationDeps> = {}): KioskRegistrationDeps {
  return {
    stationId: ref('K01'),
    getBusinessDate: vi.fn(async () => '2026-08-03'),
    searchBooking: vi.fn(async () => [bookingItem]),
    getBookingDetail: vi.fn(async () => bpjsDetail),
    listPolis: vi.fn(async () => [bpjsPolis]),
    getGroupJaminanMap: vi.fn(async () => group),
    searchPasien: vi.fn(async () => [pasien]),
    verifyBiometric: vi.fn(async () => ({ outcome: 'SUCCESS' as const })),
    registerBooking: vi.fn(async () => ({ regId: 'R1', noAntrian: 12 })),
    registerWalkin: vi.fn(async () => ({ regId: 'R2', noAntrian: 13 })),
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
    offeringsName: (id) => id,
    now: () => 1000,
    ...overrides,
  }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('useKioskRegistration booking flow', () => {
  it('routes booking-not-found straight to failure', async () => {
    const reg = useKioskRegistration(makeDeps({ searchBooking: vi.fn(async () => []) }))
    reg.startBookingFlow()
    await reg.submitBookingKeyword('NOPE')
    expect(reg.flow.value).toBe('FAILURE')
    expect(reg.errorContext.value?.code).toBe('BOOKING_NOT_FOUND')
  })

  it('shows confirm with needsEligibility for BPJS booking', async () => {
    const reg = useKioskRegistration(makeDeps())
    reg.startBookingFlow()
    await reg.submitBookingKeyword('BK1')
    expect(reg.flow.value).toBe('BOOKING_CONFIRM')
    expect(reg.bookingEligibility.value?.needsEligibility).toBe(true)
  })

  it('registers a non-BPJS booking to success', async () => {
    const deps = makeDeps({ getBookingDetail: vi.fn(async () => umumDetail) })
    const reg = useKioskRegistration(deps)
    reg.startBookingFlow()
    await reg.submitBookingKeyword('BK1')
    await reg.confirmBooking()
    expect(reg.flow.value).toBe('REGISTRATION_SUCCESS')
    expect(reg.registrationResult.value?.noAntrian).toBe(12)
    expect(deps.registerBooking).toHaveBeenCalledWith({
      bookingId: 'BK1',
      pasienId: 'PT1',
      tipeJaminanId: '00000',
      noPeserta: null,
      userId: 'hidokkiosk',
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
    reg.startBookingFlow()
    await reg.submitBookingKeyword('BK1')
    await reg.confirmBooking()
    expect(deps.verifyBiometric).toHaveBeenCalledTimes(1)
    expect(deps.registerBooking).toHaveBeenCalledTimes(1)
    expect(reg.flow.value).toBe('REGISTRATION_SUCCESS')
  })

  it('maps biometric timeout to failure', async () => {
    const deps = makeDeps({ verifyBiometric: vi.fn(async () => ({ outcome: 'TIMEOUT' as const })) })
    const reg = useKioskRegistration(deps)
    reg.startBookingFlow()
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
    reg.startBookingFlow()
    await reg.submitBookingKeyword('BK1')
    expect(reg.flow.value).toBe('FAILURE')
    expect(reg.errorContext.value?.code).toBe('BACKEND_ERROR')
  })

  it('skips the jaminan group lookup for an Umum booking', async () => {
    const deps = makeDeps({ getBookingDetail: vi.fn(async () => umumDetail) })
    const reg = useKioskRegistration(deps)
    reg.startBookingFlow()
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
    reg.startBookingFlow()
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
    reg.startBookingFlow()
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

describe('useKioskRegistration walk-in flow', () => {
  it('always shows the patient picker even for a single match', async () => {
    const reg = useKioskRegistration(makeDeps())
    reg.startWalkinFlow()
    await reg.searchWalkinPatient('ANDI')
    expect(reg.flow.value).toBe('WALKIN_SELECT_PATIENT')
    expect(reg.patientMatches.value).toHaveLength(1)
  })

  it('routes a walk-in patient search rejection to failure', async () => {
    const deps = makeDeps({
      searchPasien: vi.fn(async () => {
        throw new ApiClientError('Failed to fetch', 0)
      }),
    })
    const reg = useKioskRegistration(deps)
    reg.startWalkinFlow()
    await reg.searchWalkinPatient('ANDI')
    expect(reg.flow.value).toBe('FAILURE')
    expect(reg.errorContext.value?.code).toBe('BACKEND_ERROR')
  })

  it('routes a polis lookup rejection to failure', async () => {
    const deps = makeDeps({
      listPolis: vi.fn(async () => {
        throw new ApiClientError('Failed to fetch', 0)
      }),
    })
    const reg = useKioskRegistration(deps)
    reg.startWalkinFlow()
    await reg.searchWalkinPatient('ANDI')
    await reg.selectPatient(pasien)
    expect(reg.flow.value).toBe('FAILURE')
    expect(reg.errorContext.value?.code).toBe('BACKEND_ERROR')
  })

  it('skips the jaminan group lookup when a walk-in patient has no polis', async () => {
    const deps = makeDeps({ listPolis: vi.fn(async () => []) })
    const reg = useKioskRegistration(deps)
    reg.startWalkinFlow()
    await reg.searchWalkinPatient('ANDI')
    await reg.selectPatient(pasien)
    expect(deps.getGroupJaminanMap).not.toHaveBeenCalled()
    expect(reg.walkinEligibility.value?.needsEligibility).toBe(false)
  })

  it('walks through patient → service → confirm → register', async () => {
    const deps = makeDeps()
    const reg = useKioskRegistration(deps)
    reg.startWalkinFlow()
    await reg.searchWalkinPatient('ANDI')
    await reg.selectPatient(pasien)
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
      poliId: 'PO1',
      ppaId: 'DP1',
      jadwalId: 'J1',
      tglBerobat: '2026-08-03',
      tipeJaminanId: 'BPJS',
      noPeserta: '000123456',
      userId: 'hidokkiosk',
    })
  })

  it('falls back to intake on walk-in failure', async () => {
    const deps = makeDeps({
      listPolis: vi.fn(async () => []),
      registerWalkin: vi.fn(async () => {
        throw new Error('full')
      }),
    })
    const reg = useKioskRegistration(deps)
    reg.startWalkinFlow()
    await reg.searchWalkinPatient('ANDI')
    await reg.selectPatient(pasien)
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
    reg.startBookingFlow()
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
    reg.startBookingFlow()
    expect(reg.flow.value).toBe('BOOKING_SEARCH')
    nowMs = 2000 + 60_000
    await vi.advanceTimersByTimeAsync(1100)
    expect(reg.flow.value).toBe('HOME')
  })

  it('returns to HOME 10s after a successful registration print', async () => {
    vi.useFakeTimers()
    const deps = makeDeps({ getBookingDetail: vi.fn(async () => umumDetail) })
    const reg = useKioskRegistration(deps)
    reg.startBookingFlow()
    await reg.submitBookingKeyword('BK1')
    await reg.confirmBooking()
    expect(reg.flow.value).toBe('REGISTRATION_SUCCESS')
    await vi.advanceTimersByTimeAsync(10_100)
    expect(reg.flow.value).toBe('HOME')
  })
})
