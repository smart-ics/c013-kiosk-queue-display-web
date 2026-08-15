<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    currentPage: number
    totalPages: number
    pending?: boolean
  }>(),
  {
    pending: false,
  },
)

const emit = defineEmits<{
  'update:currentPage': [page: number]
}>()

const hasPrevious = computed(() => props.currentPage > 1)
const hasNext = computed(() => props.currentPage < props.totalPages)

function previousPage() {
  if (hasPrevious.value && !props.pending) {
    emit('update:currentPage', props.currentPage - 1)
  }
}

function nextPage() {
  if (hasNext.value && !props.pending) {
    emit('update:currentPage', props.currentPage + 1)
  }
}
</script>

<template>
  <div v-if="totalPages > 1" class="kiosk-pagination" data-testid="kiosk-pagination">
    <button
      type="button"
      class="pagination-btn prev-btn"
      :disabled="!hasPrevious || pending"
      @click="previousPage"
      aria-label="Halaman Sebelumnya"
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
        <polyline points="15 18 9 12 15 6"></polyline>
      </svg>
    </button>

    <div class="page-indicator">
      <span class="current-page">{{ currentPage }}</span>
      <span class="page-divider">/</span>
      <span class="total-pages">{{ totalPages }}</span>
    </div>

    <button
      type="button"
      class="pagination-btn next-btn"
      :disabled="!hasNext || pending"
      @click="nextPage"
      aria-label="Halaman Berikutnya"
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
        <polyline points="9 18 15 12 9 6"></polyline>
      </svg>
    </button>
  </div>
</template>

<style scoped>
.kiosk-pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 32px;
  width: 100%;
  margin: 16px auto;
  padding: 8px 0;
  background: transparent;
  border: none;
}

.pagination-btn {
  appearance: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  cursor: pointer;
  transition: all 150ms cubic-bezier(0.4, 0, 0.2, 1);
  border: 2px solid var(--border-soft, #efe9e0);
  background: var(--surface, #ffffff);
  color: var(--text, #1e293b);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.02);
}

.pagination-btn:hover:not(:disabled) {
  background: var(--brand-soft);
  border-color: var(--brand);
  color: var(--brand-strong);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.pagination-btn:active:not(:disabled) {
  transform: scale(0.92);
}

.pagination-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
  border-color: var(--border-soft);
}

.page-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-secondary);
}

.current-page {
  color: var(--brand-strong);
  font-size: 1.5rem;
}

.page-divider {
  color: var(--border);
  font-weight: 300;
}

.total-pages {
  color: var(--text-tertiary);
}
</style>
