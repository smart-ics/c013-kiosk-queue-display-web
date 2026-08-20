<script setup lang="ts">
import type { BpjsReference } from '../../composables/useKioskRegistration'

defineProps<{
  references: BpjsReference[]
  pending: boolean
}>()

defineEmits<{
  select: [reference: BpjsReference]
  back: []
}>()
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
    <h1 style="text-align: center; margin-bottom: 24px">Pilih Rujukan / SKDP</h1>
    <p style="text-align: center; margin-bottom: 32px">
      Ditemukan lebih dari satu Rujukan atau SKDP aktif. Silakan pilih salah satu untuk melanjutkan
      pendaftaran.
    </p>

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
      <div class="kiosk-grid-2x2" style="padding-bottom: 24px">
        <button
          v-for="ref in references"
          :key="ref.id"
          type="button"
          class="radio-card"
          :disabled="pending"
          @click="$emit('select', ref)"
          style="min-height: 100px; text-align: left; align-items: flex-start; padding: 16px"
          :data-testid="`reference-item-${ref.id}`"
        >
          <div class="radio-card-icon" style="margin-top: 2px">
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
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <line x1="7" y1="8" x2="17" y2="8" />
              <line x1="7" y1="12" x2="17" y2="12" />
              <line x1="7" y1="16" x2="13" y2="16" />
            </svg>
          </div>

          <div class="radio-card-content" style="flex: 1; min-width: 0">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px">
              <span
                :style="{
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  backgroundColor: ref.type === 'skdp' ? '#dcfce7' : '#e0f2fe',
                  color: ref.type === 'skdp' ? '#15803d' : '#0369a1',
                }"
              >
                {{ ref.type.toUpperCase() }}
              </span>
              <span style="font-weight: 600; font-size: 16px; color: var(--text)">{{
                ref.id
              }}</span>
            </div>
            <p
              style="
                font-size: 13px;
                color: var(--text-secondary);
                margin: 2px 0;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
              "
            >
              Tanggal: {{ ref.date || '-' }}
            </p>
            <p
              style="
                font-size: 13px;
                color: var(--text-secondary);
                margin: 2px 0;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
              "
              v-if="ref.diagnosaId"
            >
              Poli/Diagnosa: {{ ref.diagnosaId }} - {{ ref.diagnosaName || '-' }}
            </p>
          </div>

          <div class="select-arrow" style="align-self: center">
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

    <!-- Actions Area -->
    <div
      class="actions-footer"
      style="
        display: flex;
        justify-content: center;
        width: 100%;
        padding-top: 16px;
        border-top: 1px solid var(--border);
      "
    >
      <button
        type="button"
        class="secondary-btn"
        :disabled="pending"
        @click="$emit('back')"
        style="min-width: 160px"
      >
        Kembali
      </button>
    </div>
  </section>
</template>
