<script setup lang="ts">
import { RouterView } from 'vue-router'
import { version } from '../package.json'
</script>

<template>
  <div class="app-shell">
    <RouterView />
    <span class="app-version-badge">v{{ version }}</span>
  </div>
</template>
