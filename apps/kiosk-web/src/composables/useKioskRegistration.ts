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
  DeepSearchResult,
} from '@aq/shared-types'
import type { AppConfig } from '@aq/app-config'
import { getKodeBookingMjkn } from '../lib/qrCodeDecoder'
import { canTransition, type KioskFlow } from '../lib/flow'
import {
  computeNeedsEligibility,
  deriveBookingJaminan,
  UMAT_TIPE_JAMINAN_ID,
} from '../lib/eligibility'
import { IDLE_RESET_MS, KIOSK_USER_ID } from '../lib/constants'
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
  deepSearchPasien: (keyword: string) => Promise<DeepSearchResult[]>
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
    // 1. Specific match (both tipeJaminanId and layananId match exactly)
    let match = appConfig.mappingJmnLayananKarcis.find(
      (m) => m.tipeJaminanId === tipeJaminanId && m.layananId === layananId,
    )
    // 2. Wildcard match (tipeJaminanId matches, and layananId is empty, "*" or omitted)
    if (!match) {
      match = appConfig.mappingJmnLayananKarcis.find(
        (m) => m.tipeJaminanId === tipeJaminanId && (!m.layananId || m.layananId === '*'),
      )
    }
    if (match) return match.karcisId
  }
  if (appConfig.mappingLayananKarcis) {
    const match = appConfig.mappingLayananKarcis.find((m) => m.layananId === layananId)
    if (match) return match.karcisId
  }
  return appConfig.kioskDefaultKarcisId ?? ''
}

