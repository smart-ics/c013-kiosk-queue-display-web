<script setup lang="ts">
import type { AdmissionQueueIntakeResponse } from '@aq/shared-types'

defineProps<{
  ticket: AdmissionQueueIntakeResponse
  title: string
  servicePointName?: string
  printPending: boolean
  printSucceeded: boolean
  printError: string | null
}>()
defineEmits<{ reprint: []; finish: [] }>()
</script>

<template>
  <section class="panel" style="background: transparent; border: none; box-shadow: none; padding-top: 0;">
    <h1 style="text-align: center;">{{ title }}</h1>
    <p v-if="servicePointName" style="text-align: center; font-size: 1.2rem; margin-bottom: 0;">Layanan: {{ servicePointName }}</p>

    <div class="hero-queue-container">
      <div class="hero-queue-number" data-testid="assist-queue-label">{{ ticket.queueLabel }}</div>
      <div style="margin-top: 16px; background: var(--color-surface-card); padding: 8px 24px; border-radius: 99px; border: 1px solid var(--border); font-weight: 600; color: var(--text-secondary);">
        Urut {{ ticket.noUrut }} · ID {{ ticket.antrianId }}
      </div>
    </div>
    
    <div style="min-height: 48px; display: flex; justify-content: center; margin-bottom: 24px;">
      <p v-if="printPending" class="status" style="margin: 0; padding: 12px 24px; background: var(--color-surface-bg); border-radius: 12px; color: var(--color-primary);">🖨️ Sedang mencetak tiket…</p>
      <p v-else-if="printSucceeded && !printError" class="status ok" style="margin: 0; padding: 12px 24px; background: var(--ok); color: white; border-radius: 12px;" data-testid="assist-print-ok">
        ✓ Tiket berhasil dicetak. Silakan ambil tiket Anda.
      </p>
      <p v-if="printError" class="status error" style="margin: 0; padding: 12px 24px; background: var(--danger); color: white; border-radius: 12px;" data-testid="assist-print-error">
        ⚠️ {{ printError }}
      </p>
    </div>

    <div class="actions" style="justify-content: center; border-top: 1px solid var(--border); padding-top: 32px;">
      <button type="button" class="secondary-btn" :disabled="printPending" data-testid="assist-reprint" @click="$emit('reprint')" style="min-width: 160px;">
        Cetak ulang
      </button>
      <button type="button" class="sp-btn" :disabled="printPending" data-testid="assist-finish" @click="$emit('finish')" style="min-width: 240px;">
        Selesai
      </button>
    </div>
  </section>
</template>

