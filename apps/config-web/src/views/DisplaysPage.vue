<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import QRCode from 'qrcode'
import {
  buildCanonicalDisplayUrl,
  buildPreviewDisplayUrl,
  getConfigurationApi,
} from '@/infrastructure'

const api = getConfigurationApi()
const queryClient = useQueryClient()
const error = ref('')
const editingId = ref<string | null>(null)
const qrDataUrl = ref('')
const qrFor = ref('')

const form = reactive({
  displayId: '',
  displayName: '',
  locationName: '',
  active: true,
  audioEnabled: true,
  pollIntervalMs: 15000,
  layoutKey: 'default',
  notes: '',
  loketKeysText: '',
  rowVersion: '',
})

const listQuery = useQuery({
  queryKey: ['config-displays'],
  queryFn: () => api.listDisplays(),
})

const loketPreview = computed(() =>
  form.loketKeysText
    .split(/[\n,]/)
    .map((x) => x.trim())
    .filter(Boolean)
    .map((loketKey, sortOrder) => ({ loketKey, sortOrder })),
)

function resetForm() {
  editingId.value = null
  form.displayId = ''
  form.displayName = ''
  form.locationName = ''
  form.active = true
  form.audioEnabled = true
  form.pollIntervalMs = 15000
  form.layoutKey = 'default'
  form.notes = ''
  form.loketKeysText = ''
  form.rowVersion = ''
  error.value = ''
  qrDataUrl.value = ''
  qrFor.value = ''
}

function startEdit(row: {
  displayId: string
  displayName: string
  locationName?: string | null
  audioEnabled: boolean
  pollIntervalMs: number
  layoutKey?: string | null
  notes?: string | null
  lokets?: { loketKey: string; sortOrder?: number }[]
  rowVersion: string
}) {
  editingId.value = row.displayId
  form.displayId = row.displayId
  form.displayName = row.displayName
  form.locationName = row.locationName ?? ''
  form.audioEnabled = row.audioEnabled
  form.pollIntervalMs = row.pollIntervalMs
  form.layoutKey = row.layoutKey ?? 'default'
  form.notes = row.notes ?? ''
  form.loketKeysText = (row.lokets ?? []).map((x) => x.loketKey).join('\n')
  form.rowVersion = row.rowVersion
  error.value = ''
}

async function copyUrl(displayId: string) {
  await navigator.clipboard.writeText(buildCanonicalDisplayUrl(displayId))
}

function openPreview(displayId: string) {
  window.open(buildPreviewDisplayUrl(displayId), '_blank', 'noopener,noreferrer')
}

async function showQr(displayId: string) {
  const url = buildCanonicalDisplayUrl(displayId)
  qrFor.value = url
  qrDataUrl.value = await QRCode.toDataURL(url, { margin: 1, width: 220 })
}

const saveMutation = useMutation({
  mutationFn: async () => {
    if (editingId.value) {
      const updated = await api.updateDisplay(editingId.value, {
        displayName: form.displayName,
        locationName: form.locationName || null,
        audioEnabled: form.audioEnabled,
        pollIntervalMs: form.pollIntervalMs,
        layoutKey: form.layoutKey || null,
        notes: form.notes || null,
        rowVersion: form.rowVersion,
      })
      return api.replaceDisplayLokets(editingId.value, {
        lokets: loketPreview.value,
        rowVersion: updated.rowVersion,
      })
    }
    return api.createDisplay({
      displayId: form.displayId,
      displayName: form.displayName,
      locationName: form.locationName || null,
      active: form.active,
      audioEnabled: form.audioEnabled,
      pollIntervalMs: form.pollIntervalMs,
      layoutKey: form.layoutKey || null,
      notes: form.notes || null,
      lokets: loketPreview.value,
    })
  },
  onSuccess: async () => {
    await queryClient.invalidateQueries({ queryKey: ['config-displays'] })
    await queryClient.invalidateQueries({ queryKey: ['config-summary'] })
    await queryClient.invalidateQueries({ queryKey: ['config-segmentation'] })
    resetForm()
  },
  onError: (err: Error) => {
    error.value = err.message
  },
})

const toggleMutation = useMutation({
  mutationFn: async (payload: { id: string; activate: boolean }) =>
    payload.activate ? api.activateDisplay(payload.id) : api.deactivateDisplay(payload.id),
  onSuccess: async () => {
    await queryClient.invalidateQueries({ queryKey: ['config-displays'] })
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
      <h2 style="margin: 0">Queue Display</h2>
      <button type="button" class="secondary" @click="resetForm">Baru</button>
    </div>

    <form class="stack" @submit.prevent="saveMutation.mutate()">
      <div class="form-grid">
        <label>
          DisplayId
          <input v-model="form.displayId" :disabled="!!editingId" required maxlength="50" />
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
          Poll interval (ms)
          <input v-model.number="form.pollIntervalMs" type="number" min="1000" max="120000" required />
        </label>
        <label>
          Audio
          <select v-model="form.audioEnabled">
            <option :value="true">Aktif</option>
            <option :value="false">Nonaktif</option>
          </select>
        </label>
        <label>
          Layout
          <input v-model="form.layoutKey" />
        </label>
        <label v-if="!editingId">
          Aktif saat create
          <select v-model="form.active">
            <option :value="true">Ya</option>
            <option :value="false">Tidak</option>
          </select>
        </label>
        <label style="grid-column: 1 / -1">
          Loket (satu per baris atau dipisah koma)
          <textarea v-model="form.loketKeysText" rows="4" />
        </label>
      </div>
      <p v-if="error" class="error">{{ error }}</p>
      <button type="submit" :disabled="saveMutation.isPending.value">
        {{ editingId ? 'Simpan display' : 'Buat display' }}
      </button>
    </form>

    <div v-if="qrDataUrl" class="stack">
      <strong>QR URL</strong>
      <code>{{ qrFor }}</code>
      <img :src="qrDataUrl" alt="QR display URL" width="220" height="220" />
    </div>

    <table class="table">
      <thead>
        <tr>
          <th>Nama</th>
          <th>DisplayId</th>
          <th>Loket</th>
          <th>Audio</th>
          <th>Status</th>
          <th>Aksi</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in listQuery.data.value ?? []" :key="row.displayId">
          <td>{{ row.displayName }}</td>
          <td><code>{{ row.displayId }}</code></td>
          <td>{{ (row.lokets ?? []).map((x) => x.loketKey).join(', ') || '—' }}</td>
          <td>{{ row.audioEnabled ? 'On' : 'Off' }}</td>
          <td>
            <span class="badge" :class="{ inactive: !row.active }">
              {{ row.active ? 'Aktif' : 'Nonaktif' }}
            </span>
          </td>
          <td class="row-actions">
            <button type="button" class="secondary" @click="startEdit(row)">Edit</button>
            <button type="button" class="secondary" @click="copyUrl(row.displayId)">Salin URL</button>
            <button type="button" class="secondary" @click="openPreview(row.displayId)">Preview</button>
            <button type="button" class="secondary" @click="showQr(row.displayId)">QR URL</button>
            <button
              type="button"
              :class="row.active ? 'danger' : ''"
              @click="toggleMutation.mutate({ id: row.displayId, activate: !row.active })"
            >
              {{ row.active ? 'Nonaktifkan' : 'Aktifkan' }}
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
