<script setup lang="ts">
import { ref } from 'vue'

defineProps<{ pending: boolean; errorMessage: string | null }>()
const emit = defineEmits<{ submit: [keyword: string]; scan: []; back: [] }>()
const keyword = ref('')

const showManualInput = ref(false)

function submit() {
  if (!keyword.value.trim()) return
  emit('submit', keyword.value)
}

function appendToKeyword(char: string) {
  keyword.value += char
}

function deleteChar() {
  keyword.value = keyword.value.slice(0, -1)
}

function triggerScan() {
  emit('scan')
}
</script>

<template>
  <section class="panel" style="max-width: 800px;">
    <h1>Identifikasi Data</h1>
    
    <div v-if="!showManualInput" class="scanner-ready-state">
      <div class="scan-icon-container" @click="triggerScan" style="cursor: pointer;" title="Klik untuk test hardware scan">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 7V4h3M20 7V4h-3M4 17v3h3M20 17v3h-3M7 9h10M7 12h10M7 15h10"/>
        </svg>
      </div>
      <h2>Arahkan Barcode/QR Code ke Scanner</h2>
      <p>Otomatis memindai tiket antrian atau BPJS Anda.</p>
      
      <button type="button" class="sp-btn" style="margin-top: 24px;" @click="showManualInput = true">
        Ketik Nomor Manual
      </button>
    </div>

    <div v-else>
      <input
        v-model="keyword"
        class="big-input"
        style="text-align: center; letter-spacing: 2px; font-size: 2rem;"
        placeholder="Masukkan Nomor"
        data-testid="booking-keyword"
        readonly
      />
      
      <div class="numpad-grid">
        <button v-for="n in 9" :key="n" type="button" class="numpad-btn" @click="appendToKeyword(n.toString())">{{ n }}</button>
        <button type="button" class="numpad-btn action" @click="deleteChar">⌫</button>
        <button type="button" class="numpad-btn" @click="appendToKeyword('0')">0</button>
        <button type="button" class="numpad-btn action" :disabled="pending || !keyword" @click="submit">OK</button>
      </div>
    </div>

    <div class="actions" style="justify-content: center; margin-top: 32px; border-top: 1px solid var(--border); padding-top: 24px;">
      <button v-if="showManualInput" type="button" class="secondary-btn" :disabled="pending" @click="showManualInput = false">
        Kembali ke Scanner
      </button>
      <button type="button" class="secondary-btn" :disabled="pending" @click="$emit('back')">
        Batal Registrasi
      </button>
    </div>
    
    <p v-if="pending" class="status" style="text-align: center;">Mencari data…</p>
    <p v-if="errorMessage" class="status error" style="text-align: center;" data-testid="booking-error">{{ errorMessage }}</p>
  </section>
</template>
