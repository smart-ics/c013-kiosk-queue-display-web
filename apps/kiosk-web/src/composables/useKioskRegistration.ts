import { ref, type Ref } from 'vue'
import type {
  AdmissionQueueIntakeResponse,
  BookingAssistanceBody,
  BookingDetail,
  BookingSearchItem,
  GroupJaminanMap,
  PasienSearchItem,
  PatientContextItem,
  PatientContextSearchResponse,
  Polis,
  ReturnCreateWalkIn,
  ServiceSelection,
} from '@aq/shared-types'
import { getKodeBookingMjkn } from '../lib/qrCodeDecoder'
import { canTransition, type KioskFlow } from '../lib/flow'
import {
  computeNeedsEligibility,
  deriveBookingJaminan,
  deriveWalkinJaminan,
  UMAT_TIPE_JAMINAN_ID,
} from '../lib/eligibility'
import {
  ASSISTANCE_RESET_MS,
  IDLE_RESET_MS,
  KIOSK_USER_ID,
  SUCCESS_RESET_MS,
} from '../lib/constants'
import { mapErrorToFailureCode, type FailureCode } from '../lib/failureCode'
import type { BiometricVerdict } from '../lib/biometric'
import type { RegistrationPrintContext, RegistrationPrintResult } from './useKioskSelfPrint'

export type FlowMode = 'booking' | 'walkin'

export type EligibilityStatus = {
  tipeJaminanId: string
  tipeJaminanName: string
  noPeserta: string | null
  needsEligibility: boolean
}

export type FailureContext = { code: FailureCode; message: string }

export type BookingRegContext = {
  bookingId: string
  pasienId: string
  tipeJaminanId: string
  noPeserta: string | null
  userId: string
}

export type WalkinRegContext = {
  pasienId: string
  poliId: string
  ppaId: string
  jadwalId: string
  tglBerobat: string
  tipeJaminanId: string
  noPeserta: string | null
  userId: string
}

export type KioskRegistrationDeps = {
  stationId: Ref<string>
  getBusinessDate: () => Promise<string>
  searchBooking: (tglBerobat: string, keyword: string) => Promise<BookingSearchItem[]>
  getBookingDetail: (bookingId: string) => Promise<BookingDetail>
  listPolis: (pasienId: string) => Promise<Polis[]>
  getGroupJaminanMap: (tipeJaminanId: string) => Promise<GroupJaminanMap | null>
  searchPasien: (keyword: string) => Promise<PasienSearchItem[]>
  searchPatientContext: (body: {
    keyword: string
    businessDate: string
  }) => Promise<PatientContextSearchResponse>
  verifyBiometric: () => Promise<BiometricVerdict>
  registerBooking: (ctx: BookingRegContext) => Promise<ReturnCreateWalkIn>
  registerWalkin: (ctx: WalkinRegContext) => Promise<ReturnCreateWalkIn>
  bookingAssistance: (body: BookingAssistanceBody) => Promise<AdmissionQueueIntakeResponse>
  intake: (servicePointId: string) => Promise<AdmissionQueueIntakeResponse>
  printRegistration: (ctx: RegistrationPrintContext) => Promise<RegistrationPrintResult>
  printQueueTicket: (
    ticket: AdmissionQueueIntakeResponse,
    servicePointName?: string,
  ) => Promise<RegistrationPrintResult>
  offeringsName?: (servicePointId: string) => string | undefined
  now?: () => number
}

function messageFromError(error: unknown): string {
  return error instanceof Error ? error.message : 'Terjadi kesalahan tak terduga.'
}

