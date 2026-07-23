<script setup lang="ts">
defineProps<{
  screenId: string
}>()
</script>

<template>
  <main style="font-family: Segoe UI, sans-serif; padding: 2rem; color: #102033">
    <h1>Queue Display (stub)</h1>
    <p v-if="screenId">
      Screen <strong>{{ screenId }}</strong> — C3.0 will load device config and snapshot here.
    </p>
    <p v-else>Open with path <code>/display/{screenId}</code>.</p>
  </main>
</template>
