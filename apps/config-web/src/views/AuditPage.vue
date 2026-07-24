<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { getConfigurationApi } from '@/infrastructure'

const api = getConfigurationApi()
const auditQuery = useQuery({
  queryKey: ['config-audit'],
  queryFn: () => api.listAudit(1, 50),
})
</script>

<template>
  <div class="stack">
    <h2 style="margin: 0">Riwayat konfigurasi</h2>
    <p class="muted" style="margin: 0">Hanya baca. Tidak ada approve/reject.</p>
    <p v-if="auditQuery.isLoading.value" class="muted">Memuat…</p>
    <table v-else class="table">
      <thead>
        <tr>
          <th>Waktu</th>
          <th>User</th>
          <th>Entity</th>
          <th>Aksi</th>
          <th>Before/After</th>
          <th>Correlation</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in auditQuery.data.value?.items ?? []" :key="row.auditId">
          <td>{{ row.eventTime }}</td>
          <td>{{ row.userId }}</td>
          <td>{{ row.entityName }} / {{ row.entityId }}</td>
          <td>{{ row.actionType }}</td>
          <td>
            <code style="white-space: pre-wrap; font-size: 0.75rem">{{
              row.originalDataJson || '—'
            }}</code>
          </td>
          <td>{{ row.correlationId || '—' }}</td>
        </tr>
        <tr v-if="!(auditQuery.data.value?.items?.length)">
          <td colspan="6" class="muted">Belum ada audit, atau endpoint audit masih kosong.</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
