<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import QRCode from 'qrcode'
import type { QueueKiosk } from '@aq/shared-types'
import {
  buildCanonicalKioskUrl,
  buildPreviewKioskUrl,
  getAdmissionQueueApi,
  getConfigurationApi,
} from '@/infrastructure'

const api = getConfigurationApi()
const admissionApi = getAdmissionQueueApi()
const queryClient = useQueryClient()
const error = ref('')
const editingId = ref<string | null>(null)
const qrDataUrl = ref('')
const qrFor = ref('')

const form = reactive({
  stationId: '',
  displayName: '',
  locationName: '',
  active: true,
  printerProxyPort: 5050,
  notes: '',
  servicePointIds: [] as string[],
  rowVersion: '',
})

const listQuery = useQuery({
  queryKey: ['config-kiosks'],
  queryFn: () => api.listKiosks(),
})

const servicePointsQuery = useQuery({
  queryKey: ['config-service-points'],
  queryFn: () => admissionApi.listServicePoints(false),
})

const selectedMappings = computed(() =>
  form.servicePointIds.map((servicePointId, sortOrder) => ({ servicePointId, sortOrder })),
)

function resetForm() {
  editingId.value = null
  form.stationId = ''
  form.displayName = ''
  form.locationName = ''
  form.active = true
  form.printerProxyPort = 5050
  form.notes = ''
  form.servicePointIds = []
  form.rowVersion = ''
  error.value = ''
  qrDataUrl.value = ''
  qrFor.value = ''
}

function startEdit(row: Omit<QueueKiosk, 'servicePoints'> & { servicePoints?: QueueKiosk['servicePoints'] }) {
  editingId.value = row.stationId
  form.stationId = row.stationId
  form.displayName = row.displayName
  form.locationName = row.locationName ?? ''
  form.active = row.active
  form.printerProxyPort = row.printerProxyPort
  form.notes = row.notes ?? ''
  form.servicePointIds = (row.servicePoints ?? []).map((x) => x.servicePointId)
  form.rowVersion = row.rowVersion
  error.value = ''
}

function toggleServicePoint(servicePointId: string, selected: boolean) {
  form.servicePointIds = selected
    ? [...form.servicePointIds, servicePointId]
    : form.servicePointIds.filter((id) => id !== servicePointId)
}

function onServicePointChange(servicePointId: string, event: Event) {
  toggleServicePoint(servicePointId, (event.target as HTMLInputElement).checked)
}

async function copyUrl(stationId: string) {
  await navigator.clipboard.writeText(buildCanonicalKioskUrl(stationId))
}

function openPreview(stationId: string) {
  window.open(buildPreviewKioskUrl(stationId), '_blank', 'noopener,noreferrer')
}

async function showQr(stationId: string) {
  const url = buildCanonicalKioskUrl(stationId)
  qrFor.value = url
  qrDataUrl.value = await QRCode.toDataURL(url, { margin: 1, width: 220 })
}

const saveMutation = useMutation({
  mutationFn: async () => {
    if (editingId.value) {
      const updated = await api.updateKiosk(editingId.value, {
        displayName: form.displayName,
        locationName: form.locationName || null,
        printerProxyPort: form.printerProxyPort,
        notes: form.notes || null,
        rowVersion: form.rowVersion,
      })
      return api.replaceKioskServicePoints(editingId.value, {
        servicePoints: selectedMappings.value,
        rowVersion: updated.rowVersion,
      })
    }
    return api.createKiosk({
      stationId: form.stationId,
      displayName: form.displayName,
      locationName: form.locationName || null,
      active: form.active,
      printerProxyPort: form.printerProxyPort,
      notes: form.notes || null,
      servicePoints: selectedMappings.value,
    })
  },
  onSuccess: async () => {
    await queryClient.invalidateQueries({ queryKey: ['config-kiosks'] })
    await queryClient.invalidateQueries({ queryKey: ['config-summary'] })
    resetForm()
  },
  onError: (err: Error) => {
    error.value = err.message
  },
})