export function useKioskRegistration(deps: KioskRegistrationDeps) {
  const flow = ref<KioskFlow>('HOME')
  const mode = ref<FlowMode | null>(null)
  const submitting = ref(false)
  const businessDate = ref<string | null>(null)

  const bookingKeyword = ref('')
  const selectedBooking = ref<BookingSearchItem | null>(null)
  const bookingDetail = ref<BookingDetail | null>(null)
  const bookingEligibility = ref<EligibilityStatus | null>(null)

  const patientMatches = ref<PasienSearchItem[]>([])
  const selectedPatient = ref<PasienSearchItem | null>(null)
  const walkinEligibility = ref<EligibilityStatus | null>(null)
  const walkinNoPeserta = ref('')
  const selectedService = ref<ServiceSelection | null>(null)

  const registrationResult = ref<ReturnCreateWalkIn | null>(null)
  const assistanceTicket = ref<AdmissionQueueIntakeResponse | null>(null)
  const assistanceServicePointId = ref<string | null>(null)
  const patientContextResult = ref<PatientContextSearchResponse | null>(null)
  const selectedContextPatient = ref<PatientContextItem | null>(null)
  const errorContext = ref<FailureContext | null>(null)
  const biometricVerdict = ref<BiometricVerdict | null>(null)

  const lastActivity = ref(deps.now ? deps.now() : Date.now())
  let idleTimer: number | null = null
  let autoHomeTimer: number | null = null

  function touch() {
    lastActivity.value = deps.now ? deps.now() : Date.now()
  }

  function transition(to: KioskFlow) {
    if (!canTransition(flow.value, to)) {
      throw new Error(`Illegal transition ${flow.value} -> ${to}`)
    }
    flow.value = to
  }

  function setFailure(code: FailureCode, message: string) {
    errorContext.value = { code, message }
    transition('FAILURE')
  }

  function clearAutoHome() {
    if (autoHomeTimer !== null) {
      window.clearTimeout(autoHomeTimer)
      autoHomeTimer = null
    }
  }

  function scheduleAutoHome(ms: number) {
    clearAutoHome()
    autoHomeTimer = window.setTimeout(() => {
      goHome()
    }, ms)
  }

  function goHome() {
    clearAutoHome()
    flow.value = 'HOME'
    mode.value = null
    businessDate.value = null
    bookingKeyword.value = ''
    selectedBooking.value = null
    bookingDetail.value = null
    bookingEligibility.value = null
    patientMatches.value = []
    selectedPatient.value = null
    walkinEligibility.value = null
    walkinNoPeserta.value = ''
    selectedService.value = null
    registrationResult.value = null
    assistanceTicket.value = null
    assistanceServicePointId.value = null
    errorContext.value = null
    patientContextResult.value = null
    selectedContextPatient.value = null
    biometricVerdict.value = null
    submitting.value = false
    touch()
  }

  async function ensureBusinessDate(): Promise<string> {
    if (businessDate.value) return businessDate.value
    const date = await deps.getBusinessDate()
    businessDate.value = date
    return date
  }

  async function withSubmit(fn: () => Promise<void>): Promise<void> {
    if (submitting.value) return
    submitting.value = true
    try {
      await fn()
    } finally {
      submitting.value = false
    }
  }

  function startBookingFlow() {
    touch()
    mode.value = 'booking'
    errorContext.value = null
    transition('BOOKING_SEARCH')
  }

  function startWalkinFlow() {
    touch()
    mode.value = 'walkin'
    errorContext.value = null
    transition('WALKIN_SEARCH')
  }

  function submitBookingKeyword(keyword: string): Promise<void> {
    touch()
    const trimmed = keyword.trim()
    if (!trimmed) return Promise.resolve()
    const decoded = getKodeBookingMjkn(trimmed)
    return withSubmit(async () => {
      try {
        const tgl = await ensureBusinessDate()
        const matches = await deps.searchBooking(tgl, decoded)
        if (matches.length === 0) {
          await searchPatientContextFor(decoded)
          return
        }
        if (matches.length > 1) {
          setFailure('UNKNOWN_ERROR', 'Ditemukan lebih dari satu booking. Hubungi petugas.')
          return
        }
        const booking = matches[0]
        selectedBooking.value = booking
        const detail = await deps.getBookingDetail(booking.bookingId)
        const polisList = await deps.listPolis(detail.reg.pasienId)
        const jaminan = deriveBookingJaminan(detail, polisList)
        const group =
          jaminan.tipeJaminanId === UMAT_TIPE_JAMINAN_ID
            ? null
            : await deps.getGroupJaminanMap(jaminan.tipeJaminanId)
        bookingDetail.value = detail
        bookingEligibility.value = {
          tipeJaminanId: jaminan.tipeJaminanId,
          tipeJaminanName: jaminan.tipeJaminanName,
          noPeserta: jaminan.noPeserta,
          needsEligibility: computeNeedsEligibility(jaminan.tipeJaminanId, group),
        }
        transition('BOOKING_CONFIRM')
      } catch (error) {
        setFailure(mapErrorToFailureCode(error), messageFromError(error))
      }
    })
  }

  async function searchPatientContextFor(keyword: string): Promise<void> {
    transition('PATIENT_CONTEXT_SEARCH')
    try {
      const tgl = await ensureBusinessDate()
      const result = await deps.searchPatientContext({
        keyword,
        businessDate: tgl,
      })
      patientContextResult.value = result
      if (result.bestMatch || result.patients.total > 0) {
        transition('PATIENT_CONTEXT_CONFIRM')
      } else {
        setFailure('BOOKING_NOT_FOUND', 'Data pasien tidak ditemukan. Silakan coba lagi atau ambil antrian pendaftaran.')
      }
    } catch (error) {
      setFailure(mapErrorToFailureCode(error), messageFromError(error))
    }
  }

  function confirmPatientContext(item: PatientContextItem): Promise<void> {
    touch()
    return withSubmit(async () => {
      try {
        selectedContextPatient.value = item
        const polisList = await deps.listPolis(item.patientId)
        const jaminan = deriveWalkinJaminan(polisList)
        const group =
          jaminan.tipeJaminanId === UMAT_TIPE_JAMINAN_ID
            ? null
            : await deps.getGroupJaminanMap(jaminan.tipeJaminanId)
        selectedPatient.value = {
          pasienId: item.patientId,
          pasienName: item.patientName,
          nik: item.maskedNik,
          noMR: item.id,
          tglLahir: item.birthDate,
        }
        walkinEligibility.value = {
          tipeJaminanId: jaminan.tipeJaminanId,
          tipeJaminanName: jaminan.tipeJaminanName,
          noPeserta: jaminan.noPeserta,
          needsEligibility: computeNeedsEligibility(jaminan.tipeJaminanId, group),
        }
        walkinNoPeserta.value = ''
        mode.value = 'walkin'
        transition('WALKIN_SELECT_SERVICE')
      } catch (error) {
        setFailure(mapErrorToFailureCode(error), messageFromError(error))
      }
    })
  }

  function cancelPatientContext() {
    touch()
    patientContextResult.value = null
    selectedContextPatient.value = null
    goHome()
  }

  function confirmBooking(): Promise<void> {
    touch()
    if (submitting.value) return Promise.resolve()
    if (bookingEligibility.value?.needsEligibility) {
      transition('BIOMETRIC_VERIFY')
      return withSubmit(() => runBiometric('booking'))
    }
    return withSubmit(() => register('booking'))
  }

  async function runBiometric(currentMode: FlowMode): Promise<void> {
    biometricVerdict.value = null
    try {
      const verdict = await deps.verifyBiometric()
      biometricVerdict.value = verdict
      if (verdict.outcome === 'SUCCESS' || verdict.outcome === 'READY') {
        await register(currentMode)
      } else if (verdict.outcome === 'TIMEOUT') {
        setFailure('BIOMETRIC_TIMEOUT', 'Verifikasi biometrik melewati batas waktu.')
      } else {
        setFailure('BIOMETRIC_FAILED', 'Verifikasi biometrik gagal.')
      }
    } catch (error) {
      setFailure('BACKEND_ERROR', messageFromError(error))
    }
  }

  async function register(currentMode: FlowMode): Promise<void> {
    try {
      const result =
        currentMode === 'booking'
          ? await registerBookingCommit()
          : await registerWalkinCommit()
      registrationResult.value = result
      transition('REGISTRATION_SUCCESS')
      const printed = await deps
        .printRegistration(buildPrintContext(currentMode))
        .catch(() => ({ printed: false }))
      if (printed.printed) scheduleAutoHome(SUCCESS_RESET_MS)
    } catch (error) {
      setFailure(mapErrorToFailureCode(error), messageFromError(error))
    }
  }

  async function registerBookingCommit(): Promise<ReturnCreateWalkIn> {
    const detail = bookingDetail.value
    if (!detail) throw new Error('Booking detail missing')
    return deps.registerBooking({
      bookingId: detail.bookingId,
      pasienId: detail.reg.pasienId,
      tipeJaminanId: bookingEligibility.value?.tipeJaminanId ?? '00000',
      noPeserta: bookingEligibility.value?.noPeserta ?? null,
      userId: KIOSK_USER_ID,
    })
  }

  async function registerWalkinCommit(): Promise<ReturnCreateWalkIn> {
    const patient = selectedPatient.value
    const service = selectedService.value
    if (!patient || !service) throw new Error('Walk-in selection incomplete')
    return deps.registerWalkin({
      pasienId: patient.pasienId,
      poliId: service.poli.id,
      ppaId: service.dokter.id,
      jadwalId: service.jadwal.jadwalId,
      tglBerobat: businessDate.value ?? '',
      tipeJaminanId: walkinEligibility.value?.tipeJaminanId ?? '00000',
      noPeserta: walkinNoPeserta.value || walkinEligibility.value?.noPeserta || null,
      userId: KIOSK_USER_ID,
    })
  }

  function buildPrintContext(currentMode: FlowMode): RegistrationPrintContext {
    const result = registrationResult.value
    if (!result) throw new Error('Registration result missing')
    return {
      result,
      pasienName:
        currentMode === 'booking'
          ? bookingDetail.value?.reg.pasienName ?? ''
          : selectedPatient.value?.pasienName ?? '',
      serviceName:
        currentMode === 'booking'
          ? bookingDetail.value?.layanan.layananName
          : selectedService.value?.poli.name,
      dokterName:
        currentMode === 'booking'
          ? bookingDetail.value?.dokter.ppaName
          : selectedService.value?.dokter.name,
    }
  }

  function searchWalkinPatient(keyword: string): Promise<void> {
    touch()
    const trimmed = keyword.trim()
    if (!trimmed) return Promise.resolve()
    return withSubmit(async () => {
      try {
        await ensureBusinessDate()
        const matches = await deps.searchPasien(trimmed)
        if (matches.length === 0) {
          setFailure('BOOKING_NOT_FOUND', 'Pasien tidak ditemukan untuk keyword tersebut.')
          return
        }
        patientMatches.value = matches
        transition('WALKIN_SELECT_PATIENT')
      } catch (error) {
        setFailure(mapErrorToFailureCode(error), messageFromError(error))
      }
    })
  }

  function selectPatient(patient: PasienSearchItem): Promise<void> {
    touch()
    return withSubmit(async () => {
      try {
        const polisList = await deps.listPolis(patient.pasienId)
        const jaminan = deriveWalkinJaminan(polisList)
        const group =
          jaminan.tipeJaminanId === UMAT_TIPE_JAMINAN_ID
            ? null
            : await deps.getGroupJaminanMap(jaminan.tipeJaminanId)
        selectedPatient.value = patient
        walkinEligibility.value = {
          tipeJaminanId: jaminan.tipeJaminanId,
          tipeJaminanName: jaminan.tipeJaminanName,
          noPeserta: jaminan.noPeserta,
          needsEligibility: computeNeedsEligibility(jaminan.tipeJaminanId, group),
        }
        walkinNoPeserta.value = ''
        transition('WALKIN_SELECT_SERVICE')
      } catch (error) {
        setFailure(mapErrorToFailureCode(error), messageFromError(error))
      }
    })
  }

  function selectService(service: ServiceSelection) {
    touch()
    selectedService.value = service
    transition('WALKIN_CONFIRM')
  }

  function setWalkinNoPeserta(value: string) {
    walkinNoPeserta.value = value.trim()
  }

  function confirmWalkin(): Promise<void> {
    touch()
    if (submitting.value) return Promise.resolve()
    if (walkinEligibility.value?.needsEligibility) {
      transition('BIOMETRIC_VERIFY')
      return withSubmit(() => runBiometric('walkin'))
    }
    return withSubmit(() => register('walkin'))
  }

  function confirmAssistance(servicePointId: string): Promise<void> {
    touch()
    return withSubmit(async () => {
      try {
        const ticket =
          mode.value === 'booking'
            ? await deps.bookingAssistance({
                bookingId: selectedBooking.value?.bookingId,
                servicePointId,
                kioskId: deps.stationId.value,
                userId: KIOSK_USER_ID,
              })
            : await deps.intake(servicePointId)
        assistanceTicket.value = ticket
        assistanceServicePointId.value = servicePointId
        transition('ASSISTANCE_QUEUE')
        const printed = await deps.printQueueTicket(
          ticket,
          deps.offeringsName?.(servicePointId),
        )
        if (printed.printed) scheduleAutoHome(ASSISTANCE_RESET_MS)
      } catch (error) {
        errorContext.value = {
          code: mapErrorToFailureCode(error),
          message: messageFromError(error),
        }
      }
    })
  }

  async function reprintRegistration() {
    if (!registrationResult.value) return
    await deps.printRegistration(buildPrintContext(mode.value ?? 'booking'))
  }

  async function reprintQueueTicket() {
    if (!assistanceTicket.value) return
    await deps.printQueueTicket(
      assistanceTicket.value,
      deps.offeringsName?.(assistanceServicePointId.value ?? ''),
    )
  }

  function startIdleReset() {
    stopIdleReset()
    idleTimer = window.setInterval(() => {
      const now = deps.now ? deps.now() : Date.now()
      if (flow.value !== 'HOME' && now - lastActivity.value > IDLE_RESET_MS) {
        goHome()
      }
    }, 1000)
  }

  function stopIdleReset() {
    if (idleTimer !== null) {
      window.clearInterval(idleTimer)
      idleTimer = null
    }
  }

  function dispose() {
    stopIdleReset()
    clearAutoHome()
  }

  return {
    flow,
    mode,
    submitting,
    businessDate,
    bookingKeyword,
    selectedBooking,
    bookingDetail,
    bookingEligibility,
    patientMatches,
    selectedPatient,
    walkinEligibility,
    walkinNoPeserta,
    selectedService,
    registrationResult,
    assistanceTicket,
    assistanceServicePointId,
    patientContextResult,
    selectedContextPatient,
    errorContext,
    biometricVerdict,
    startBookingFlow,
    startWalkinFlow,
    goHome,
    dispose,
    submitBookingKeyword,
    confirmBooking,
    confirmPatientContext,
    cancelPatientContext,
    searchWalkinPatient,
    selectPatient,
    selectService,
    setWalkinNoPeserta,
    confirmWalkin,
    confirmAssistance,
    reprintRegistration,
    reprintQueueTicket,
    startIdleReset,
    stopIdleReset,
  }
}
