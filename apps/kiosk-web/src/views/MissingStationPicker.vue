<script setup lang="ts">
import { computed } from 'vue'
import { useStationList } from '../composables/useStationList'
import BootErrorPage from './BootErrorPage.vue'

const { status, stationIds, error } = useStationList()

const empty = computed(() => status.value === 'ok' && stationIds.value.length === 0)
</script>

<template>
  <BootErrorPage
    v-if="status === 'error'"
    title="Kiosk — Boot gagal"
    :message="error ?? 'Gagal memuat daftar station.'"
  />

  <section v-else class="picker-panel">
    <div class="picker-header">
      <div class="icon-glow-wrapper">
        <svg class="header-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
          <line x1="8" y1="21" x2="16" y2="21"></line>
          <line x1="12" y1="17" x2="12" y2="21"></line>
        </svg>
      </div>
      <h1>Pilih Station Kiosk</h1>
      <p class="subtitle">Silakan pilih salah satu station aktif dari devices.json untuk mulai menggunakan kiosk.</p>
    </div>

    <div v-if="status === 'loading'" class="loading-state">
      <div class="spinner"></div>
      <p>Memuat daftar station aktif…</p>
    </div>

    <div v-else-if="empty" class="empty-state">
      <svg class="empty-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
      <h2>Tidak Ada Station Terdaftar</h2>
      <p>
        Tidak ada entry station kiosk yang terdaftar di <code>devices.json</code>.
        Pastikan Anda telah menambahkan entry dengan <code>role: 'kiosk'</code> terlebih dahulu.
      </p>
    </div>

    <div v-else class="list-wrapper">
      <ul class="picker-list-enhanced">
        <li
          v-for="(id, index) in stationIds"
          :key="id"
          class="picker-item-wrapper"
          :style="{ animationDelay: `${index * 75}ms` }"
        >
          <RouterLink :to="`/${id}`" class="picker-link-card">
            <div class="card-left">
              <div class="screen-icon-bg">
                <svg class="item-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="2" y="4" width="20" height="12" rx="2"></rect>
                  <path d="M12 16v4"></path>
                  <path d="M8 20h8"></path>
                </svg>
              </div>
              <div class="screen-info">
                <span class="screen-name">{{ id }}</span>
                <span class="screen-sub">Kiosk Station</span>
              </div>
            </div>
            <div class="card-right">
              <svg class="arrow-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </div>
          </RouterLink>
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
/* Scoped custom variables */
.picker-panel {
  --accent: var(--btn, #1d6fb8);
  --accent-glow: rgba(29, 111, 184, 0.15);
  --accent-glow-border: rgba(29, 111, 184, 0.25);
  --accent-glow-bg: rgba(29, 111, 184, 0.08);
  --accent-icon-bg: rgba(29, 111, 184, 0.15);
  --text-light: #ffffff;
  --muted-light: #9bb7d0;
  --warn: #f5a524;
}

/* Container Panel */
.picker-panel {
  margin: 6rem auto auto;
  width: min(600px, calc(100% - 2rem));
  background: rgba(18, 38, 61, 0.55);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 1.5rem;
  padding: 3rem 2.5rem;
  box-shadow: 
    0 4px 30px rgba(0, 0, 0, 0.2),
    0 24px 70px rgba(0, 0, 0, 0.4),
    inset 0 0 20px rgba(255, 255, 255, 0.02);
  text-align: center;
  animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) both;
}

/* Header Area */
.picker-header {
  margin-bottom: 2.5rem;
}

.icon-glow-wrapper {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 5.5rem;
  height: 5.5rem;
  border-radius: 1.25rem;
  background: radial-gradient(circle, var(--accent-glow) 0%, rgba(29, 111, 184, 0) 70%);
  margin-bottom: 1.25rem;
  color: var(--accent);
}

