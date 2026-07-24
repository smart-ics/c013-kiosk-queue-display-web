<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import DisplayPage from './DisplayPage.vue'
import MissingScreenPicker from './MissingScreenPicker.vue'

const route = useRoute()

const screenId = computed(() => {
  const raw = route.params.screenId
  const first = Array.isArray(raw) ? raw[0] : raw
  return (first ?? '').toString().trim()
})
</script>

<template>
  <DisplayPage v-if="screenId" :screen-id="screenId" />
  <MissingScreenPicker v-else />
</template>
