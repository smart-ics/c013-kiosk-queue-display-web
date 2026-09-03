<script setup lang="ts">
import { ref, computed } from 'vue'
import { mapBackendErrorToUserMessage } from '@aq/api-client'
import type { JadwalItem, ServiceItem, ServiceSelection } from '@aq/shared-types'
import type { ServiceCatalog } from '../../lib/serviceCatalog'
import KioskPagination from '../../components/KioskPagination.vue'

const props = defineProps<{ catalog: ServiceCatalog; pending: boolean }>()
const emit = defineEmits<{ select: [selection: ServiceSelection]; back: [] }>()

const polis = ref<ServiceItem[]>([])
const dokterList = ref<ServiceItem[]>([])
const jadwals = ref<JadwalItem[]>([])

const selectedPoli = ref<ServiceItem | null>(null)
const selectedDokter = ref<ServiceItem | null>(null)

const loading = ref(false)
const loadError = ref<string | null>(null)

const currentPage = ref(1)
const ITEMS_PER_PAGE = 4

const totalPages = computed(() => {
  const list = selectedDokter.value
    ? jadwals.value
    : selectedPoli.value
      ? dokterList.value
      : polis.value
  return Math.ceil(list.length / ITEMS_PER_PAGE)
})

const visibleItems = computed(() => {
  const list = selectedDokter.value
    ? jadwals.value
    : selectedPoli.value
      ? dokterList.value
      : polis.value
  const start = (currentPage.value - 1) * ITEMS_PER_PAGE
  return list.slice(start, start + ITEMS_PER_PAGE)
})

async function loadPolis() {
  loading.value = true
  loadError.value = null
  currentPage.value = 1
  try {
    polis.value = await props.catalog.listPoli()
  } catch (error) {
    loadError.value = mapBackendErrorToUserMessage(error)
  } finally {
    loading.value = false
  }
}
void loadPolis()

async function choosePoli(poli: ServiceItem) {
  selectedPoli.value = poli
  dokterList.value = []
  selectedDokter.value = null
  jadwals.value = []
  loading.value = true
  loadError.value = null
  currentPage.value = 1
  try {
    dokterList.value = await props.catalog.listDokter(poli.id)
  } catch (error) {
    loadError.value = mapBackendErrorToUserMessage(error)
  } finally {
    loading.value = false
  }
}

async function chooseDokter(dokter: ServiceItem) {
  if (!selectedPoli.value) return
  loading.value = true
  loadError.value = null
  try {
    const list = await props.catalog.listJadwal(dokter.id)
    if (list.length === 1) {
      emit('select', { poli: selectedPoli.value, dokter, jadwal: list[0] })
    } else if (list.length > 1) {
      selectedDokter.value = dokter
      jadwals.value = list
      currentPage.value = 1
    } else {
      // Fallback default schedule if list is empty
      const currentHour = new Date().getHours()
      const jamPraktek = currentHour < 12 ? '08:00' : '14:00'
      const defaultJadwal: JadwalItem = {
        jadwalId: 'DEFAULT',
        ppaId: dokter.id,
        jamPraktek,
        sisaKuota: 99,
      }
      emit('select', { poli: selectedPoli.value, dokter, jadwal: defaultJadwal })
    }
  } catch (error) {
    loadError.value = mapBackendErrorToUserMessage(error)
  } finally {
    loading.value = false
  }
}

function chooseJadwal(jadwal: JadwalItem) {
  if (!selectedPoli.value || !selectedDokter.value) return
  emit('select', { poli: selectedPoli.value, dokter: selectedDokter.value, jadwal })
}

function handleBack() {
  if (selectedDokter.value) {
    selectedDokter.value = null
    jadwals.value = []
    currentPage.value = 1
  } else if (selectedPoli.value) {
    selectedPoli.value = null
    dokterList.value = []
    currentPage.value = 1
  } else {
    emit('back')
  }
}
</script>

