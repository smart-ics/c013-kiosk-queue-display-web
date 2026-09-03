<script setup lang="ts">
import type { RegistrationPrintData } from '@aq/shared-types'

defineProps<{
  registration: RegistrationPrintData
  pending: boolean
  succeeded: boolean
  error: string | null
}>()
defineEmits<{ reprint: []; finish: [] }>()
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
      display: flex;
      flex-direction: column;
    "
  >
    <h1 style="margin: 0 0 8px; text-align: center; color: var(--ok); font-size: clamp(1.8rem, 3vw, 2.4rem); font-weight: 800;">
      Cetak Ulang Karcis Registrasi
    </h1>
    <p style="text-align: center; font-size: 1.1rem; color: var(--text-secondary); margin-bottom: 24px; font-weight: 500;">
      Tiket Anda belum sempat dicetak? Cetak ulang karcis registrasi di bawah ini.
    </p>

    <div class="hero-queue-container">
      <div class="hero-queue-number" data-testid="reprint-no-antrian">{{ registration.noAntrian }}</div>
      <div
        data-testid="reprint-reg-id"
        style="
          margin-top: 16px;
          background: var(--color-surface-card);
          padding: 8px 24px;
          border-radius: 99px;
          border: 1px solid var(--border);
          font-weight: 600;
          color: var(--text-secondary);
        "
      >
        Reg ID {{ registration.regId }}
      </div>
    </div>

    <div
      style="
        width: 100%;
        max-width: 520px;
        margin: 24px auto;
        background: var(--color-surface-card);
        border: 1px solid var(--border);
        border-radius: 16px;
        padding: 16px 24px;
        display: grid;
        grid-template-columns: 1fr;
        gap: 8px;
      "
    >
      <div style="display: flex; justify-content: space-between; gap: 16px;">
        <span style="color: var(--text-secondary); font-weight: 500;">Nama Pasien</span>
        <span style="font-weight: 600; text-align: right;" data-testid="reprint-pasien-name">{{ registration.pasienName }}</span>
      </div>
      <div style="display: flex; justify-content: space-between; gap: 16px;">
        <span style="color: var(--text-secondary); font-weight: 500;">Poli / Layanan</span>
        <span style="font-weight: 600; text-align: right;">{{ registration.serviceName || '-' }}</span>
      </div>
      <div style="display: flex; justify-content: space-between; gap: 16px;">
        <span style="color: var(--text-secondary); font-weight: 500;">Dokter</span>
        <span style="font-weight: 600; text-align: right;">{{ registration.dokterName || '-' }}</span>
      </div>
    </div>

    <div style="min-height: 48px; display: flex; justify-content: center; margin-bottom: 24px;">
      <p
        v-if="pending"
        class="status"
        style="margin: 0; padding: 12px 24px; background: var(--color-surface-bg); border-radius: 12px; color: var(--color-primary);"
      >
        🖨️ Sedang mencetak…
      </p>
      <p
        v-else-if="succeeded && !error"
        class="status ok"
        data-testid="reprint-ok"
        style="margin: 0; padding: 12px 24px; background: var(--ok); color: white; border-radius: 12px;"
      >
        ✓ Tiket berhasil dicetak.
      </p>
      <p
        v-if="error"
        class="status error"
        data-testid="reprint-error"
        style="margin: 0; padding: 12px 24px; background: var(--danger); color: white; border-radius: 12px;"
      >
        ⚠️ {{ error }}
      </p>
    </div>

    <div class="actions" style="justify-content: center; border-top: 1px solid var(--border); padding-top: 32px;">
      <button
        type="button"
        class="secondary-btn"
        :disabled="pending"
        data-testid="reprint-btn"
        @click="$emit('reprint')"
        style="min-width: 160px;"
      >
        Cetak ulang
      </button>
      <button
        type="button"
        class="sp-btn"
        data-testid="reprint-finish"
        @click="$emit('finish')"
        style="min-width: 240px;"
      >
        Kembali ke menu
      </button>
    </div>
  </section>
</template>