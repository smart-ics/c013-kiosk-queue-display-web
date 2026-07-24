<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { getConfigurationApi } from '@/infrastructure'

const api = getConfigurationApi()
const queryClient = useQueryClient()
const error = ref('')
const editingKey = ref<string | null>(null)

const form = reactive({
  workstationKey: '',
  displayName: '',
  locationName: '',
  loketKey: '',
  active: true,
  notes: '',
  rowVersion: '',
})

const listQuery = useQuery({
  queryKey: ['config-workstations'],
  queryFn: () => api.listWorkstations(),
})

function resetForm() {
  editingKey.value = null
  form.workstationKey = ''
  form.displayName = ''
  form.locationName = ''
  form.loketKey = ''
  form.active = true
  form.notes = ''
  form.rowVersion = ''
  error.value = ''
}

function startEdit(row: {
  workstationKey: string
  displayName: string
  locationName?: string | null
  loketKey: string
  notes?: string | null
  rowVersion: string
}) {
  editingKey.value = row.workstationKey
  form.workstationKey = row.workstationKey
  form.displayName = row.displayName
  form.locationName = row.locationName ?? ''
  form.loketKey = row.loketKey
  form.notes = row.notes ?? ''
  form.rowVersion = row.rowVersion
  error.value = ''
}

const saveMutation = useMutation({
  mutationFn: async () => {
    if (editingKey.value) {
      if (
        form.loketKey !==
          listQuery.data.value?.find((x) => x.workstationKey === editingKey.value)?.loketKey &&
        !window.confirm('Mengubah Loket akan memengaruhi Call dari workstation ini. Lanjutkan?')
      ) {
        throw new Error('Dibatalkan')
      }
      return api.updateWorkstation(editingKey.value, {
        displayName: form.displayName,
        locationName: form.locationName || null,
        loketKey: form.loketKey,
        notes: form.notes || null,
        rowVersion: form.rowVersion,
      })
    }
    return api.createWorkstation({
      workstationKey: form.workstationKey,
      displayName: form.displayName,
      locationName: form.locationName || null,
      loketKey: form.loketKey,
      active: form.active,
      notes: form.notes || null,
    })
  },
  onSuccess: async () => {
    await queryClient.invalidateQueries({ queryKey: ['config-workstations'] })
    await queryClient.invalidateQueries({ queryKey: ['config-summary'] })
    resetForm()
  },
  onError: (err: Error) => {
    error.value = err.message
  },
})

const toggleMutation = useMutation({
  mutationFn: async (payload: { key: string; activate: boolean }) =>
    payload.activate ? api.activateWorkstation(payload.key) : api.deactivateWorkstation(payload.key),
  onSuccess: async () => {
    await queryClient.invalidateQueries({ queryKey: ['config-workstations'] })
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
      <h2 style="margin: 0">Workstation</h2>
      <button type="button" class="secondary" @click="resetForm">Baru</button>
    </div>

    <form class="stack" @submit.prevent="saveMutation.mutate()">
      <div class="form-grid">
        <label>
          WorkstationKey
          <input v-model="form.workstationKey" :disabled="!!editingKey" required maxlength="50" />
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
          LoketKey
          <input v-model="form.loketKey" required maxlength="50" />
        </label>
        <label v-if="!editingKey">
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
      <p v-if="error" class="error">{{ error }}</p>
      <button type="submit" :disabled="saveMutation.isPending.value">
        {{ editingKey ? 'Simpan perubahan' : 'Buat workstation' }}
      </button>
    </form>

    <p v-if="listQuery.isLoading.value" class="muted">Memuat daftar…</p>
    <table v-else class="table">
      <thead>
        <tr>
          <th>Nama</th>
          <th>Key</th>
          <th>Lokasi</th>
          <th>Loket</th>
          <th>Status</th>
          <th>Aksi</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in listQuery.data.value ?? []" :key="row.workstationKey">
          <td>{{ row.displayName }}</td>
          <td><code>{{ row.workstationKey }}</code></td>
          <td>{{ row.locationName || '—' }}</td>
          <td>{{ row.loketKey }}</td>
          <td>
            <span class="badge" :class="{ inactive: !row.active }">
              {{ row.active ? 'Aktif' : 'Nonaktif' }}
            </span>
          </td>
          <td class="row-actions">
            <button type="button" class="secondary" @click="startEdit(row)">Edit</button>
            <button
              type="button"
              :class="row.active ? 'danger' : ''"
              @click="toggleMutation.mutate({ key: row.workstationKey, activate: !row.active })"
            >
              {{ row.active ? 'Nonaktifkan' : 'Aktifkan' }}
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
