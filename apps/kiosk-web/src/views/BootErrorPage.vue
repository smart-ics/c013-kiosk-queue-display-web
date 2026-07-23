<script setup lang="ts">
defineProps<{
  title: string
  message: string
}>()
</script>

<template>
  <section class="panel">
    <h1>{{ title }}</h1>
    <p class="status error">{{ message }}</p>
  </section>
</template>
