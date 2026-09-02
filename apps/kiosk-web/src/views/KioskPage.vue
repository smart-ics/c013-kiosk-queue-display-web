<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import type { DeviceConfig, AdmissionServicePoint } from '@aq/shared-types'
import { DeviceConfigInvalidError, DeviceConfigNotFoundError } from '@aq/device-config'
import { mapBackendErrorToUserMessage } from '@aq/api-client'
import {
  getAdmissionQueueApi,
  getDeviceConfigProvider,
  getHisApi,
  getJetliApi,
  getServiceCatalog,
} from '../infrastructure'
import { configService } from '@aq/app-config'
import { intersectOfferings } from '../lib/offerings'
import { createBiometricClient } from '../lib/biometric'
import { scanQrFromCamera } from '../lib/qrScanner'
import { useKioskIntake } from '../composables/useKioskIntake'
import { useKioskPrint } from '../composables/useKioskPrint'
import { useKioskRegistration } from '../composables/useKioskRegistration'
import { useKioskSelfPrint } from '../composables/useKioskSelfPrint'
import type { PatientContextItem } from '@aq/shared-types'
import BootErrorPage from './BootErrorPage.vue'
import KioskHome from './KioskHome.vue'
import KioskHeader from '../components/KioskHeader.vue'
import BookingSearchStep from './steps/BookingSearchStep.vue'
import BookingConfirmStep from './steps/BookingConfirmStep.vue'
import PatientContextConfirmStep from './steps/PatientContextConfirmStep.vue'
import WalkinServiceStep from './steps/WalkinServiceStep.vue'
import WalkinSelectGuaranteeStep from './steps/WalkinSelectGuaranteeStep.vue'
import BpjsSelectReferenceStep from './steps/BpjsSelectReferenceStep.vue'
import WalkinConfirmStep from './steps/WalkinConfirmStep.vue'
import BiometricStep from './steps/BiometricStep.vue'
import RegistrationSuccessStep from './steps/RegistrationSuccessStep.vue'
import FailureStep from './steps/FailureStep.vue'
import AssistanceQueueStep from './steps/AssistanceQueueStep.vue'

const props = defineProps<{
  stationId: string
}>()

const bootError = ref<string | null>(null)
const deviceConfig = ref<DeviceConfig | null>(null)
const homeMode = ref<'idle' | 'intake'>('idle')
const scanError = ref<string | null>(null)
const lang = ref<'id' | 'en'>('id')
const stationIdRef = computed(() => props.stationId)
const printerProxyPort = computed(() => deviceConfig.value?.printerProxyPort)

watch(
  () => props.stationId,
  async (rawStationId, _prev, onCleanup) => {
    let cancelled = false
    onCleanup(() => {
      cancelled = true
    })

    bootError.value = null
    deviceConfig.value = null
    const stationId = rawStationId?.trim()
    if (!stationId) {
      bootError.value = 'Station ID kosong.'
      return
    }

    try {
      const provider = await getDeviceConfigProvider()
      const config = await provider.getConfig(stationId)
      if (cancelled) return
      if (config.role !== 'kiosk') {
        bootError.value = `Device '${stationId}' bukan role kiosk.`
        return
      }
      deviceConfig.value = config
    } catch (error) {
      if (cancelled) return
      if (error instanceof DeviceConfigNotFoundError) {
        bootError.value = `Konfigurasi tidak ditemukan untuk station '${error.deviceId}'.`
        return
      }
      if (error instanceof DeviceConfigInvalidError) {
        bootError.value = `Konfigurasi tidak valid untuk '${error.deviceId}'.`
        return
      }
      bootError.value = mapBackendErrorToUserMessage(error)
    }
  },
  { immediate: true },
)

const servicePointsQuery = useQuery({
  queryKey: computed(() => ['service-points', props.stationId] as const),
  enabled: computed(() => !!deviceConfig.value && !bootError.value),
  queryFn: async () => getAdmissionQueueApi().listServicePoints(true),
})