export type BpjsReference = {
  type: 'skdp' | 'rujukan'
  id: string // noSkdp or noRujukan
  date: string // tglMulai or tglRujukan
  diagnosaId: string
  diagnosaName: string
  kelasRawatId: string
  tglLahir: string
  original: any
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
  const patientPolicies = ref<Polis[]>([])
  const errorContext = ref<FailureContext | null>(null)
  const biometricVerdict = ref<BiometricVerdict | null>(null)
  const bpjsReferences = ref<BpjsReference[]>([])
  const selectedBpjsReference = ref<BpjsReference | null>(null)
  const activeBpjsContext = ref<{
    noRujukan: string
    kelasRawatId: string
    diagnosaId: string
  } | null>(null)

  const lastActivity = ref(deps.now ? deps.now() : Date.now())
  let idleTimer: number | null = null

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

  function goHome() {
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
    patientPolicies.value = []
    biometricVerdict.value = null
    bpjsReferences.value = []
    selectedBpjsReference.value = null
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
          const deepMatches = await deps.deepSearchPasien(decoded)
          if (deepMatches.length > 0) {
            const mapped = deepMatches.map((item) => ({
              kind: 'Patient' as const,
              id: item.pasienId,
              patientName: item.person.personName,
              patientId: item.pasienId,
              birthDate: item.person.tglLahir,
              gender: item.person.gender,
              locality: item.person.alamat?.kota || null,
              maskedNik: item.person.identity?.nomorId || null,
              maskedPhone: item.person.contact?.contactDetail || null,
              visitDate: null,
              visitTime: null,
              serviceName: null,
              doctorName: null,
              state: '',
              bookingId: null,
              registrationId: null,
              matchType: 'DeepSearch',
              isExactMatch: true,
              rank: 1,
              warnings: [],
            }))
            patientContextResult.value = {
              businessDate: tgl,
              bookings: { items: [], total: 0, hasMore: false },
              registrations: { items: [], total: 0, hasMore: false },
              patients: { items: mapped, total: mapped.length, hasMore: false },
              bestMatch: mapped[0] || null,
              canCreatePatient: false,
            }
            transition('PATIENT_CONTEXT_CONFIRM')
            return
          }
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

        const hasBpjsPolicy = polisList.some((p) => {
          const name = (p.tipeJaminan?.tipeJaminanName || '').toLowerCase()
          const id = (p.tipeJaminan?.tipeJaminanId || '').toLowerCase()
          return (
            name.includes('bpjs') ||
            name.includes('jkn') ||
            id.includes('bpjs') ||
            id.includes('jkn')
          )
        })
        if (detail.coverageInfo?.noPeserta && !hasBpjsPolicy) {
          setFailure(
            'BPJS_VALIDATION_FAILED',
            'Data kartu BPJS Anda belum terdaftar di rumah sakit ini. Silakan menuju Loket Pendaftaran untuk pendaftaran pertama kali.',
          )
          return
        }

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
        setFailure(
          'BOOKING_NOT_FOUND',
          'Data pasien tidak ditemukan. Silakan coba lagi atau ambil antrian pendaftaran.',
        )
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
        patientPolicies.value = polisList
        selectedPatient.value = {
          pasienId: item.patientId,
          pasienName: item.patientName,
          nik: item.maskedNik,
          noMR: item.id,
          tglLahir: item.birthDate,
        }
        mode.value = 'walkin'
        transition('WALKIN_SELECT_GUARANTEE')
      } catch (error) {
        setFailure(mapErrorToFailureCode(error), messageFromError(error))
      }
    })
  }

  function selectWalkinGuarantee(jaminan: {
    tipeJaminanId: string
    tipeJaminanName: string
    noPeserta: string | null
  }): Promise<void> {
    touch()
    return withSubmit(async () => {
      try {
        if (jaminan.tipeJaminanId === 'BPJS_FALLBACK') {
          setFailure(
            'BPJS_VALIDATION_FAILED',
            'Data kartu BPJS Anda belum terdaftar di rumah sakit ini. Silakan menuju Loket Pendaftaran untuk pendaftaran pertama kali.',
          )
          return
        }
        const group =
          jaminan.tipeJaminanId === UMAT_TIPE_JAMINAN_ID
            ? null
            : await deps.getGroupJaminanMap(jaminan.tipeJaminanId)
        const eligibility = {
          tipeJaminanId: jaminan.tipeJaminanId,
          tipeJaminanName: jaminan.tipeJaminanName,
          noPeserta: jaminan.noPeserta,
          needsEligibility: computeNeedsEligibility(jaminan.tipeJaminanId, group),
        }
        walkinEligibility.value = eligibility
        walkinNoPeserta.value = jaminan.noPeserta || ''

        if (eligibility.needsEligibility) {
          await handleBpjsVerificationAndTransitionToService(eligibility)
        } else {
          transition('WALKIN_SELECT_SERVICE')
        }
      } catch (error) {
        setFailure(mapErrorToFailureCode(error), messageFromError(error))
      }
    })
  }

  async function fetchAndParseBpjsReferences(noPeserta: string): Promise<string> {
    const res = await deps.getRujukanSkpd(noPeserta)
    const parsedRefs: BpjsReference[] = []

    if (res.listSkdp) {
      for (const skdp of res.listSkdp as any[]) {
        if (skdp.noSkdp) {
          parsedRefs.push({
            type: 'skdp',
            id: skdp.noSkdp,
            date: skdp.tglMulai || '',
            diagnosaId: skdp.diagnosa?.kode || 'Z00.0',
            diagnosaName: skdp.diagnosa?.nama || '',
            kelasRawatId: res.peserta.hakKelas.kode,
            tglLahir: res.peserta.tglLahir,
            original: skdp,
          })
        }
      }
    }

    const rujukan = res.rujukan as any
    if (rujukan && rujukan.noRujukan) {
      parsedRefs.push({
        type: 'rujukan',
        id: rujukan.noRujukan,
        date: rujukan.tglRujukan || '',
        diagnosaId: rujukan.diagnosa?.kode || 'Z00.0',
        diagnosaName: rujukan.diagnosa?.nama || '',
        kelasRawatId: res.peserta.hakKelas.kode,
        tglLahir: res.peserta.tglLahir,
        original: rujukan,
      })
    }

    if (parsedRefs.length === 0) {
      throw new Error(
        'Rujukan atau SKDP BPJS tidak aktif/tidak ditemukan. Silakan ambil antrian pendaftaran manual.',
      )
    }

    bpjsReferences.value = parsedRefs

    if (parsedRefs.length === 1) {
      selectedBpjsReference.value = parsedRefs[0]
      activeBpjsContext.value = {
        noRujukan: parsedRefs[0].id,
        kelasRawatId: parsedRefs[0].kelasRawatId,
        diagnosaId: parsedRefs[0].diagnosaId,
      }
    } else {
      selectedBpjsReference.value = null
      activeBpjsContext.value = null
    }

    return res.peserta.tglLahir
  }

  async function handleBpjsVerificationAndTransitionToService(
    eligibility: EligibilityStatus,
  ): Promise<void> {
    const noPeserta = eligibility.noPeserta || walkinNoPeserta.value
    if (!noPeserta) {
      throw new Error('Nomor kartu BPJS tidak ditemukan.')
    }

    const tglLahir = await fetchAndParseBpjsReferences(noPeserta)

    const currentBusinessDate = businessDate.value || (await ensureBusinessDate())
    const age = calculateAge(tglLahir, currentBusinessDate)

    if (age < 17) {
      if (selectedBpjsReference.value) {
        transition('WALKIN_SELECT_SERVICE')
      } else {
        transition('BPJS_SELECT_REFERENCE')
      }
    } else {
      transition('BIOMETRIC_VERIFY')
      await runBiometricForWalkin()
    }
  }

  async function runBiometricForWalkin(): Promise<void> {
    biometricVerdict.value = null
    try {
      const verdict = await deps.verifyBiometric()
      biometricVerdict.value = verdict
      if (verdict.outcome === 'SUCCESS' || verdict.outcome === 'READY') {
        if (selectedBpjsReference.value) {
          transition('WALKIN_SELECT_SERVICE')
        } else {
          transition('BPJS_SELECT_REFERENCE')
        }
      } else if (verdict.outcome === 'TIMEOUT') {
        setFailure('BIOMETRIC_TIMEOUT', 'Verifikasi biometrik melewati batas waktu.')
      } else {
        setFailure('BIOMETRIC_FAILED', 'Verifikasi biometrik gagal.')
      }
    } catch (error) {
      setFailure('BACKEND_ERROR', messageFromError(error))
    }
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
    const noPeserta =
      currentMode === 'booking'
        ? eligibility.noPeserta
        : eligibility.noPeserta || walkinNoPeserta.value
    if (!noPeserta) {
      throw new Error('Nomor kartu BPJS tidak ditemukan.')
    }

    const tglLahir = await fetchAndParseBpjsReferences(noPeserta)

    const currentBusinessDate = businessDate.value || (await ensureBusinessDate())
    const age = calculateAge(tglLahir, currentBusinessDate)

    if (age < 17) {
      if (selectedBpjsReference.value) {
        await register(currentMode)
      } else {
        transition('BPJS_SELECT_REFERENCE')
      }
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
        if (selectedBpjsReference.value) {
          await register(currentMode)
        } else {
          transition('BPJS_SELECT_REFERENCE')
        }
      } else if (verdict.outcome === 'TIMEOUT') {
        setFailure('BIOMETRIC_TIMEOUT', 'Verifikasi biometrik melewati batas waktu.')
      } else {
        setFailure('BIOMETRIC_FAILED', 'Verifikasi biometrik gagal.')
      }
    } catch (error) {
      setFailure('BACKEND_ERROR', messageFromError(error))
    }
  }

  function selectBpjsReference(ref: BpjsReference): Promise<void> {
    touch()
    selectedBpjsReference.value = ref
    activeBpjsContext.value = {
      noRujukan: ref.id,
      kelasRawatId: ref.kelasRawatId,
      diagnosaId: ref.diagnosaId,
    }

    if (mode.value === 'walkin') {
      transition('WALKIN_SELECT_SERVICE')
      return Promise.resolve()
    } else {
      return withSubmit(async () => {
        try {
          await register('booking')
        } catch (error) {
          setFailure(mapErrorToFailureCode(error), messageFromError(error))
        }
      })
    }
  }

  async function register(currentMode: FlowMode): Promise<void> {
    try {
      const result =
        currentMode === 'booking' ? await registerBookingCommit() : await registerWalkinCommit()
      registrationResult.value = result

      const eligibility =
        currentMode === 'booking' ? bookingEligibility.value : walkinEligibility.value
      if (eligibility?.tipeJaminanId !== '00000' && eligibility?.needsEligibility) {
        const patientId =
          currentMode === 'booking'
            ? bookingDetail.value!.reg.pasienId
            : selectedPatient.value!.pasienId
        const noPeserta = eligibility.noPeserta ?? ''
        const sepPayload: SepCreateBody = {
          sepId: '',
          noPeserta,
          sepDate: businessDate.value ?? '',
          noRujukan:
            activeBpjsContext.value?.noRujukan ||
            (currentMode === 'booking' ? (bookingDetail.value?.extAppRef?.reffId ?? '') : ''),
          pasienId: patientId,
          kelasRawatId: activeBpjsContext.value?.kelasRawatId || '3',
          tujuanKunjunganId: '0',
          flagProcedureId: '',
          assesmentPelayananId: '',
          penunjangId: '',
          katarak: '0',
          catatan: 'Kiosk Self Registration',
          kll: '0',
          tglKLL: '',
          noLaporanPolisi: '',
          keteranganKLL: '',
          propIdKll: '',
          kabIdKll: '',
          kecIdKll: '',
          diagnosaId: activeBpjsContext.value?.diagnosaId || 'Z00.0',
          userId: KIOSK_USER_ID,
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
          sjpId: sepRes.sepId,
        })
      }

      transition('REGISTRATION_SUCCESS')
      await deps.printRegistration(buildPrintContext(currentMode)).catch(() => ({ printed: false }))
    } catch (error) {
      setFailure(mapErrorToFailureCode(error), messageFromError(error))
    }
  }

  async function registerBookingCommit(): Promise<ReturnCreateWalkIn> {
    const detail = bookingDetail.value
    if (!detail) throw new Error('Booking detail missing')

    const tipeJaminan = bookingEligibility.value?.tipeJaminanId ?? '00000'
    const isBpjs = tipeJaminan !== '00000'
    const noPeserta = bookingEligibility.value?.noPeserta ?? ''

    const resolvedKarcis = resolveDefaultKarcisId(
      deps.appConfig,
      tipeJaminan,
      detail.layanan.layananId,
    )
    const karcisList = await deps.listKarcis(detail.layanan.layananId)
    const found = karcisList.find((k) => k.id === resolvedKarcis)
    if (!found) {
      throw new Error(
        `Karcis dengan ID '${resolvedKarcis}' tidak aktif untuk poliklinik ini. Hubungi petugas.`,
      )
    }

    return deps.registerBooking({
      bookingId: detail.bookingId,
      userId: KIOSK_USER_ID,
      karcisId: resolvedKarcis,
      caraMasukDkId: isBpjs ? '1' : '8',
      rujukanId: activeBpjsContext.value?.noRujukan || detail.extAppRef?.reffId || '',
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
    const noPeserta = walkinNoPeserta.value || walkinEligibility.value?.noPeserta || ''
    const jamPraktek = service.jadwal.jamPraktek.substring(0, 5)

    const resolvedKarcis = resolveDefaultKarcisId(deps.appConfig, tipeJaminan, service.poli.id)
    const karcisList = await deps.listKarcis(service.poli.id)
    const found = karcisList.find((k) => k.id === resolvedKarcis)
    if (!found) {
      throw new Error(
        `Karcis dengan ID '${resolvedKarcis}' tidak aktif untuk poliklinik ini. Hubungi petugas.`,
      )
    }

    return deps.registerWalkin({
      pasienId: patient.pasienId,
      userId: KIOSK_USER_ID,
      tipeJaminanId: tipeJaminan,
      caraMasukDkId: isBpjs ? '1' : '8',
      rujukanId: activeBpjsContext.value?.noRujukan || '',
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
          ? (bookingDetail.value?.reg.pasienName ?? '')
          : (selectedPatient.value?.pasienName ?? ''),
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
        await register('walkin')
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
        await deps.printQueueTicket(ticket, deps.offeringsName?.(servicePointId))
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

  function onUserActivity() {
    touch()
  }

  function startIdleReset() {
    stopIdleReset()
    if (typeof window !== 'undefined') {
      window.addEventListener('click', onUserActivity, { passive: true })
      window.addEventListener('touchstart', onUserActivity, { passive: true })
      window.addEventListener('keydown', onUserActivity, { passive: true })
    }
    idleTimer = window.setInterval(() => {
      const now = deps.now ? deps.now() : Date.now()
      if (flow.value !== 'HOME' && now - lastActivity.value > IDLE_RESET_MS) {
        goHome()
      }
    }, 1000)
  }

  function stopIdleReset() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('click', onUserActivity)
      window.removeEventListener('touchstart', onUserActivity)
      window.removeEventListener('keydown', onUserActivity)
    }
    if (idleTimer !== null) {
      window.clearInterval(idleTimer)
      idleTimer = null
    }
  }

  function dispose() {
    stopIdleReset()
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
    patientPolicies,
    errorContext,
    biometricVerdict,
    bpjsReferences,
    selectedBpjsReference,
    startBookingFlow,
    goHome,
    dispose,
    submitBookingKeyword,
    confirmBooking,
    confirmPatientContext,
    cancelPatientContext,
    selectWalkinGuarantee,
    selectService,
    selectBpjsReference,
    setWalkinNoPeserta,
    confirmWalkin,
    confirmAssistance,
    reprintRegistration,
    reprintQueueTicket,
    startIdleReset,
    stopIdleReset,
  }
}
