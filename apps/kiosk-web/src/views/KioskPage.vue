<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import type { DeviceConfig } from '@aq/shared-types'
import {
  DeviceConfigInvalidError,
  DeviceConfigNotFoundError,
} from '@aq/device-config'
import { MissingAuthTokenError } from '@aq/auth'
import { getAdmissionQueueApi, getAuthTokenProvider, getDeviceConfigProvider } from '../infrastructure'
import { intersectOfferings } from '../lib/offerings'
import { useKioskIntake } from '../composables/useKioskIntake'
import { useKioskPrint } from '../composables/useKioskPrint'
import BootErrorPage from './BootErrorPage.vue'

const props = defineProps<{
  stationId: string
}>()

const bootError = ref<string | null>(null)
const deviceConfig = ref<DeviceConfig | null>(null)
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
      const token = getAuthTokenProvider().getToken()
      if (!token) throw new MissingAuthTokenError()

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
      if (error instanceof MissingAuthTokenError) {
        bootError.value = 'VITE_BILREG_TOKEN belum dikonfigurasi.'
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

watch(result, (next, prev) => {
  if (next && next !== prev) {
    void printCommittedLabel(lastAttemptServicePointId.value ?? undefined)
  }
})

function onResetToSelection() {
  resetPrintState()
  resetToSelection()
}

function onReprint() {
  void printCommittedLabel(lastAttemptServicePointId.value ?? undefined)
}

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
    </div>
  </section>

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

    <p v-if="pending" class="status">Sedang mengambil nomor…</p>
  </section>
</template>