const businessDateQuery = useQuery({
  queryKey: computed(() => ['business-date', props.stationId] as const),
  enabled: computed(() => !!deviceConfig.value && !bootError.value),
  queryFn: async () => getHisApi().getBusinessDate(),
  staleTime: 5 * 60 * 1000,
})

const businessDate = computed(() => businessDateQuery.data.value?.businessDate ?? null)

const offerings = computed(() => {
  if (!deviceConfig.value || !servicePointsQuery.data.value) return []
  return intersectOfferings(deviceConfig.value, servicePointsQuery.data.value)
})

const {
  pending,
  errorMessage,
  errorUncertain,
  result,
  lastAttemptServicePointId,
  canSubmit,
  submitIntake,
  retryLast,
  resetToSelection,
} = useKioskIntake(offerings)

const { printPending, printError, printSucceeded, printCommittedLabel, resetPrintState } =
  useKioskPrint({
    stationId: stationIdRef,
    result,
    offerings,
    printerProxyPort,
  })

const catalog = getServiceCatalog()

const selfPrint = useKioskSelfPrint({
  stationId: stationIdRef,
  printerProxyPort,
})

const registration = useKioskRegistration({
  stationId: stationIdRef,
  getBusinessDate: () =>
    getHisApi()
      .getBusinessDate()
      .then((d) => d.businessDate),
  searchBooking: (tglBerobat, keyword) => getHisApi().searchBooking(tglBerobat, keyword),
  getBookingDetail: (bookingId) => getHisApi().getBookingDetail(bookingId),
  listPolis: (pasienId) => getHisApi().listPolis(pasienId),
  getGroupJaminanMap: (tipeJaminanId) => getJetliApi().getGroupJaminanMap(tipeJaminanId),
  searchPatientContext: (body) => getHisApi().patientContextSearch(body),
  deepSearchPasien: (keyword) => getHisApi().deepSearchPasien(keyword),
  appConfig: configService.getConfig(),
  verifyBiometric: (noka) => createBiometricClient({ port: printerProxyPort.value }).verify(noka),
  listKarcis: (layananId) => getHisApi().listKarcis(layananId),
  getRujukanSkpd: (noPeserta) => getJetliApi().getRujukanSkpd(noPeserta),
  registerBooking: (ctx) => getHisApi().registerByBookingDirect(ctx),
  registerWalkin: (ctx) => getHisApi().registerWalkInDirect(ctx),
  createSep: (body) => getJetliApi().createSep(body),
  uploadSep: (body) => getJetliApi().uploadSep(body),
  setDataEligibility: (body) => getHisApi().setDataEligibility(body),
  bookingAssistance: (body) => getHisApi().bookingAssistance(body),
  intake: (servicePointId) => getAdmissionQueueApi().intake({ servicePointId }),
  printRegistration: selfPrint.printRegistration,
  printQueueTicket: selfPrint.printQueueTicket,
  offeringsName: (servicePointId) =>
    offerings.value.find((sp) => sp.servicePointId === servicePointId)?.displayName,
})

watch(result, (next, prev) => {
  if (next && next !== prev) {
    void printCommittedLabel(lastAttemptServicePointId.value ?? undefined)
  }
})

const assistanceTitle = computed(() =>
  registration.mode.value === 'booking' ? 'Nomor Antrian Bantuan' : 'Nomor Antrian Pendaftaran',
)

const assistanceServicePointName = computed(() => {
  const id = registration.assistanceServicePointId.value
  if (!id) return undefined
  return offerings.value.find((sp) => sp.servicePointId === id)?.displayName
})

function isBpjs(sp: AdmissionServicePoint): boolean {
  const name = (sp.displayName || '').toLowerCase()
  const id = (sp.servicePointId || '').toLowerCase()
  return name.includes('bpjs') || name.includes('jkn') || id.includes('bpjs') || id.includes('jkn')
}

