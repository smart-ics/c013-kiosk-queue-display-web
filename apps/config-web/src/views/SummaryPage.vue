<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { ApiClientError } from '@aq/api-client'
import { useRouter } from 'vue-router'
import { getConfigurationApi, logout } from '@/infrastructure'

const router = useRouter()
const api = getConfigurationApi()

const summaryQuery = useQuery({
  queryKey: ['config-summary'],
  queryFn: async () => {
    try {
      await api.whoAmI()
      return api.getSummary()
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 403) {
        logout()
        await router.replace({ name: 'forbidden' })
      }
      if (err instanceof ApiClientError && err.status === 401) {
        logout()
        await router.replace({ name: 'login' })
      }
      throw err
    }
  },
})
</script>

<template>
  <div class="stack">
    <h2 style="margin: 0">Ringkasan</h2>
    <p v-if="summaryQuery.isLoading.value" class="muted">Memuat…</p>
    <p v-else-if="summaryQuery.isError.value" class="error">
      Gagal memuat ringkasan: {{ (summaryQuery.error.value as Error)?.message }}
    </p>
    <template v-else-if="summaryQuery.data.value">
      <div class="form-grid">
        <div>
          <div class="muted">Workstation aktif</div>
          <strong>{{ summaryQuery.data.value.activeWorkstationCount }}</strong>
        </div>
        <div>
          <div class="muted">Workstation nonaktif</div>
          <strong>{{ summaryQuery.data.value.inactiveWorkstationCount }}</strong>
        </div>
        <div>
          <div class="muted">Display aktif</div>
          <strong>{{ summaryQuery.data.value.activeDisplayCount }}</strong>
        </div>
        <div>
          <div class="muted">Display nonaktif</div>
          <strong>{{ summaryQuery.data.value.inactiveDisplayCount }}</strong>
        </div>
        <div>
          <div class="muted">Kiosk aktif</div>
          <strong>{{ summaryQuery.data.value.activeKioskCount }}</strong>
        </div>
        <div>
          <div class="muted">Kiosk nonaktif</div>
          <strong>{{ summaryQuery.data.value.inactiveKioskCount }}</strong>
        </div>
      </div>
      <div>
        <h3>Peringatan operasional</h3>
        <ul>
          <li>
            Loket aktif tanpa display:
            {{ summaryQuery.data.value.activeLoketsWithoutDisplay?.join(', ') || '—' }}
          </li>
          <li>
            Display tanpa loket:
            {{ summaryQuery.data.value.displaysWithoutLoket?.join(', ') || '—' }}
          </li>
          <li>
            Kiosk tanpa Service Point:
            {{ summaryQuery.data.value.kiosksWithoutServicePoint?.join(', ') || '—' }}
          </li>
        </ul>
      </div>
    </template>
  </div>
</template>
