<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import type { AdmissionServicePoint } from '@aq/shared-types'
import { getAdmissionQueueApi } from '@/infrastructure'

const admissionApi = getAdmissionQueueApi()
const queryClient = useQueryClient()
const error = ref('')
const editingId = ref<string | null>(null)
const editingStatus = ref<AdmissionServicePoint['status']>('Active')

const form = reactive({
  servicePointId: '',
  displayName: '',
  queuePrefix: '',
  active: true,
})

const listQuery = useQuery({
  queryKey: ['config-service-points'],
  queryFn: () => admissionApi.listAllServicePoints(),
})

function resetForm() {
  editingId.value = null
  editingStatus.value = 'Active'
  form.servicePointId = ''
  form.displayName = ''
  form.queuePrefix = ''
  form.active = true
  error.value = ''
}

function startEdit(row: AdmissionServicePoint) {
  editingId.value = row.servicePointId
  editingStatus.value = row.status
  form.servicePointId = row.servicePointId
  form.displayName = row.displayName
  form.queuePrefix = row.queuePrefix
  form.active = row.status === 'Active'
  error.value = ''
}

const saveMutation = useMutation({
  mutationFn: async () => {
    if (editingId.value) {
      return admissionApi.upsertServicePoint(editingId.value, {
        displayName: form.displayName,
        queuePrefix: form.queuePrefix,
        active: editingStatus.value === 'Active',
      })
    }
    return admissionApi.upsertServicePoint(form.servicePointId, {
      displayName: form.displayName,
      queuePrefix: form.queuePrefix,
      active: form.active,
    })
  },
  onSuccess: async () => {
    await queryClient.invalidateQueries({ queryKey: ['config-service-points'] })
    resetForm()
  },
  onError: (err: Error) => {
    error.value = err.message
  },
})

const retireMutation = useMutation({
  mutationFn: (row: AdmissionServicePoint) =>
    admissionApi.upsertServicePoint(row.servicePointId, {
      displayName: row.displayName,
      queuePrefix: row.queuePrefix,
      active: false,
    }),
  onSuccess: async () => {
    await queryClient.invalidateQueries({ queryKey: ['config-service-points'] })
    resetForm()
  },
  onError: (err: Error) => {
    error.value = err.message
  },
})
</script>

<template>
  <div class="stack">
    <div class="row-actions" style="justify-content: space-between">
      <h2 style="margin: 0">Service Point</h2>
      <div v-if="!editingId" class="row-actions">
        <button type="button" class="secondary" @click="resetForm">Batal</button>
        <button type="button" @click="saveMutation.mutate()">Buat</button>
      </div>
    </div>

    <form class="stack" @submit.prevent="saveMutation.mutate()">
      <div class="form-grid">
        <label>
          ServicePointId
          <input v-model="form.servicePointId" :disabled="!!editingId" required maxlength="50" />
        </label>
        <label>
          Nama
          <input v-model="form.displayName" required />
        </label>
        <label>
          QueuePrefix (satu huruf)
          <input
            v-model="form.queuePrefix"
            required
            maxlength="1"
            pattern="[A-Z]"
            title="Harus satu huruf kapital A–Z"
          />
        </label>
        <label v-if="!editingId">
          Aktif saat create
          <select v-model="form.active">
            <option :value="true">Ya</option>
            <option :value="false">Tidak</option>
          </select>
        </label>
      </div>

      <p v-if="editingId && editingStatus === 'Retired'" class="muted">
        Service point ini retired dan tidak dapat diaktifkan kembali melalui aplikasi ini.
      </p>

      <p v-if="error" class="error">{{ error }}</p>
      <button type="submit" :disabled="saveMutation.isPending.value">
        {{ editingId ? 'Simpan service point' : 'Buat service point' }}
      </button>
    </form>

    <table class="table">
      <thead>
        <tr>
          <th>ServicePointId</th>
          <th>Nama</th>
          <th>QueuePrefix</th>
          <th>Status</th>
          <th>Aksi</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in listQuery.data.value ?? []" :key="row.servicePointId">
          <td><code>{{ row.servicePointId }}</code></td>
          <td>{{ row.displayName }}</td>
          <td>{{ row.queuePrefix }}</td>
          <td>
            <span class="badge" :class="{ inactive: row.status !== 'Active' }">
              {{ row.status }}
            </span>
          </td>
          <td class="row-actions">
            <button type="button" class="secondary" @click="startEdit(row)">Edit</button>
            <button
              v-if="row.status === 'Active'"
              type="button"
              class="danger"
              @click="retireMutation.mutate(row)"
            >
              Nonaktifkan
            </button>
            <span v-else class="muted">tidak dapat diaktifkan kembali melalui aplikasi ini</span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>