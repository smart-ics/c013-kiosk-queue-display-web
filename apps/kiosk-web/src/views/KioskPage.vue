<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import type { DeviceConfig } from '@aq/shared-types'
import { DeviceConfigInvalidError, DeviceConfigNotFoundError } from '@aq/device-config'
import {
  getAdmissionQueueApi,
  getDeviceConfigProvider,
  getHisApi,
  getJetliApi,
  getServiceCatalog,
} from '../infrastructure'
import { intersectOfferings } from '../lib/offerings'
import { createBiometricClient } from '../lib/biometric'
import { scanQrFromCamera } from '../lib/qrScanner'
import { useKioskIntake } from '../composables/useKioskIntake'
import { useKioskPrint } from '../composables/useKioskPrint'
import { useKioskRegistration } from '../composables/useKioskRegistration'
import { useKioskSelfPrint } from '../composables/useKioskSelfPrint'
import BootErrorPage from './BootErrorPage.vue'
import KioskHome from './KioskHome.vue'
import BookingSearchStep from './steps/BookingSearchStep.vue'
import BookingConfirmStep from './steps/BookingConfirmStep.vue'
import WalkinSearchStep from './steps/WalkinSearchStep.vue'
import WalkinPatientStep from './steps/WalkinPatientStep.vue'
import WalkinServiceStep from './steps/WalkinServiceStep.vue'
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
      bootError.value = error instanceof Error ? error.message : 'Boot gagal.'
    }
  },
  { immediate: true },
)

const servicePointsQuery = useQuery({
  queryKey: computed(() => ['service-points', props.stationId] as const),
  enabled: computed(() => !!deviceConfig.value && !bootError.value),
  queryFn: async () => getAdmissionQueueApi().listServicePoints(true),
})

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

