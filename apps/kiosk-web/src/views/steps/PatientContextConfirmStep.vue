<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { PatientContextItem } from '@aq/shared-types'
import KioskPagination from '../../components/KioskPagination.vue'

const props = defineProps<{
  bestMatch: PatientContextItem | null
  patients: PatientContextItem[]
  pending: boolean
}>()

const emit = defineEmits<{
  confirm: [item: PatientContextItem]
  intake: []
  retry: []
}>()

const currentPage = ref(1)

watch(
  [() => props.patients, () => props.bestMatch],
  () => {
    currentPage.value = 1
  },
  { deep: true },
)

const unifiedPatients = computed(() => {
  const list = [...props.patients]
  if (
    props.bestMatch &&
    !list.some((p) => p.id === props.bestMatch?.id && p.patientId === props.bestMatch?.patientId)
  ) {
    list.unshift(props.bestMatch)
  }
  return list
})

const ITEMS_PER_PAGE = 3

const totalPages = computed(() => {
  return Math.ceil(unifiedPatients.value.length / ITEMS_PER_PAGE)
})

const paginatedPatients = computed(() => {
  const start = (currentPage.value - 1) * ITEMS_PER_PAGE
  return unifiedPatients.value.slice(start, start + ITEMS_PER_PAGE)
})

function disambiguator(item: PatientContextItem): string {
  return item.maskedNik || item.id || item.patientId || ''
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
      height: 100%;
      display: flex;
      flex-direction: column;
      width: 100%;
    "
  >
    <!-- Header (flex-none) -->
    <h1 style="text-align: center; margin-bottom: 24px; flex: none">Pilih Data Pasien</h1>

    <!-- Content Area (flex-grow, internally scrollable, min-height 0) -->
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
      <div
        v-if="unifiedPatients.length > 0"
        class="context-list-section"
        style="width: 100%; max-width: 600px; margin: 0"
      >
        <div class="sp-grid" style="grid-template-columns: 1fr; gap: 16px">
          <button
            v-for="item in paginatedPatients"
            :key="item.id"
            type="button"
            class="radio-card"
            :disabled="pending"
            :data-testid="`patient-${item.id}`"
            @click="emit('confirm', item)"
            style="padding: 20px 24px; min-height: 88px"
          >
            <div
              class="radio-card-content"
              style="display: flex; flex-direction: column; align-items: flex-start"
            >
              <span
                v-if="
                  bestMatch && item.id === bestMatch.id && item.patientId === bestMatch.patientId
                "
                class="context-card-badge"
                style="background: var(--brand-strong); margin: 0 0 6px 0; font-size: 0.75rem"
              >
                Paling Cocok
              </span>

              <h4 class="radio-card-title" style="margin: 0; font-size: 1.25rem">
                {{ item.patientName }}
              </h4>

              <div
                class="patient-meta-row"
                style="display: flex; flex-wrap: wrap; gap: 14px; margin-top: 8px"
              >
                <!-- Gender Info -->
                <span
                  style="
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    font-size: 0.9rem;
                    color: var(--text-secondary);
                  "
                >
                  <svg
                    v-if="item.gender === 'L' || item.gender === 'M'"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#2563eb"
                    stroke-width="3"
                  >
                    <circle cx="10" cy="14" r="5" />
                    <path d="M14 10l6-6M14 4h6v6" />
                  </svg>
                  <svg
                    v-else-if="item.gender === 'P' || item.gender === 'F'"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#db2777"
                    stroke-width="3"
                  >
                    <circle cx="12" cy="9" r="5" />
                    <path d="M12 14v7M9 18h6" />
                  </svg>
                  <span v-else style="color: var(--text-tertiary); font-weight: bold">?</span>
                  <span>{{
                    item.gender === 'L' || item.gender === 'M'
                      ? 'Laki-laki'
                      : item.gender === 'P' || item.gender === 'F'
                        ? 'Perempuan'
                        : 'Gender N/A'
                  }}</span>
                </span>

                <!-- BirthDate Info -->
                <span
                  v-if="item.birthDate"
                  style="
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    font-size: 0.9rem;
                    color: var(--text-secondary);
                  "
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  <span>{{ item.birthDate }}</span>
                </span>

                <!-- NIK / MR Info -->
                <span
                  style="
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    font-size: 0.9rem;
                    color: var(--text-secondary);
                  "
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <rect x="2" y="5" width="20" height="14" rx="2" />
                    <path d="M6 10h4v4H6zM14 10h4M14 14h4" />
                  </svg>
                  <span>{{ disambiguator(item) }}</span>
                </span>
              </div>
            </div>

            <div
              class="select-arrow"
              style="
                color: var(--brand-strong);
                flex: none;
                display: flex;
                align-items: center;
                justify-content: center;
                padding-left: 12px;
              "
            >
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
      </div>

      <p
        v-if="!bestMatch && patients.length === 0 && pending"
        class="status"
        style="text-align: center"
      >
        Mencari data pasien…
      </p>
    </div>

    <!-- Pagination Area (flex-none) -->
    <KioskPagination
      v-model:currentPage="currentPage"
      :totalPages="totalPages"
      :pending="pending"
      style="flex: none; margin: 16px 0"
    />

    <!-- Unified escape actions layout (flex-none, non-stacked) -->
    <div
      style="
        flex: none;
        display: flex;
        align-items: center;
        justify-content: space-between;
        width: 100%;
        max-width: 600px;
        margin: 0 auto;
        padding-top: 16px;
        border-top: 1px solid var(--border-soft);
      "
    >
      <button
        type="button"
        style="
          appearance: none;
          background: transparent;
          border: none;
          color: var(--text-tertiary);
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
        "
        :disabled="pending"
        data-testid="retry-search"
        @click="emit('retry')"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <polyline points="1 4 1 10 7 10"></polyline>
          <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
        </svg>
        <span>Cari Ulang</span>
      </button>

      <button
        type="button"
        style="
          appearance: none;
          background: var(--surface);
          border: 1.5px solid var(--brand-soft);
          border-radius: var(--radius-md, 12px);
          color: var(--brand-strong);
          font-size: 1rem;
          font-weight: 700;
          cursor: pointer;
          padding: 12px 20px;
          transition: all 120ms ease;
        "
        :disabled="pending"
        data-testid="take-intake"
        @click="emit('intake')"
      >
        Ambil Antrian Pendaftaran
      </button>
    </div>
  </section>
</template>
