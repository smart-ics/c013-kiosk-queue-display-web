<script setup lang="ts">
import { computed } from 'vue'
import { useDisplayScreenList } from '../composables/useDisplayScreenList'
import BootErrorPage from './BootErrorPage.vue'

const { status, screenIds, error } = useDisplayScreenList()

const empty = computed(() => status.value === 'ok' && screenIds.value.length === 0)
</script>

<template>
  <BootErrorPage
    v-if="status === 'error'"
    title="Queue Display — Boot gagal"
    :message="error!"
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
      <h1>Pilih Screen Display</h1>
      <p class="subtitle">Silakan pilih salah satu screen aktif untuk mulai menampilkan antrean admisi.</p>
    </div>

    <div v-if="status === 'loading'" class="loading-state">
      <div class="spinner"></div>
      <p>Memuat daftar screen aktif…</p>
    </div>

    <div v-else-if="empty" class="empty-state">
      <svg class="empty-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
      <h2>Tidak Ada Screen Terdaftar</h2>
      <p>
        Tidak ada screen display yang terdaftar di sistem.
        Pastikan admin telah mendaftarkan screen display melalui halaman konfigurasi.
      </p>
    </div>

    <div v-else class="list-wrapper">
      <ul class="picker-list-enhanced">
        <li
          v-for="(id, index) in screenIds"
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
                <span class="screen-sub">Display Station Screen</span>
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
/* Container Panel */
.picker-panel {
  margin: 6rem auto auto;
  width: min(580px, calc(100% - 2rem));
  background: var(--surface);
  border: 1px solid var(--border-soft);
  border-radius: 1.5rem;
  padding: 3rem 2.5rem;
  box-shadow: var(--shadow-card);
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
  background: radial-gradient(circle, rgba(249, 115, 22, 0.1) 0%, rgba(249, 115, 22, 0) 70%);
  margin-bottom: 1.25rem;
  color: var(--brand-orange);
}

.icon-glow-wrapper::after {
  content: '';
  position: absolute;
  width: 3.5rem;
  height: 3.5rem;
  border-radius: 50%;
  background: var(--brand-orange);
  filter: blur(25px);
  opacity: 0.15;
  z-index: -1;
}

.header-icon {
  width: 2.75rem;
  height: 2.75rem;
  stroke: var(--brand-orange);
  filter: drop-shadow(0 2px 8px rgba(249, 115, 22, 0.2));
  animation: float 4s ease-in-out infinite;
}

.picker-panel h1 {
  font-size: 1.85rem;
  font-weight: 800;
  color: var(--text);
  margin: 0 0 0.75rem;
  letter-spacing: -0.02em;
}

.subtitle {
  font-size: 0.95rem;
  line-height: 1.5;
  color: var(--text-secondary);
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
  color: var(--text-secondary);
}

.spinner {
  width: 2.5rem;
  height: 2.5rem;
  border: 3px solid rgba(249, 115, 22, 0.1);
  border-top-color: var(--brand-orange);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  box-shadow: 0 0 15px rgba(249, 115, 22, 0.05);
}

/* Empty State */
.empty-state {
  padding: 2rem 0;
  color: var(--text-secondary);
}

.empty-icon {
  width: 3.5rem;
  height: 3.5rem;
  stroke: var(--danger);
  margin-bottom: 1.25rem;
  filter: drop-shadow(0 2px 10px rgba(180, 35, 24, 0.1));
}

.empty-state h2 {
  font-size: 1.3rem;
  color: var(--text);
  margin: 0 0 0.5rem;
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
  background: var(--surface);
  border: 1px solid var(--border-soft);
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
  background: var(--bg);
  color: var(--text-tertiary);
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
  font-weight: 700;
  color: var(--text);
  transition: color 0.25s ease;
}

.screen-sub {
  font-size: 0.8rem;
  color: var(--text-tertiary);
  margin-top: 0.15rem;
}

.card-right {
  color: var(--text-tertiary);
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
  background: var(--brand-orange-soft);
  border-color: var(--brand-orange);
  box-shadow: 
    0 10px 20px rgba(249, 115, 22, 0.04),
    0 0 0 1px rgba(249, 115, 22, 0.1);
  transform: translateY(-2px);
}

.picker-link-card:hover .screen-icon-bg {
  background: var(--brand-orange);
  color: #ffffff;
}

.picker-link-card:hover .item-icon {
  transform: scale(1.1);
}

.picker-link-card:hover .screen-name {
  color: var(--brand-orange-dark);
}

.picker-link-card:hover .card-right {
  opacity: 1;
  color: var(--brand-orange);
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