.icon-glow-wrapper::after {
  content: '';
  position: absolute;
  width: 3.5rem;
  height: 3.5rem;
  border-radius: 50%;
  background: var(--accent);
  filter: blur(25px);
  opacity: 0.35;
  z-index: -1;
}

.header-icon {
  width: 2.75rem;
  height: 2.75rem;
  stroke: var(--accent);
  filter: drop-shadow(0 2px 8px rgba(29, 111, 184, 0.4));
  animation: float 4s ease-in-out infinite;
}

.picker-panel h1 {
  font-size: 1.85rem;
  font-weight: 700;
  color: var(--text-light);
  margin: 0 0 0.75rem;
  letter-spacing: -0.02em;
}

.subtitle {
  font-size: 0.95rem;
  line-height: 1.5;
  color: var(--muted-light);
  max-width: 420px;
  margin: 0 auto;
}

/* Loading State */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2rem 0;
  gap: 1.25rem;
  color: var(--muted-light);
}

.spinner {
  width: 2.5rem;
  height: 2.5rem;
  border: 3px solid rgba(29, 111, 184, 0.1);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  box-shadow: 0 0 15px rgba(29, 111, 184, 0.15);
}

/* Empty State */
.empty-state {
  padding: 2rem 0;
  color: var(--muted-light);
}

.empty-icon {
  width: 3.5rem;
  height: 3.5rem;
  stroke: var(--warn);
  margin-bottom: 1.25rem;
  filter: drop-shadow(0 2px 10px rgba(245, 165, 36, 0.2));
}

.empty-state h2 {
  font-size: 1.3rem;
  color: var(--text-light);
  margin: 0 0 0.5rem;
}

.empty-state code {
  background: rgba(255, 255, 255, 0.08);
  padding: 0.2rem 0.4rem;
  border-radius: 0.25rem;
  font-size: 0.9em;
  color: var(--warn);
}

/* List & Cards */
.list-wrapper {
  text-align: left;
}

.picker-list-enhanced {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.picker-item-wrapper {
  opacity: 0;
  animation: fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.picker-link-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 1rem;
  text-decoration: none;
  transition: all 0.25s cubic-bezier(0.25, 0.8, 0.25, 1);
}

.card-left {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.screen-icon-bg {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.75rem;
  height: 2.75rem;
  border-radius: 0.75rem;
  background: rgba(255, 255, 255, 0.04);
  color: var(--muted-light);
  transition: all 0.25s ease;
}

.item-icon {
  width: 1.4rem;
  height: 1.4rem;
  transition: transform 0.3s ease;
}

.screen-info {
  display: flex;
  flex-direction: column;
}

.screen-name {
  font-size: 1.15rem;
  font-weight: 600;
  color: var(--text-light);
  transition: color 0.25s ease;
}

.screen-sub {
  font-size: 0.8rem;
  color: var(--muted-light);
  margin-top: 0.15rem;
}

.card-right {
  color: var(--muted-light);
  opacity: 0.6;
  transition: all 0.25s ease;
  transform: translateX(0);
}

.arrow-icon {
  width: 1.25rem;
  height: 1.25rem;
}

/* Hover States & Interactions */
.picker-link-card:hover {
  background: var(--accent-glow-bg);
  border-color: var(--accent-glow-border);
  box-shadow: 
    0 10px 20px rgba(0, 0, 0, 0.15),
    0 0 0 1px rgba(29, 111, 184, 0.15),
    inset 0 0 12px rgba(29, 111, 184, 0.05);
  transform: translateY(-2px);
}

.picker-link-card:hover .screen-icon-bg {
  background: var(--accent-icon-bg);
  color: var(--accent);
}

.picker-link-card:hover .item-icon {
  transform: scale(1.1);
}

.picker-link-card:hover .screen-name {
  color: var(--accent);
}

.picker-link-card:hover .card-right {
  opacity: 1;
  color: var(--accent);
  transform: translateX(4px);
}

/* Animations */
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes float {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-4px);
  }
}
</style>
