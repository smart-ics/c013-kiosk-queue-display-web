# Task 6 — Context note from controller

This is the sixth task in a 9-task plan. Task 5 just shipped `MissingScreenPicker.vue` and required a UTF-8 mojibake fix (em-dash and ellipsis were double-encoded). The fix worked, but the lesson generalizes: when writing `.vue` files in this environment, PowerShell's default encoding (UTF-16 LE) and some editor pipelines can mangle non-ASCII characters. To be safe, the implementer should use a tool that writes correct UTF-8 bytes — preferably the `edit` / `apply_patch` tool, or PowerShell's `Set-Content -Encoding utf8` / `WriteAllBytes`, not `Out-File` or shell `>` redirection.

Task 6's files contain only ASCII characters (no em-dash, no ellipsis, no other non-ASCII), so this is informational only. Apply the same care as a defensive habit.

**Action:** Create `apps/display-web/src/views/RootView.vue` and edit `apps/display-web/src/router.ts` per the brief below. Both files are ASCII-only.

---

# Brief (auto-extracted from plan)

```ts
```
```bash
```
```ts
```
```bash
```
```ts
```
```bash
```
```ts
```
```ts
```
```ts
```
```bash
```
```css
```
```vue
```
```bash
```
### Task 6: Add `RootView` and update the router

**Files:**
- Create: `apps/display-web/src/views/RootView.vue`
- Modify: `apps/display-web/src/router.ts`

**Interfaces:**
- Consumes: `DisplayPage` (existing) and `MissingScreenPicker` from Task 5.
- Produces: a single route `/:screenId?` whose component is `RootView`. `RootView` reads `route.params.screenId`, trims it, and renders `DisplayPage` when non-empty, `MissingScreenPicker` otherwise.

- [ ] **Step 1: Create `RootView.vue`**

Create `apps/display-web/src/views/RootView.vue`:

```vue
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
```

- [ ] **Step 2: Update `router.ts`**

Edit `apps/display-web/src/router.ts`. The full file becomes:

```ts
import { createRouter, createWebHistory } from 'vue-router'
import RootView from './views/RootView.vue'

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/:screenId?',
      name: 'display-root',
      component: RootView,
    },
  ],
})
```

The old `DisplayPage` import is removed because the route no longer references it directly; `RootView` does.

- [ ] **Step 3: Run typecheck**

Run from repo root: `pnpm --filter display-web typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/display-web/src/views/RootView.vue apps/display-web/src/router.ts
git commit -m "feat(display-web): route /:screenId? through RootView"
```

---
