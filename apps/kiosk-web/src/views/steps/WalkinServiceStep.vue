<script setup lang="ts">
import { ref } from 'vue'
import type { JadwalItem, ServiceItem, ServiceSelection } from '@aq/shared-types'
import type { ServiceCatalog } from '../../lib/serviceCatalog'

const props = defineProps<{ catalog: ServiceCatalog; pending: boolean }>()
const emit = defineEmits<{ select: [selection: ServiceSelection]; back: [] }>()

const polis = ref<ServiceItem[]>([])
const dokterList = ref<ServiceItem[]>([])
const jadwalList = ref<JadwalItem[]>([])
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
  jadwalList.value = []
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

async function chooseDokter(dokter: ServiceItem) {
  selectedDokter.value = dokter
  jadwalList.value = []
  loading.value = true
  loadError.value = null
  try {
    jadwalList.value = await props.catalog.listJadwal(dokter.id)
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : 'Gagal memuat jadwal.'
  } finally {
    loading.value = false
  }
}

function chooseJadwal(jadwal: JadwalItem) {
  if (!selectedPoli.value || !selectedDokter.value) return
  emit('select', { poli: selectedPoli.value, dokter: selectedDokter.value, jadwal })
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

    <template v-else-if="!selectedDokter">
      <h2>Dokter — {{ selectedPoli.name }}</h2>
      <div class="sp-grid">
        <button v-for="dokter in dokterList" :key="dokter.id" type="button" class="sp-btn" :disabled="loading || pending" @click="chooseDokter(dokter)">
          {{ dokter.name }}
        </button>
      </div>
      <div class="actions">
        <button type="button" class="secondary-btn" @click="selectedPoli = null; dokterList = []; jadwalList = []">
          Kembali ke Poli
        </button>
      </div>
    </template>

    <template v-else>
      <h2>Jadwal — {{ selectedDokter.name }}</h2>
      <div class="sp-grid">
        <button
          v-for="jadwal in jadwalList"
          :key="jadwal.jadwalId"
          type="button"
          class="sp-btn"
          :disabled="jadwal.sisaKuota <= 0 || loading || pending"
          @click="chooseJadwal(jadwal)"
        >
          {{ jadwal.jamPraktek }}
          <small>{{ jadwal.sisaKuota }} slot</small>
        </button>
      </div>
      <div class="actions">
        <button type="button" class="secondary-btn" @click="selectedDokter = null; jadwalList = []">
          Kembali ke Dokter
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