<template>
  <section
    class="panel"
    style="
      background: transparent;
      border: none;
      box-shadow: none;
      padding: 0;
      width: 100%;
      max-width: 900px;
      height: 100%;
      display: flex;
      flex-direction: column;
    "
  >
    <h1 style="text-align: center; margin-bottom: 24px">
      {{
        selectedDokter
          ? 'Pilih Jadwal Praktek'
          : selectedPoli
            ? `Pilih Dokter - ${selectedPoli.name}`
            : 'Pilih Poliklinik'
      }}
    </h1>
    <p v-if="loadError" class="status error" style="text-align: center">{{ loadError }}</p>
    <p v-if="loading" class="status" style="text-align: center">Memuat data layanan…</p>

    <div
      class="step-content-area"
      style="
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        align-items: center;
        width: 100%;
        padding-bottom: 16px;
      "
    >
      <template v-if="!selectedPoli">
        <div class="kiosk-grid-2x2" style="padding-bottom: 24px">
          <button
            v-for="poli in visibleItems as ServiceItem[]"
            :key="poli.id"
            type="button"
            class="radio-card"
            :disabled="loading || pending"
            @click="choosePoli(poli)"
            style="min-height: 88px"
          >
            <div class="radio-card-icon">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M19 21V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v16" />
                <path d="M3 21h18" />
                <path d="M9 9h6v3H9zM9 15h6v3H9z" />
              </svg>
            </div>

            <div class="radio-card-content">
              <h4 class="radio-card-title">
                {{ poli.name }}
              </h4>
            </div>

            <div class="select-arrow">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="3"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <polyline points="13 17 18 12 13 7"></polyline>
                <polyline points="6 17 11 12 6 7"></polyline>
              </svg>
            </div>
          </button>
        </div>
      </template>

      <template v-else-if="selectedPoli && !selectedDokter">
        <div class="kiosk-grid-2x2" style="padding-bottom: 24px">
          <button
            v-for="dokter in visibleItems as ServiceItem[]"
            :key="dokter.id"
            type="button"
            class="radio-card"
            :disabled="loading || pending"
            @click="chooseDokter(dokter)"
            style="min-height: 88px"
          >
            <div class="radio-card-icon">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>

            <div class="radio-card-content">
              <h4 class="radio-card-title">
                {{ dokter.name }}
              </h4>
              <p class="radio-card-subtitle" v-if="dokter.isPraktekHariIni">
                <span class="quota-badge quota-high" style="margin-top: 0">Praktek Hari Ini</span>
              </p>
            </div>

            <div class="select-arrow">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="3"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <polyline points="13 17 18 12 13 7"></polyline>
                <polyline points="6 17 11 12 6 7"></polyline>
              </svg>
            </div>
          </button>
        </div>
      </template>

      <template v-else-if="selectedPoli && selectedDokter">
        <div class="kiosk-grid-2x2" style="padding-bottom: 24px">
          <button
            v-for="jadwal in visibleItems as JadwalItem[]"
            :key="jadwal.jadwalId"
            type="button"
            class="radio-card"
            :disabled="loading || pending"
            @click="chooseJadwal(jadwal)"
            style="min-height: 88px"
          >
            <div class="radio-card-icon">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>

            <div class="radio-card-content">
              <h4 class="radio-card-title">
                {{ jadwal.jamPraktek }}
              </h4>
              <p class="radio-card-subtitle">
                <span
                  class="quota-badge"
                  :class="{
                    'quota-high': jadwal.sisaKuota > 10,
                    'quota-low': jadwal.sisaKuota > 0 && jadwal.sisaKuota <= 10,
                    'quota-full': jadwal.sisaKuota === 0,
                  }"
                >
                  {{
                    jadwal.sisaKuota === 0
                      ? 'Kuota Penuh'
                      : `Sisa Kuota: ${jadwal.sisaKuota}`
                  }}
                </span>
              </p>
            </div>

            <div class="select-arrow">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="3"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <polyline points="13 17 18 12 13 7"></polyline>
                <polyline points="6 17 11 12 6 7"></polyline>
              </svg>
            </div>
          </button>
        </div>
      </template>
    </div>

    <!-- Pagination for navigation (flex-none) -->
    <KioskPagination
      v-model:currentPage="currentPage"
      :totalPages="totalPages"
      :pending="loading || pending"
      style="flex: none; margin: 16px 0"
    />

    <!-- Unified footer actions (flex-none, non-stacked) -->
    <div
      style="
        flex: none;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 16px;
        width: 100%;
        max-width: 600px;
        margin: 0 auto;
        padding-top: 16px;
        border-top: 1px solid var(--border-soft);
      "
    >
      <button
        v-if="selectedPoli"
        type="button"
        class="secondary-btn"
        @click="handleBack"
        style="min-width: 160px"
      >
        {{ selectedDokter ? 'Kembali ke Dokter' : 'Kembali ke Poli' }}
      </button>
      <button type="button" class="secondary-btn" @click="$emit('back')" style="min-width: 160px">
        Batal Registrasi
      </button>
    </div>
  </section>
</template>
