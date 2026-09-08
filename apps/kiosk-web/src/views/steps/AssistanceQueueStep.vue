<script setup lang="ts">
import type { AdmissionQueueIntakeResponse } from '@aq/shared-types'

defineProps<{
  ticket: AdmissionQueueIntakeResponse
  title: string
  servicePointName?: string
  variant?: 'assistance' | 'admisiRedirect'
  printPending: boolean
  printSucceeded: boolean
  printError: string | null
}>()
defineEmits<{ reprint: []; finish: [] }>()
</script>

<template>
  <section class="panel aq-panel">
    <template v-if="variant === 'admisiRedirect'">
      <div class="aq-alert">
        <span class="aq-alert-icon" aria-hidden="true">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <path d="M12 16v-4"></path>
            <path d="M12 8h.01"></path>
          </svg>
        </span>
        <div class="aq-alert-text">
          <p class="aq-eyebrow" data-testid="assist-eyebrow">Perlu dibantu petugas</p>
          <h1 class="aq-title" data-testid="assist-title">Registrasi di Kiosk belum berhasil</h1>
        </div>
      </div>

      <div class="aq-queue" data-testid="assist-redirect-queue">
        <p class="aq-queue-caption">Nomor Antrian Admisi</p>
        <div class="hero-queue-number aq-queue-number" data-testid="assist-queue-label">
          {{ ticket.queueLabel }}
        </div>
        <div class="aq-queue-meta">
          Urut {{ ticket.noUrut }} · ID {{ ticket.antrianId }}
        </div>
      </div>

      <div class="aq-hint">
        <span class="aq-hint-icon" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <path d="M12 16v-4"></path>
            <path d="M12 8h.01"></path>
          </svg>
        </span>
        <p data-testid="assist-hint">
          Silakan menuju Loket Admisi dan tunggu nomor antrian Anda dipanggil. Petugas akan membantu
          menyelesaikan pendaftaran ke poli Anda.
        </p>
      </div>
    </template>

    <template v-else>
      <h1 class="aq-title" style="text-align: center;">{{ title }}</h1>
      <p v-if="servicePointName" class="aq-sp-name" style="text-align: center;">
        Layanan: {{ servicePointName }}
      </p>

      <div class="hero-queue-container">
        <div class="hero-queue-number" data-testid="assist-queue-label">{{ ticket.queueLabel }}</div>
        <div class="aq-queue-meta">
          Urut {{ ticket.noUrut }} · ID {{ ticket.antrianId }}
        </div>
      </div>
    </template>

    <div class="aq-print" data-testid="assist-print-status">
      <p
        v-if="printPending"
        class="aq-print-pill"
        style="color: var(--color-primary); background: var(--color-surface-bg);"
        data-testid="assist-print-pending"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <polyline points="6 9 6 2 18 2 18 9"></polyline>
          <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
          <rect x="6" y="14" width="12" height="8"></rect>
        </svg>
        {{ variant === 'admisiRedirect' ? 'Mencetak tiket antrian admisi…' : 'Sedang mencetak tiket…' }}
      </p>
      <p
        v-else-if="printSucceeded && !printError"
        class="aq-print-pill aq-print-ok"
        data-testid="assist-print-ok"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        {{
          variant === 'admisiRedirect'
            ? 'Tiket antrian admisi berhasil dicetak. Silakan ambil tiket Anda.'
            : 'Tiket berhasil dicetak. Silakan ambil tiket Anda.'
        }}
      </p>
      <p
        v-if="printError"
        class="aq-print-pill aq-print-error"
        data-testid="assist-print-error"
      >
        {{ printError }}
      </p>
    </div>

    <div class="aq-actions">
      <button
        type="button"
        class="secondary-btn"
        :disabled="printPending"
        data-testid="assist-reprint"
        @click="$emit('reprint')"
      >
        Cetak ulang
      </button>
      <button
        type="button"
        class="sp-btn"
        :disabled="printPending"
        data-testid="assist-finish"
        @click="$emit('finish')"
      >
        Selesai
      </button>
    </div>
  </section>
</template>

<style scoped>
.aq-panel {
  background: transparent;
  border: none;
  box-shadow: none;
  padding-top: 0;
  width: 100%;
  max-width: 900px;
}

.aq-alert {
  display: flex;
  align-items: flex-start;
  gap: 20px;
  background: var(--danger-soft, #fef2f2);
  border: 1.5px solid var(--danger-border, #fca5a5);
  border-radius: var(--radius-lg, 16px);
  padding: 24px 28px;
  text-align: left;
}

.aq-alert-icon {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  border-radius: var(--radius-md, 12px);
  background: rgba(180, 35, 24, 0.08);
  color: var(--danger, #b42318);
}

.aq-alert-text {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.aq-eyebrow {
  margin: 0;
  font-size: 0.85rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--danger, #b42318);
}

.aq-title {
  margin: 0;
  font-size: clamp(1.6rem, 2.6vw, 2.2rem);
  font-weight: 800;
  line-height: 1.2;
  color: var(--text);
}

.aq-queue {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 40px 0 32px;
}

.aq-queue-caption {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 800;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: var(--text-secondary);
}

.aq-queue-number {
  font-size: clamp(72px, 11vw, 128px);
}

.aq-queue-meta {
  margin-top: 4px;
  background: var(--color-surface-card, #fff);
  padding: 8px 24px;
  border-radius: 99px;
  border: 1px solid var(--border);
  font-weight: 600;
  color: var(--text-secondary);
}

.aq-hint {
  display: flex;
  align-items: center;
  gap: 14px;
  background: var(--brand-soft, #e0f2fe);
  border-radius: var(--radius-md, 12px);
  padding: 16px 22px;
  text-align: left;
}

.aq-hint p {
  margin: 0;
  font-size: 1rem;
  line-height: 1.45;
  color: var(--brand-strong, #0369a1);
  font-weight: 600;
}

.aq-hint-icon {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--brand-strong, #0369a1);
}

.aq-sp-name {
  margin-top: -8px;
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--text-secondary);
}

.aq-print {
  min-height: 48px;
  display: flex;
  justify-content: center;
  margin: 4px 0 24px;
}

.aq-print-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  padding: 10px 22px;
  border-radius: 12px;
  font-weight: 700;
  font-size: 1rem;
}

.aq-print-ok {
  color: #fff;
  background: var(--ok, #067647);
}

.aq-print-error {
  color: #fff;
  background: var(--danger, #b42318);
}

.aq-actions {
  display: flex;
  justify-content: center;
  gap: 12px;
  flex-wrap: wrap;
  border-top: 1px solid var(--border);
  padding-top: 28px;
}

.aq-actions .secondary-btn {
  min-width: 180px;
}

.aq-actions .sp-btn {
  min-width: 220px;
}
</style>
