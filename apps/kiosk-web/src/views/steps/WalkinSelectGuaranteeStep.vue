<script setup lang="ts">
import { computed } from 'vue'
import type { Polis } from '@aq/shared-types'
import { UMAT_TIPE_JAMINAN_ID } from '../../lib/eligibility'

const props = defineProps<{
  policies: Polis[]
  pending: boolean
}>()

const emit = defineEmits<{
  select: [
    jaminan: {
      tipeJaminanId: string
      tipeJaminanName: string
      noPeserta: string | null
    },
  ]
  back: []
}>()

const filteredPolicies = computed(() => {
  return props.policies.filter(p => {
    const name = (p.tipeJaminan?.tipeJaminanName || '').toLowerCase()
    const id = (p.tipeJaminan?.tipeJaminanId || '').toLowerCase()
    return name.includes('bpjs') || name.includes('jkn') || id.includes('bpjs') || id.includes('jkn')
  })
})

const hasBpjsPolicy = computed(() => filteredPolicies.value.length > 0)

function chooseUmum() {
  emit('select', {
    tipeJaminanId: UMAT_TIPE_JAMINAN_ID,
    tipeJaminanName: 'Umum',
    noPeserta: null,
  })
}

function chooseFallbackBpjs() {
  emit('select', {
    tipeJaminanId: 'BPJS_FALLBACK',
    tipeJaminanName: 'BPJS',
    noPeserta: null,
  })
}

function choosePolicy(policy: Polis) {
  emit('select', {
    tipeJaminanId: policy.tipeJaminan.tipeJaminanId,
    tipeJaminanName: policy.tipeJaminan.tipeJaminanName,
    noPeserta: policy.noPolis,
  })
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
    <h1 style="text-align: center; margin-bottom: 24px">Pilih Penjamin / Jaminan</h1>
    <p style="text-align: center; margin-bottom: 32px">
      Silakan pilih jaminan kesehatan yang ingin Anda gunakan untuk berobat.
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
        <!-- Hardcoded General option 'Umum' -->
        <button
          type="button"
          class="radio-card"
          :disabled="pending"
          @click="chooseUmum"
          style="min-height: 88px"
          data-testid="guarantee-umum"
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
              <rect x="2" y="4" width="20" height="16" rx="2" ry="2" />
              <line x1="12" y1="18" x2="12" y2="18" />
              <line x1="12" y1="6" x2="12" y2="18" />
            </svg>
          </div>

          <div class="radio-card-content">
            <h4 class="radio-card-title">Umum</h4>
            <p class="radio-card-subtitle">Pasien Mandiri / Pembayaran Tunai</p>
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

        <!-- Active policies listed for the patient -->
        <button
          v-for="policy in filteredPolicies"
          :key="policy.polisId"
          type="button"
          class="radio-card"
          :disabled="pending"
          @click="choosePolicy(policy)"
          style="min-height: 88px"
          :data-testid="`guarantee-policy-${policy.tipeJaminan.tipeJaminanId}`"
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
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <line x1="7" y1="8" x2="17" y2="8" />
              <line x1="7" y1="12" x2="17" y2="12" />
              <line x1="7" y1="16" x2="13" y2="16" />
            </svg>
          </div>

          <div class="radio-card-content">
            <h4 class="radio-card-title">{{ policy.tipeJaminan.tipeJaminanName }}</h4>
            <p class="radio-card-subtitle">No. Kartu: {{ policy.noPolis }}</p>
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

        <!-- Fallback BPJS option if no BPJS/JKN policy exists in hospital database -->
        <button
          v-if="!hasBpjsPolicy"
          type="button"
          class="radio-card"
          :disabled="pending"
          @click="chooseFallbackBpjs"
          style="min-height: 88px"
          data-testid="guarantee-bpjs-fallback"
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
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <line x1="7" y1="8" x2="17" y2="8" />
              <line x1="7" y1="12" x2="17" y2="12" />
              <line x1="7" y1="16" x2="13" y2="16" />
            </svg>
          </div>

          <div class="radio-card-content">
            <h4 class="radio-card-title">BPJS Kesehatan</h4>
            <p class="radio-card-subtitle">Pendaftaran menggunakan jaminan BPJS / JKN</p>
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
