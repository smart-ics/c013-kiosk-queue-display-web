<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import type { DeviceConfig } from '@aq/shared-types'
import {
  DeviceConfigInvalidError,
  DeviceConfigNotFoundError,
} from '@aq/device-config'
import { MissingAuthTokenError } from '@aq/auth'
import {
  getAdmissionQueueApi,
  getAuthTokenProvider,
  getDeviceConfigProvider,
} from '../infrastructure'
import { filterSnapshotByLoketIds } from '../lib/snapshot'
import { validateDisplayDeviceConfig } from '../lib/boot'
import { displayStateLabel } from '../lib/displayState'
import { useAnnouncementAudio } from '../composables/useAnnouncementAudio'
import { useDisplaySignalR } from '../composables/useDisplaySignalR'
import { useVersionAutoRefresh } from '../composables/useVersionAutoRefresh'
import BootErrorPage from './BootErrorPage.vue'

const props = defineProps<{
  screenId: string
}>()

const route = useRoute()
const isPreview = computed(() => String(route.query.preview ?? '') === '1')

const DEFAULT_POLL_MS = 15_000
const CONFIG_REFRESH_MS = 60_000

const bootError = ref<string | null>(null)
const deviceConfig = ref<DeviceConfig | null>(null)
const queryClient = useQueryClient()

watch(
  () => props.screenId,
  async (rawScreenId, _prev, onCleanup) => {
    let cancelled = false
    onCleanup(() => {
      cancelled = true
    })

    bootError.value = null
    deviceConfig.value = null
    const screenId = rawScreenId?.trim()
    if (!screenId) {
      bootError.value = 'Screen ID kosong. Buka dengan path /display/{screenId}.'
      return
    }

    try {
      const token = getAuthTokenProvider().getToken()
      if (!token) throw new MissingAuthTokenError()

      const provider = await getDeviceConfigProvider()
      const config = await provider.getConfig(screenId)
      if (cancelled) return
      const validation = validateDisplayDeviceConfig(screenId, config)
      if (!validation.ok) {
        bootError.value = validation.message
        return
      }
      deviceConfig.value = config
    } catch (error) {
      if (cancelled) return
      if (error instanceof DeviceConfigNotFoundError) {
        bootError.value = `Konfigurasi tidak ditemukan untuk screen '${error.deviceId}'.`
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

const configuredLoketIds = computed(() => deviceConfig.value?.loketIds ?? [])
const pollIntervalMs = computed(() => deviceConfig.value?.pollIntervalMs ?? DEFAULT_POLL_MS)
const audioEnabled = computed(
  () => !isPreview.value && deviceConfig.value?.audioEnabled !== false,
)
const displayReady = computed(() => !!deviceConfig.value && !bootError.value)

watch(
  displayReady,
  (ready, _prev, onCleanup) => {
    if (!ready) return
    const timer = window.setInterval(() => {
      void (async () => {
        try {
          const provider = await getDeviceConfigProvider()
          const config = await provider.getConfig(props.screenId.trim())
          const validation = validateDisplayDeviceConfig(props.screenId.trim(), config)
          if (!validation.ok) {
            bootError.value = validation.message
            deviceConfig.value = null
            return
          }
          deviceConfig.value = config
        } catch (error) {
          if (error instanceof DeviceConfigInvalidError || error instanceof DeviceConfigNotFoundError) {
            bootError.value =
              error instanceof DeviceConfigNotFoundError
                ? `Konfigurasi tidak ditemukan untuk screen '${error.deviceId}'.`
                : `Konfigurasi tidak valid untuk '${error.deviceId}'.`
            deviceConfig.value = null
          }
        }
      })()
    }, CONFIG_REFRESH_MS)
    onCleanup(() => window.clearInterval(timer))
  },
)

const snapshotQuery = useQuery({
  queryKey: computed(() => ['display-snapshot', props.screenId, configuredLoketIds.value] as const),
  enabled: displayReady,
  refetchInterval: pollIntervalMs,
  queryFn: async () => {
    const all = await getAdmissionQueueApi().getCurrentDisplays()
    return filterSnapshotByLoketIds(all, configuredLoketIds.value)
  },
})

const snapshotItems = computed(() => snapshotQuery.data.value)

const { announcing } = useAnnouncementAudio({
  items: snapshotItems,
  audioEnabled,
})

function refetchSnapshot() {
  void queryClient.invalidateQueries({
    queryKey: ['display-snapshot', props.screenId],
  })
}

useDisplaySignalR({
  enabled: displayReady,
  configuredLoketIds,
  onRefresh: refetchSnapshot,
})

const idle = computed(() => !announcing.value)

useVersionAutoRefresh({
  enabled: displayReady,
  idle,
})

const sortedItems = computed(() => {
  const items = snapshotItems.value ?? []
  return [...items].sort((a, b) => a.loketKey.localeCompare(b.loketKey))
})
</script>

<template>
  <BootErrorPage
    v-if="bootError"
    title="Queue Display — Boot gagal"
    :message="bootError"
  />

  <main v-else-if="!deviceConfig" class="display-root">
    <p class="loading">Memuat konfigurasi…</p>
  </main>

  <main v-else class="display-root">
    <p v-if="isPreview" class="status" style="background:#fff3cd;color:#7a5b00;padding:0.5rem 1rem">
      Mode Preview — audio dimatikan; konfigurasi tidak diubah.
    </p>
    <header class="display-header">
      <h1>Antrian Admisi</h1>
      <p class="screen-meta">
        Screen <strong>{{ screenId }}</strong>
        <span v-if="snapshotQuery.isFetching" class="dot" aria-hidden="true" />
      </p>
    </header>

    <p v-if="snapshotQuery.isError" class="status error">
      Gagal memuat snapshot. Polling akan mencoba lagi.
    </p>

    <section v-else-if="sortedItems.length === 0" class="empty">
      <p>Belum ada panggilan aktif.</p>
    </section>

    <section v-else class="loket-grid">
      <article v-for="item in sortedItems" :key="item.loketKey" class="loket-card">
        <p class="loket-key">{{ item.loketKey }}</p>
        <p class="queue-label">{{ item.queueLabel ?? '—' }}</p>
        <p class="state">{{ displayStateLabel(item.displayState) }}</p>
      </article>
    </section>
  </main>
</template>
