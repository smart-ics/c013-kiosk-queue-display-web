import { ref, type Ref } from 'vue'
import type {
  AdmissionQueueIntakeResponse,
  BookingAssistanceBody,
  BookingDetail,
  BookingSearchItem,
  GroupJaminanMap,
  KarcisItem,
  PasienSearchItem,
  PatientContextItem,
  PatientContextSearchResponse,
  Polis,
  ReturnCreateWalkIn,
  RujukanSkpdResponse,
  ServiceSelection,
  PayloadDirectRegisterRajalByBooking,
  PayloadDirectRegisterRajalWalkIn,
  PayloadSetDataEligibility,
  ResponseCreateSep,
  ResponseUploadSep,
  SepCreateBody,
  SepUploadBody,
} from '@aq/shared-types'
import type { AppConfig } from '@aq/app-config'
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



export type KioskRegistrationDeps = {
  stationId: Ref<string>
  getBusinessDate: () => Promise<string>
  searchBooking: (tglBerobat: string, keyword: string) => Promise<BookingSearchItem[]>
  getBookingDetail: (bookingId: string) => Promise<BookingDetail>
  listPolis: (pasienId: string) => Promise<Polis[]>
  getGroupJaminanMap: (tipeJaminanId: string) => Promise<GroupJaminanMap | null>
  searchPatientContext: (body: {
    keyword: string
    businessDate: string
  }) => Promise<PatientContextSearchResponse>
  appConfig: AppConfig
  verifyBiometric: () => Promise<BiometricVerdict>
  listKarcis: (layananId: string) => Promise<KarcisItem[]>
  getRujukanSkpd: (noPeserta: string) => Promise<RujukanSkpdResponse>
  registerBooking: (ctx: PayloadDirectRegisterRajalByBooking) => Promise<ReturnCreateWalkIn>
  registerWalkin: (ctx: PayloadDirectRegisterRajalWalkIn) => Promise<ReturnCreateWalkIn>
  createSep: (body: SepCreateBody) => Promise<ResponseCreateSep>
  uploadSep: (body: SepUploadBody) => Promise<ResponseUploadSep>
  setDataEligibility: (body: PayloadSetDataEligibility) => Promise<string>
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

function calculateAge(birthDateStr: string, refDateStr: string): number {
  const birthDate = new Date(birthDateStr)
  const refDate = new Date(refDateStr)
  let age = refDate.getFullYear() - birthDate.getFullYear()
  const m = refDate.getMonth() - birthDate.getMonth()
  if (m < 0 || (m === 0 && refDate.getDate() < birthDate.getDate())) {
    age--
  }
  return age
}

function resolveDefaultKarcisId(
  appConfig: AppConfig,
  tipeJaminanId: string,
  layananId: string,
): string {
  if (appConfig.mappingJmnLayananKarcis) {
    const match = appConfig.mappingJmnLayananKarcis.find(
      (m) => m.tipeJaminanId === tipeJaminanId && m.layananId === layananId
    )
    if (match) return match.karcisId
  }
  if (appConfig.mappingLayananKarcis) {
    const match = appConfig.mappingLayananKarcis.find(
      (m) => m.layananId === layananId
    )
    if (match) return match.karcisId
  }
  return appConfig.kioskDefaultKarcisId ?? ''
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
  const activeBpjsContext = ref<{ noRujukan: string; kelasRawatId: string; diagnosaId: string } | null>(null)

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
    activeBpjsContext.value = null
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

  function submitBookingKeyword(keyword: string): Promise<void> {
    touch()
    const trimmed = keyword.trim()
    if (!trimmed) return Promise.resolve()
    const decoded = getKodeBookingMjkn(trimmed)
    mode.value = 'booking'
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
        if (!item.patientId) {
          throw new Error('Data Rekam Medis pasien ini tidak valid (Patient ID kosong).')
        }
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
    return withSubmit(async () => {
      try {
        const eligibility = bookingEligibility.value
        if (eligibility?.needsEligibility) {
          await handleBpjsVerificationAndRegistration('booking', eligibility)
        } else {
          await register('booking')
        }
      } catch (error) {
        setFailure(mapErrorToFailureCode(error), messageFromError(error))
      }
    })
  }

  async function handleBpjsVerificationAndRegistration(
    currentMode: FlowMode,
    eligibility: EligibilityStatus,
  ): Promise<void> {
    const noPeserta = currentMode === 'booking'
      ? eligibility.noPeserta
      : (eligibility.noPeserta || walkinNoPeserta.value)
    if (!noPeserta) {
      throw new Error('Nomor kartu BPJS tidak ditemukan.')
    }

    const res = await deps.getRujukanSkpd(noPeserta)
    const rujukan = res.rujukan as Record<string, any> | null
    let extracted: { noRujukan: string; kelasRawatId: string; diagnosaId: string; tglLahir: string } | null = null

    if (rujukan && rujukan.noRujukan) {
      extracted = {
        noRujukan: rujukan.noRujukan as string,
        kelasRawatId: res.peserta.hakKelas.kode,
        diagnosaId: (rujukan.diagnosa?.kode || 'Z00.0') as string,
        tglLahir: res.peserta.tglLahir,
      }
    } else {
      const skdp = res.listSkdp && res.listSkdp[0] as Record<string, any> | null
      if (skdp && skdp.noSkdp) {
        extracted = {
          noRujukan: skdp.noSkdp as string,
          kelasRawatId: res.peserta.hakKelas.kode,
          diagnosaId: (skdp.diagnosa?.kode || 'Z00.0') as string,
          tglLahir: res.peserta.tglLahir,
        }
      }
    }

    if (!extracted) {
      throw new Error('Rujukan atau SKDP BPJS tidak aktif/tidak ditemukan. Silakan ambil antrian pendaftaran manual.')
    }

    activeBpjsContext.value = {
      noRujukan: extracted.noRujukan,
      kelasRawatId: extracted.kelasRawatId,
      diagnosaId: extracted.diagnosaId,
    }

    const currentBusinessDate = businessDate.value || await ensureBusinessDate()
    const age = calculateAge(extracted.tglLahir, currentBusinessDate)

    if (age < 17) {
      await register(currentMode)
    } else {
      transition('BIOMETRIC_VERIFY')
      await runBiometric(currentMode)
    }
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

      const eligibility = currentMode === 'booking' ? bookingEligibility.value : walkinEligibility.value
      if (eligibility?.tipeJaminanId !== '00000' && eligibility?.needsEligibility) {
        const patientId = currentMode === 'booking' ? bookingDetail.value!.reg.pasienId : selectedPatient.value!.pasienId
        const noPeserta = eligibility.noPeserta ?? ""
        const sepPayload: SepCreateBody = {
          sepId: "",
          noPeserta,
          sepDate: businessDate.value ?? "",
          noRujukan: activeBpjsContext.value?.noRujukan || (currentMode === 'booking' ? (bookingDetail.value?.extAppRef?.reffId ?? "") : ""),
          pasienId: patientId,
          kelasRawatId: activeBpjsContext.value?.kelasRawatId || "3",
          tujuanKunjunganId: "0",
          flagProcedureId: "",
          assesmentPelayananId: "",
          penunjangId: "",
          katarak: "0",
          catatan: "Kiosk Self Registration",
          kll: "0",
          tglKLL: "",
          noLaporanPolisi: "",
          keteranganKLL: "",
          propIdKll: "",
          kabIdKll: "",
          kecIdKll: "",
          diagnosaId: activeBpjsContext.value?.diagnosaId || "Z00.0",
          userId: KIOSK_USER_ID
        }
        
        const sepRes = await deps.createSep(sepPayload)
        if (typeof sepRes === 'string') {
          throw new Error(`Gagal membuat SEP: ${sepRes}`)
        }
        await deps.uploadSep({ sepId: sepRes.sepId, regId: result.regId })
        await deps.setDataEligibility({
          regId: result.regId,
          sjpNo: sepRes.sepNo,
          pesertaJaminanId: noPeserta,
          sjpId: sepRes.sepId
        })
      }

      transition('REGISTRATION_SUCCESS')
      await deps
        .printRegistration(buildPrintContext(currentMode))
        .catch(() => ({ printed: false }))
    } catch (error) {
      setFailure(mapErrorToFailureCode(error), messageFromError(error))
    }
  }

  async function registerBookingCommit(): Promise<ReturnCreateWalkIn> {
    const detail = bookingDetail.value
    if (!detail) throw new Error('Booking detail missing')
    
    const tipeJaminan = bookingEligibility.value?.tipeJaminanId ?? '00000'
    const isBpjs = tipeJaminan !== '00000'
    const noPeserta = bookingEligibility.value?.noPeserta ?? ""

    const resolvedKarcis = resolveDefaultKarcisId(deps.appConfig, tipeJaminan, detail.layanan.layananId)
    const karcisList = await deps.listKarcis(detail.layanan.layananId)
    const found = karcisList.find((k) => k.id === resolvedKarcis)
    if (!found) {
      throw new Error(`Karcis dengan ID '${resolvedKarcis}' tidak aktif untuk poliklinik ini. Hubungi petugas.`)
    }

    return deps.registerBooking({
      bookingId: detail.bookingId,
      userId: KIOSK_USER_ID,
      karcisId: resolvedKarcis,
      caraMasukDkId: isBpjs ? '1' : '8',
      rujukanId: activeBpjsContext.value?.noRujukan || detail.extAppRef?.reffId || "",
      tipeJaminanId: tipeJaminan,
      pesertaJaminanId: noPeserta,
    })
  }

  async function registerWalkinCommit(): Promise<ReturnCreateWalkIn> {
    const patient = selectedPatient.value
    const service = selectedService.value
    if (!patient || !service) throw new Error('Walk-in selection incomplete')

    const tipeJaminan = walkinEligibility.value?.tipeJaminanId ?? '00000'
    const isBpjs = tipeJaminan !== '00000'
    const noPeserta = walkinNoPeserta.value || walkinEligibility.value?.noPeserta || ""
    const jamPraktek = service.jadwal.jamPraktek.substring(0, 5)

    const resolvedKarcis = resolveDefaultKarcisId(deps.appConfig, tipeJaminan, service.poli.id)
    const karcisList = await deps.listKarcis(service.poli.id)
    const found = karcisList.find((k) => k.id === resolvedKarcis)
    if (!found) {
      throw new Error(`Karcis dengan ID '${resolvedKarcis}' tidak aktif untuk poliklinik ini. Hubungi petugas.`)
    }

    return deps.registerWalkin({
      pasienId: patient.pasienId,
      userId: KIOSK_USER_ID,
      tipeJaminanId: tipeJaminan,
      caraMasukDkId: isBpjs ? '1' : '8',
      rujukanId: activeBpjsContext.value?.noRujukan || "",
      dokterId: service.dokter.id,
      layananId: service.poli.id,
      jamPraktek,
      karcisId: resolvedKarcis,
      pesertaJaminanId: noPeserta,
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
    return withSubmit(async () => {
      try {
        const eligibility = walkinEligibility.value
        if (eligibility?.needsEligibility) {
          await handleBpjsVerificationAndRegistration('walkin', eligibility)
        } else {
          await register('walkin')
        }
      } catch (error) {
        setFailure(mapErrorToFailureCode(error), messageFromError(error))
      }
    })
  }

  function confirmAssistance(servicePointId: string): Promise<void> {
    touch()
    return withSubmit(async () => {
      try {
        const ticket =
          mode.value === 'booking' && errorContext.value?.code !== 'BOOKING_NOT_FOUND'
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
    goHome,
    dispose,
    submitBookingKeyword,
    confirmBooking,
    confirmPatientContext,
    cancelPatientContext,
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