const {
  printPending,
  printError,
  printSucceeded,
  printCommittedLabel,
  resetPrintState,
} = useKioskPrint({
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
  getBusinessDate: () => getHisApi().getBusinessDate().then((d) => d.businessDate),
  searchBooking: (tglBerobat, keyword) => getHisApi().searchBooking(tglBerobat, keyword),
  getBookingDetail: (bookingId) => getHisApi().getBookingDetail(bookingId),
  listPolis: (pasienId) => getHisApi().listPolis(pasienId),
  getGroupJaminanMap: (tipeJaminanId) => getJetliApi().getGroupJaminanMap(tipeJaminanId),
  searchPasien: (keyword) => getHisApi().searchPasien(keyword),
  verifyBiometric: () => createBiometricClient({ port: printerProxyPort.value }).verify(),
  registerBooking: (ctx) => getHisApi().registerByBookingDirect(ctx),
  registerWalkin: (ctx) => getHisApi().registerWalkInDirect(ctx),
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
  registration.mode.value === 'booking'
    ? 'Nomor Antrian Bantuan'
    : 'Nomor Antrian Pendaftaran',
)

const assistanceServicePointName = computed(() => {
  const id = registration.assistanceServicePointId.value
  if (!id) return undefined
  return offerings.value.find((sp) => sp.servicePointId === id)?.displayName
})

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

function onStartBooking() {
  onHome()
  registration.startBookingFlow()
}

function onStartWalkin() {
  onHome()
  registration.startWalkinFlow()
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

const loadingMessage = computed(() => {
  if (bootError.value) return null
  if (!deviceConfig.value) return 'Memuat konfigurasi perangkat…'
  if (servicePointsQuery.isPending.value) return 'Memuat Service Point aktif…'
  if (servicePointsQuery.isError.value) {
    return servicePointsQuery.error.value instanceof Error
      ? servicePointsQuery.error.value.message
      : 'Gagal memuat Service Point.'
  }
  if (offerings.value.length === 0) {
    return 'Tidak ada Service Point aktif yang cocok dengan konfigurasi station ini.'
  }
  return null
})
</script>

<template>
  <BootErrorPage
    v-if="bootError"
    title="Kiosk tidak dapat dimulai"
    :message="bootError"
  />

  <section v-else-if="result" class="panel">
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
      <button type="button" class="secondary-btn" :disabled="printPending" @click="onResetToSelection">
        Ambil nomor lain
      </button>
      <button type="button" class="secondary-btn" @click="onHome">
        Kembali ke menu
      </button>
    </div>
  </section>

  <template v-else-if="registration.flow.value !== 'HOME'">
    <BookingSearchStep
      v-if="registration.flow.value === 'BOOKING_SEARCH'"
      :pending="registration.submitting.value"
      :error-message="scanError"
      @submit="registration.submitBookingKeyword"
      @scan="onScanBooking"
      @back="onHome"
    />
    <BookingConfirmStep
      v-else-if="registration.flow.value === 'BOOKING_CONFIRM'"
      :booking="registration.bookingDetail.value!"
      :eligibility="registration.bookingEligibility.value!"
      :pending="registration.submitting.value"
      :error-message="null"
      @confirm="registration.confirmBooking"
      @back="onHome"
    />
    <BiometricStep
      v-else-if="registration.flow.value === 'BIOMETRIC_VERIFY'"
      :pending="registration.submitting.value"
      :error-message="null"
    />
    <WalkinSearchStep
      v-else-if="registration.flow.value === 'WALKIN_SEARCH'"
      :pending="registration.submitting.value"
      :error-message="null"
      @submit="registration.searchWalkinPatient"
      @back="onHome"
    />
    <WalkinPatientStep
      v-else-if="registration.flow.value === 'WALKIN_SELECT_PATIENT'"
      :patients="registration.patientMatches.value"
      :pending="registration.submitting.value"
      @select="registration.selectPatient"
      @back="registration.startWalkinFlow"
    />
    <WalkinServiceStep
      v-else-if="registration.flow.value === 'WALKIN_SELECT_SERVICE'"
      :catalog="catalog"
      :pending="registration.submitting.value"
      @select="registration.selectService"
      @back="registration.startWalkinFlow"
    />
    <WalkinConfirmStep
      v-else-if="registration.flow.value === 'WALKIN_CONFIRM'"
      :patient="registration.selectedPatient.value!"
      :service="registration.selectedService.value!"
      :eligibility="registration.walkinEligibility.value!"
      :pending="registration.submitting.value"
      :error-message="null"
      @confirm="registration.confirmWalkin"
      @update-no-peserta="registration.setWalkinNoPeserta"
      @back="registration.startWalkinFlow"
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
  </template>

  <KioskHome
    v-else-if="homeMode === 'idle'"
    :intake-available="offerings.length > 0"
    @start-booking="onStartBooking"
    @start-walkin="onStartWalkin"
    @start-intake="onStartIntake"
  />

  <section v-else class="panel">
    <h1>Ambil Nomor Antrian</h1>
    <p>Station <strong>{{ stationId }}</strong> — pilih Service Point.</p>

    <p v-if="loadingMessage" class="status" :class="{ error: !!servicePointsQuery.isError.value }">
      {{ loadingMessage }}
    </p>

    <p
      v-if="errorMessage"
      class="status error"
      :class="{ uncertain: errorUncertain }"
      data-testid="intake-error"
    >
      {{ errorMessage }}
    </p>

    <div v-if="offerings.length" class="sp-grid">
      <button
        v-for="sp in offerings"
        :key="sp.servicePointId"
        type="button"
        class="sp-btn"
        :disabled="!canSubmit"
        :data-testid="`sp-${sp.servicePointId}`"
        @click="submitIntake(sp.servicePointId)"
      >
        {{ sp.displayName }}
        <small>{{ sp.queuePrefix }} · {{ sp.servicePointId }}</small>
      </button>
    </div>

    <div v-if="errorMessage" class="actions">
      <button
        type="button"
        class="secondary-btn"
        :disabled="pending"
        data-testid="retry-intake"
        @click="retryLast"
      >
        Coba lagi
      </button>
    </div>

    <div class="actions">
      <button type="button" class="secondary-btn" @click="onHome">
        Kembali ke menu
      </button>
    </div>

    <p v-if="pending" class="status">Sedang mengambil nomor…</p>
  </section>
</template>
