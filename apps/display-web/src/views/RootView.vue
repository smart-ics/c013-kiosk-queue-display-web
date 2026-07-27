<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import DisplayPage from './DisplayPage.vue'
import MissingScreenPicker from './MissingScreenPicker.vue'
import { getAuthTokenProvider } from '../infrastructure'

const route = useRoute()
const provider = getAuthTokenProvider()

const screenId = computed(() => {
  const raw = route.params.screenId
  const first = Array.isArray(raw) ? raw[0] : raw
  return (first ?? '').toString().trim()
})

const authPending = computed(() => provider.phase.value.kind === 'logging-in')
</script>

<template>
  <p v-if="authPending" class="loading">Memverifikasi login…</p>
  <DisplayPage v-else-if="screenId" :screen-id="screenId" />
  <MissingScreenPicker v-else />
</template>
