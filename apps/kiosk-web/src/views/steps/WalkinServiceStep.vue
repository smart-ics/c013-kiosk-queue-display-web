<script setup lang="ts">
import { ref } from 'vue'
import type { JadwalItem, ServiceItem, ServiceSelection } from '@aq/shared-types'
import type { ServiceCatalog } from '../../lib/serviceCatalog'

const props = defineProps<{ catalog: ServiceCatalog; pending: boolean }>()
const emit = defineEmits<{ select: [selection: ServiceSelection]; back: [] }>()

const polis = ref<ServiceItem[]>([])
const dokterList = ref<ServiceItem[]>([])
const selectedPoli = ref<ServiceItem | null>(null)
const selectedDokter = ref<ServiceItem | null>(null)
const loading = ref(false)
const loadError = ref<string | null>(null)

async function loadPolis() {
  loading.value = true
  loadError.value = null
  try {
    polis.value = await props.catalog.listPoli()
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : 'Gagal memuat poli.'
  } finally {
    loading.value = false
  }
}
void loadPolis()

async function choosePoli(poli: ServiceItem) {
  selectedPoli.value = poli
  dokterList.value = []
  selectedDokter.value = null
  loading.value = true
  loadError.value = null
  try {
    dokterList.value = await props.catalog.listDokter(poli.id)
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : 'Gagal memuat dokter.'
  } finally {
    loading.value = false
  }
}

function chooseDokter(dokter: ServiceItem) {
  if (!selectedPoli.value) return
  selectedDokter.value = dokter

  const currentHour = new Date().getHours()
  const jamPraktek = currentHour < 12 ? '08:00' : '14:00'

  const jadwal: JadwalItem = {
    jadwalId: 'DEFAULT',
    ppaId: dokter.id,
    jamPraktek,
    sisaKuota: 99,
  }
  emit('select', { poli: selectedPoli.value, dokter, jadwal })
}
</script>

<template>
  <section class="panel">
    <h1>Pilih Layanan</h1>
    <p v-if="loadError" class="status error">{{ loadError }}</p>
    <p v-if="loading" class="status">Memuat…</p>

    <template v-if="!selectedPoli">
      <h2>Poli</h2>
      <div class="sp-grid">
        <button v-for="poli in polis" :key="poli.id" type="button" class="sp-btn" :disabled="loading || pending" @click="choosePoli(poli)">
          {{ poli.name }}
        </button>
      </div>
    </template>

    <template v-else>
      <h2>Dokter — {{ selectedPoli.name }}</h2>
      <div class="sp-grid">
        <button v-for="dokter in dokterList" :key="dokter.id" type="button" class="sp-btn" :disabled="loading || pending" @click="chooseDokter(dokter)">
          {{ dokter.name }}
        </button>
      </div>
      <div class="actions">
        <button type="button" class="secondary-btn" @click="selectedPoli = null; dokterList = []">
          Kembali ke Poli
        </button>
      </div>
    </template>

    <div class="actions">
      <button type="button" class="secondary-btn" @click="$emit('back')">
        Batal
      </button>
    </div>
  </section>
</template>