function onResetToSelection() {
  resetPrintState()
  resetToSelection()
}

function onReprint() {
  void printCommittedLabel(lastAttemptServicePointId.value ?? undefined)
}

function onHome() {
  scanError.value = null
  resetToSelection()
  resetPrintState()
  selfPrint.resetPrintState()
  homeMode.value = 'idle'
  registration.goHome()
}

function onStartIntake() {
  onHome()
  homeMode.value = 'intake'
}

async function onScanBooking() {
  scanError.value = null
  const result = await scanQrFromCamera()
  if ('detected' in result) {
    void registration.submitBookingKeyword(result.detected)
  } else {
    scanError.value = result.error
  }
}

function onSearchFromHome(keyword: string) {
  void registration.submitBookingKeyword(keyword)
}

function onConfirmPatientContext(item: PatientContextItem) {
  void registration.confirmPatientContext(item)
}

function onCancelPatientContext() {
  registration.cancelPatientContext()
}

function onIntakeFromContext() {
  registration.cancelPatientContext()
  homeMode.value = 'intake'
}

function onReprintRegistration() {
  void registration.reprintRegistration()
}

function onReprintAssistance() {
  void registration.reprintQueueTicket()
}

onMounted(() => {
  registration.startIdleReset()
})

onUnmounted(() => {
  registration.dispose()
})

const isBookingMode = computed(() => registration.mode.value === 'booking')

const loadingMessage = computed(() => {
  if (bootError.value) return null
  if (!deviceConfig.value) return 'Memuat konfigurasi perangkat…'
  if (servicePointsQuery.isPending.value) return 'Memuat Service Point aktif…'
  if (servicePointsQuery.isError.value) {
    return mapBackendErrorToUserMessage(servicePointsQuery.error.value)
  }
  if (offerings.value.length === 0) {
    return 'Tidak ada Service Point aktif yang cocok dengan konfigurasi station ini.'
  }
  return null
})
</script>

