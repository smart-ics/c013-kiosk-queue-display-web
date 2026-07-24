<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { getConfigurationApi } from '@/infrastructure'

const api = getConfigurationApi()
const queryClient = useQueryClient()
const selectedDisplayId = ref('')
const selectedLokets = ref<string[]>([])
const error = ref('')

const segmentationQuery = useQuery({
  queryKey: ['config-segmentation'],
  queryFn: () => api.getSegmentation(),
})

const displaysQuery = useQuery({
  queryKey: ['config-displays'],
  queryFn: () => api.listDisplays(),
})

const selectedDisplay = computed(() =>
  displaysQuery.data.value?.find((d) => d.displayId === selectedDisplayId.value),
)

watch(selectedDisplay, (display) => {
  selectedLokets.value = (display?.lokets ?? []).map((x) => x.loketKey)
})

function toggleLoket(loketKey: string) {
  if (selectedLokets.value.includes(loketKey)) {
    selectedLokets.value = selectedLokets.value.filter((x) => x !== loketKey)
  } else {
    selectedLokets.value = [...selectedLokets.value, loketKey]
  }
}

const saveMutation = useMutation({
  mutationFn: async () => {
    const display = selectedDisplay.value
    if (!display) throw new Error('Pilih display terlebih dahulu')
    if (display.active && selectedLokets.value.length === 0) {
      throw new Error('Display aktif wajib memiliki minimal satu loket')
    }
    return api.replaceDisplayLokets(display.displayId, {
      rowVersion: display.rowVersion,
      lokets: selectedLokets.value.map((loketKey, sortOrder) => ({ loketKey, sortOrder })),
    })
  },
  onSuccess: async () => {
    await queryClient.invalidateQueries({ queryKey: ['config-displays'] })
    await queryClient.invalidateQueries({ queryKey: ['config-segmentation'] })
    await queryClient.invalidateQueries({ queryKey: ['config-summary'] })
    error.value = ''
  },
  onError: (err: Error) => {
    error.value = err.message
  },
})

const matrix = computed(() => {
  const data = segmentationQuery.data.value
  if (!data) return []
  return data.loketKeys.map((loketKey) => ({
    loketKey,
    cells: data.displays.map((display) => ({
      displayId: display.displayId,
      checked: display.loketKeys.includes(loketKey),
    })),
  }))
})
</script>

<template>
  <div class="stack">
    <h2 style="margin: 0">Segmentasi</h2>
    <p class="muted" style="margin: 0">
      Satu loket boleh tampil di banyak display. Simpan mapping secara atomik per display.
    </p>

    <label>
      Display
      <select v-model="selectedDisplayId">
        <option value="">— pilih —</option>
        <option v-for="d in displaysQuery.data.value ?? []" :key="d.displayId" :value="d.displayId">
          {{ d.displayName }} ({{ d.displayId }})
        </option>
      </select>
    </label>

    <div v-if="selectedDisplay" class="stack">
      <div class="form-grid">
        <label v-for="loketKey in segmentationQuery.data.value?.loketKeys ?? []" :key="loketKey">
          <span style="display: flex; gap: 0.5rem; align-items: center">
            <input
              type="checkbox"
              :checked="selectedLokets.includes(loketKey)"
              @change="toggleLoket(loketKey)"
            />
            {{ loketKey }}
          </span>
        </label>
      </div>
      <p v-if="error" class="error">{{ error }}</p>
      <button type="button" :disabled="saveMutation.isPending.value" @click="saveMutation.mutate()">
        Simpan mapping
      </button>
    </div>

    <h3>Matriks cakupan</h3>
    <table class="table">
      <thead>
        <tr>
          <th>Loket</th>
          <th v-for="d in segmentationQuery.data.value?.displays ?? []" :key="d.displayId">
            {{ d.displayName }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in matrix" :key="row.loketKey">
          <td>{{ row.loketKey }}</td>
          <td v-for="cell in row.cells" :key="cell.displayId" style="text-align: center">
            {{ cell.checked ? '✓' : '' }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