const toggleMutation = useMutation({
  mutationFn: (payload: { id: string; rowVersion: string; activate: boolean }) =>
    payload.activate
      ? api.activateKiosk(payload.id, payload.rowVersion)
      : api.deactivateKiosk(payload.id, payload.rowVersion),
  onSuccess: async () => {
    await queryClient.invalidateQueries({ queryKey: ['config-kiosks'] })
    await queryClient.invalidateQueries({ queryKey: ['config-summary'] })
  },
  onError: (err: Error) => {
    error.value = err.message
  },
})
</script>

<template>
  <div class="stack">
    <div class="row-actions" style="justify-content: space-between">
      <h2 style="margin: 0">Kiosk</h2>
      <button type="button" class="secondary" @click="resetForm">Baru</button>
    </div>

    <form class="stack" @submit.prevent="saveMutation.mutate()">
      <div class="form-grid">
        <label>
          StationId
          <input v-model="form.stationId" :disabled="!!editingId" required maxlength="50" />
        </label>
        <label>
          Nama
          <input v-model="form.displayName" required />
        </label>
        <label>
          Lokasi
          <input v-model="form.locationName" />
        </label>
        <label>
          Printer proxy port
          <input
            v-model.number="form.printerProxyPort"
            type="number"
            min="1"
            max="65535"
            required
          />
        </label>
        <label v-if="!editingId">
          Aktif saat create
          <select v-model="form.active">
            <option :value="true">Ya</option>
            <option :value="false">Tidak</option>
          </select>
        </label>
        <label style="grid-column: 1 / -1">
          Catatan
          <textarea v-model="form.notes" rows="2" />
        </label>
      </div>

      <fieldset class="stack">
        <legend>Service Point</legend>
        <p v-if="servicePointsQuery.isPending.value" class="muted">Memuat Service Point…</p>
        <label
          v-for="servicePoint in servicePointsQuery.data.value ?? []"
          :key="servicePoint.servicePointId"
          class="row-actions"
        >
          <input
            type="checkbox"
            :checked="form.servicePointIds.includes(servicePoint.servicePointId)"
            @change="onServicePointChange(servicePoint.servicePointId, $event)"
          />
          <span>
            {{ servicePoint.displayName }} ({{ servicePoint.servicePointId }})
            <span v-if="servicePoint.status !== 'Active'" class="badge inactive">Nonaktif</span>
          </span>
        </label>
        <p class="muted">
          Urutan mengikuti urutan pemilihan:
          {{ form.servicePointIds.join(' → ') || 'belum dipilih' }}
        </p>
      </fieldset>

      <p v-if="error" class="error">{{ error }}</p>
      <button type="submit" :disabled="saveMutation.isPending.value">
        {{ editingId ? 'Simpan kiosk' : 'Buat kiosk' }}
      </button>
    </form>

    <div v-if="qrDataUrl" class="stack">
      <strong>QR URL</strong>
      <code>{{ qrFor }}</code>
      <img :src="qrDataUrl" alt="QR kiosk URL" width="220" height="220" />
    </div>

    <table class="table">
      <thead>
        <tr>
          <th>Nama</th>
          <th>StationId</th>
          <th>Service Point</th>
          <th>Printer</th>
          <th>Status</th>
          <th>Aksi</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in listQuery.data.value ?? []" :key="row.stationId">
          <td>{{ row.displayName }}</td>
          <td><code>{{ row.stationId }}</code></td>
          <td>{{ (row.servicePoints ?? []).map((x) => x.servicePointId).join(', ') || '—' }}</td>
          <td>{{ row.printerProxyPort }}</td>
          <td>
            <span class="badge" :class="{ inactive: !row.active }">
              {{ row.active ? 'Aktif' : 'Nonaktif' }}
            </span>
          </td>
          <td class="row-actions">
            <button type="button" class="secondary" @click="startEdit(row)">Edit</button>
            <button type="button" class="secondary" @click="copyUrl(row.stationId)">Salin URL</button>
            <button type="button" class="secondary" @click="openPreview(row.stationId)">Preview</button>
            <button type="button" class="secondary" @click="showQr(row.stationId)">QR URL</button>
            <button
              type="button"
              :class="row.active ? 'danger' : ''"
              @click="
                toggleMutation.mutate({
                  id: row.stationId,
                  rowVersion: row.rowVersion,
                  activate: !row.active,
                })
              "
            >
              {{ row.active ? 'Nonaktifkan' : 'Aktifkan' }}
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
