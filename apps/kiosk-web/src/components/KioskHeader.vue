<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'

const props = defineProps<{ lang: 'id' | 'en'; businessDate?: string | null }>()
const emit = defineEmits<{ toggleLang: [lang: 'id' | 'en']; help: [] }>()

const now = ref(new Date())
let timer: ReturnType<typeof setInterval> | undefined

onMounted(() => {
  timer = setInterval(() => {
    now.value = new Date()
  }, 1000)
})

onUnmounted(() => {
  if (timer !== undefined) clearInterval(timer)
})

const tagline = computed(() =>
  props.lang === 'en'
    ? 'Serving with heart, healthy for the nation'
    : 'Melayani dengan hati, sehat untuk negeri',
)

const helpLabel = computed(() => (props.lang === 'en' ? 'Help' : 'Bantuan'))

const dateText = computed(() => {
  if (props.businessDate) {
    const [y, m, d] = props.businessDate.split('-')
    return new Intl.DateTimeFormat(props.lang === 'en' ? 'en-US' : 'id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date(Number(y), Number(m) - 1, Number(d)))
  }
  return new Intl.DateTimeFormat(props.lang === 'en' ? 'en-US' : 'id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(now.value)
})

const timeText = computed(() =>
  new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(now.value),
)

const isoTime = computed(() => now.value.toISOString())
</script>

<template>
  <header class="kiosk-header">
    <div class="brand">
      <svg class="brand-mark" viewBox="0 0 48 48" aria-hidden="true">
        <defs>
          <linearGradient id="aq-brand-mark" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#f97316" />
            <stop offset="1" stop-color="#c2410c" />
          </linearGradient>
        </defs>
        <rect x="2" y="2" width="44" height="44" rx="14" fill="url(#aq-brand-mark)" />
        <path
          d="M21.5 14.5h5v7h7v5h-7v7h-5v-7h-7v-5h7Z"
          fill="#fff"
        />
      </svg>
      <div class="brand-text">
        <p class="brand-name">RS Sehat Sejahtera</p>
        <p class="brand-tagline">{{ tagline }}</p>
      </div>
    </div>

    <div class="clock">
      <p class="clock-time">
        <time :datetime="isoTime">{{ timeText }}</time>
        <span class="clock-tz"> WIB</span>
      </p>
      <p class="clock-date">{{ dateText }}</p>
    </div>

    <div class="header-actions">
      <div class="lang-toggle" role="group" aria-label="Bahasa / Language">
        <button
          type="button"
          :class="{ active: lang === 'id' }"
          :aria-pressed="lang === 'id'"
          data-testid="lang-id"
          @click="emit('toggleLang', 'id')"
        >
          ID
        </button>
        <button
          type="button"
          :class="{ active: lang === 'en' }"
          :aria-pressed="lang === 'en'"
          data-testid="lang-en"
          @click="emit('toggleLang', 'en')"
        >
          EN
        </button>
      </div>
      <button type="button" class="help-btn" data-testid="help-btn" @click="emit('help')">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9.5" />
          <path d="M9.3 9.3a2.8 2.8 0 0 1 5.2 1.4c0 1.9-2.5 2.2-2.5 3.9" />
          <path d="M12 17.6h.01" />
        </svg>
        <span>{{ helpLabel }}</span>
      </button>
    </div>
  </header>
</template>