<template>
  <BootErrorPage v-if="bootError" title="Kiosk tidak dapat dimulai" :message="bootError" />

  <KioskHome
    v-else-if="homeMode === 'idle' && registration.flow.value === 'HOME'"
    :intake-available="offerings.length > 0"
    :business-date="businessDate"
    :pending="registration.submitting.value"
    @start-search="onSearchFromHome"
    @start-intake="onStartIntake"
  />

  <div v-else class="kiosk-flow-shell">
    <KioskHeader :lang="lang" :business-date="businessDate" @toggle-lang="lang = $event" />

    <div class="kiosk-flow-body">
      <template v-if="result">
        <section class="panel">
          <h1>Nomor Antrian Anda</h1>
          <p>Simpan Queue Label berikut. Cetak memakai print proxy lokal.</p>
          <div class="queue-label" data-testid="queue-label">{{ result.queueLabel }}</div>
          <p class="status ok">Antrian ID {{ result.antrianId }} · Urut {{ result.noUrut }}</p>

          <p v-if="printPending" class="status" data-testid="print-pending">Sedang mencetak…</p>
          <p v-else-if="printSucceeded && !printError" class="status ok" data-testid="print-ok">
            Tiket berhasil dicetak.
          </p>
          <p v-if="printError" class="status error" data-testid="print-error">{{ printError }}</p>

          <div class="actions">
            <button
              type="button"
              class="secondary-btn"
              :disabled="printPending"
              data-testid="reprint"
              @click="onReprint"
            >
              Cetak ulang
            </button>
            <button
              type="button"
              class="secondary-btn"
              :disabled="printPending"
              @click="onResetToSelection"
            >
              Ambil nomor lain
            </button>
            <button type="button" class="secondary-btn" @click="onHome">Kembali ke menu</button>
          </div>
        </section>
      </template>

      <template v-else-if="registration.flow.value !== 'HOME'">
        <div
          class="kiosk-stepper"
          v-if="
            [
              'BOOKING_SEARCH',
              'PATIENT_CONTEXT_SEARCH',
              'PATIENT_CONTEXT_CONFIRM',
              'WALKIN_SELECT_GUARANTEE',
              'BPJS_SELECT_REFERENCE',
              'WALKIN_SELECT_SERVICE',
              'BOOKING_CONFIRM',
              'WALKIN_CONFIRM',
              'BIOMETRIC_VERIFY',
              'REGISTRATION_SUCCESS',
              'ASSISTANCE_QUEUE',
            ].includes(registration.flow.value)
          "
        >
          <!-- 1. Identifikasi -->
          <div
            class="step-item"
            :class="{
              completed: isBookingMode
                ? [
                    'BOOKING_CONFIRM',
                    'BIOMETRIC_VERIFY',
                    'REGISTRATION_SUCCESS',
                    'ASSISTANCE_QUEUE',
                  ].includes(registration.flow.value)
                : [
                    'WALKIN_SELECT_GUARANTEE',
                    'BIOMETRIC_VERIFY',
                    'BPJS_SELECT_REFERENCE',
                    'WALKIN_SELECT_SERVICE',
                    'WALKIN_CONFIRM',
                    'REGISTRATION_SUCCESS',
                    'ASSISTANCE_QUEUE',
                  ].includes(registration.flow.value),
              active: [
                'BOOKING_SEARCH',
                'PATIENT_CONTEXT_SEARCH',
                'PATIENT_CONTEXT_CONFIRM',
              ].includes(registration.flow.value),
            }"
          >
            1. Identifikasi
          </div>
          <div class="step-divider"></div>

          <!-- 2. Jaminan -->
          <div
            class="step-item"
            :class="{
              completed: isBookingMode
                ? [
                    'BOOKING_CONFIRM',
                    'BIOMETRIC_VERIFY',
                    'REGISTRATION_SUCCESS',
                    'ASSISTANCE_QUEUE',
                  ].includes(registration.flow.value)
                : [
                    'WALKIN_SELECT_SERVICE',
                    'WALKIN_CONFIRM',
                    'REGISTRATION_SUCCESS',
                    'ASSISTANCE_QUEUE',
                  ].includes(registration.flow.value),
              active:
                !isBookingMode &&
                ['WALKIN_SELECT_GUARANTEE', 'BIOMETRIC_VERIFY', 'BPJS_SELECT_REFERENCE'].includes(
                  registration.flow.value,
                ),
            }"
          >
            2. Jaminan
          </div>
          <div class="step-divider"></div>

          <!-- 3. Layanan -->
          <div
            class="step-item"
            :class="{
              completed: isBookingMode
                ? [
                    'BOOKING_CONFIRM',
                    'BIOMETRIC_VERIFY',
                    'REGISTRATION_SUCCESS',
                    'ASSISTANCE_QUEUE',
                  ].includes(registration.flow.value)
                : ['WALKIN_CONFIRM', 'REGISTRATION_SUCCESS', 'ASSISTANCE_QUEUE'].includes(
                    registration.flow.value,
                  ),
              active: !isBookingMode && registration.flow.value === 'WALKIN_SELECT_SERVICE',
            }"
          >
            3. Layanan
          </div>
          <div class="step-divider"></div>

          <!-- 4. Konfirmasi -->
          <div
            class="step-item"
            :class="{
              completed: ['REGISTRATION_SUCCESS', 'ASSISTANCE_QUEUE'].includes(
                registration.flow.value,
              ),
              active: isBookingMode
                ? ['BOOKING_CONFIRM', 'BIOMETRIC_VERIFY'].includes(registration.flow.value)
                : registration.flow.value === 'WALKIN_CONFIRM',
            }"
          >
            4. Konfirmasi
          </div>
          <div class="step-divider"></div>

          <!-- 5. Selesai -->
          <div
            class="step-item"
            :class="{
              completed: false,
              active: ['REGISTRATION_SUCCESS', 'ASSISTANCE_QUEUE'].includes(
                registration.flow.value,
              ),
            }"
          >
            5. Selesai
          </div>
        </div>

        <div class="kiosk-step-wrapper">
          <BookingSearchStep
            v-if="registration.flow.value === 'BOOKING_SEARCH'"
            :pending="registration.submitting.value"
            :error-message="scanError"
            @submit="registration.submitBookingKeyword"
            @scan="onScanBooking"
            @back="onHome"
          />
          <section v-else-if="registration.flow.value === 'PATIENT_CONTEXT_SEARCH'" class="panel">
            <h1>Mencari Data</h1>
            <p class="status">Mencari data pasien…</p>
          </section>
          <BookingConfirmStep
            v-else-if="registration.flow.value === 'BOOKING_CONFIRM'"
            :booking="registration.bookingDetail.value!"
            :eligibility="registration.bookingEligibility.value!"
            :pending="registration.submitting.value"
            :error-message="null"
            @confirm="registration.confirmBooking"
            @back="onHome"
          />
          <PatientContextConfirmStep
            v-else-if="registration.flow.value === 'PATIENT_CONTEXT_CONFIRM'"
            :best-match="registration.patientContextResult.value?.bestMatch ?? null"
            :patients="registration.patientContextResult.value?.patients.items ?? []"
            :pending="registration.submitting.value"
            @confirm="onConfirmPatientContext"
            @intake="onIntakeFromContext"
            @retry="onCancelPatientContext"
          />
          <BiometricStep
            v-else-if="registration.flow.value === 'BIOMETRIC_VERIFY'"
            :pending="registration.submitting.value"
            :error-message="null"
          />
          <WalkinSelectGuaranteeStep
            v-else-if="registration.flow.value === 'WALKIN_SELECT_GUARANTEE'"
            :policies="registration.patientPolicies.value"
            :pending="registration.submitting.value"
            @select="registration.selectWalkinGuarantee"
            @back="onHome"
          />
          <BpjsSelectReferenceStep
            v-else-if="registration.flow.value === 'BPJS_SELECT_REFERENCE'"
            :references="registration.bpjsReferences.value"
            :pending="registration.submitting.value"
            @select="registration.selectBpjsReference"
            @back="onHome"
          />
          <WalkinServiceStep
            v-else-if="registration.flow.value === 'WALKIN_SELECT_SERVICE'"
            :catalog="catalog"
            :pending="registration.submitting.value"
            @select="registration.selectService"
            @back="onHome"
          />
          <WalkinConfirmStep
            v-else-if="registration.flow.value === 'WALKIN_CONFIRM'"
            :patient="registration.selectedPatient.value!"
            :service="registration.selectedService.value!"
            :eligibility="registration.walkinEligibility.value!"
            :pending="registration.submitting.value"
            :error-message="null"
            @confirm="registration.confirmWalkin"
            @back="onHome"
          />
          <RegistrationSuccessStep
            v-else-if="registration.flow.value === 'REGISTRATION_SUCCESS'"
            :result="registration.registrationResult.value!"
            :print-pending="selfPrint.printPending.value"
            :print-succeeded="selfPrint.printSucceeded.value"
            :print-error="selfPrint.printError.value"
            @reprint="onReprintRegistration"
            @finish="onHome"
          />
          <FailureStep
            v-else-if="registration.flow.value === 'FAILURE'"
            :error-context="registration.errorContext.value!"
            :offerings="offerings"
            :pending="registration.submitting.value"
            @select-service-point="registration.confirmAssistance"
            @back="onHome"
          />
          <AssistanceQueueStep
            v-else-if="registration.flow.value === 'ASSISTANCE_QUEUE'"
            :ticket="registration.assistanceTicket.value!"
            :title="assistanceTitle"
            :service-point-name="assistanceServicePointName"
            :print-pending="selfPrint.printPending.value"
            :print-succeeded="selfPrint.printSucceeded.value"
            :print-error="selfPrint.printError.value"
            @reprint="onReprintAssistance"
            @finish="onHome"
          />
        </div>
      </template>

      <template v-else>
        <section
          class="panel"
          style="
            background: transparent;
            border: none;
            box-shadow: none;
            padding: 0;
            width: 100%;
            max-width: 900px;
            height: 100%;
            display: flex;
            flex-direction: column;
          "
        >
          <h1 style="text-align: center; margin-bottom: 24px">Ambil Nomor Antrian</h1>
          <p style="text-align: center; margin-bottom: 32px">
            Station <strong>{{ stationId }}</strong> — pilih Service Point.
          </p>

          <p
            v-if="loadingMessage"
            class="status"
            :class="{ error: !!servicePointsQuery.isError.value }"
            style="text-align: center"
          >
            {{ loadingMessage }}
          </p>

          <p
            v-if="errorMessage"
            class="status error"
            :class="{ uncertain: errorUncertain }"
            data-testid="intake-error"
            style="text-align: center"
          >
            {{ errorMessage }}
          </p>

          <div class="scrollable-content" style="padding-bottom: 24px">
            <div v-if="offerings.length" class="kiosk-grid-2x2">
              <button
                v-for="sp in offerings"
                :key="sp.servicePointId"
                type="button"
                class="radio-card"
                :disabled="!canSubmit"
                :data-testid="`sp-${sp.servicePointId}`"
                @click="submitIntake(sp.servicePointId)"
                style="min-height: 88px"
              >
                <!-- Card Icon -->
                <div
                  class="radio-card-icon"
                  :style="{
                    background: isBpjs(sp) ? 'var(--green-soft)' : 'var(--brand-soft)',
                    color: isBpjs(sp) ? 'var(--green-strong)' : 'var(--brand-strong)',
                  }"
                >
                  <!-- Card/BPJS Icon vs Patient Icon -->
                  <svg
                    v-if="isBpjs(sp)"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <rect x="3" y="4" width="18" height="16" rx="2" />
                    <line x1="7" y1="8" x2="17" y2="8" />
                    <line x1="7" y1="12" x2="17" y2="12" />
                    <line x1="7" y1="16" x2="13" y2="16" />
                  </svg>
                  <svg
                    v-else
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </div>

                <!-- Labels -->
                <div class="radio-card-content">
                  <h4 class="radio-card-title">{{ sp.displayName }}</h4>
                  <p class="radio-card-subtitle">{{ sp.queuePrefix }} - {{ sp.displayName }}</p>
                </div>

                <!-- Select Arrow -->
                <div
                  class="select-arrow"
                  :style="{
                    background: isBpjs(sp) ? 'var(--green-soft)' : '',
                    color: isBpjs(sp) ? 'var(--green-strong)' : '',
                  }"
                >
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="3"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <polyline points="13 17 18 12 13 7"></polyline>
                    <polyline points="6 17 11 12 6 7"></polyline>
                  </svg>
                </div>
              </button>
            </div>
          </div>

          <div
            v-if="errorMessage"
            class="actions"
            style="margin-top: 16px; justify-content: center"
          >
            <button
              type="button"
              class="secondary-btn"
              :disabled="pending"
              data-testid="retry-intake"
              @click="retryLast"
              style="min-width: 160px"
            >
              Coba lagi
            </button>
          </div>

          <div
            class="actions-footer"
            style="
              display: flex;
              justify-content: center;
              width: 100%;
              padding-top: 16px;
              border-top: 1px solid var(--border);
            "
          >
            <button type="button" class="secondary-btn" @click="onHome" style="min-width: 200px">
              Kembali ke menu
            </button>
          </div>

          <p
            v-if="pending"
            class="status"
            style="
              text-align: center;
              margin-top: 12px;
              font-weight: 600;
              color: var(--text-secondary);
            "
          >
            Sedang mengambil nomor…
          </p>
        </section>
      </template>
    </div>
  </div>
</template>
