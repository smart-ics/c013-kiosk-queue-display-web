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
### Task 5: Create the `MissingScreenPicker` view

**Files:**
- Create: `apps/display-web/src/views/MissingScreenPicker.vue`
- Modify: `apps/display-web/src/styles.css`

**Interfaces:**
- Consumes: `useDisplayScreenList` from Task 4; `BootErrorPage` (existing); `RouterLink` from `vue-router`.
- Produces: a view that renders one of four states: loading, list, empty, error. Each list item is a `RouterLink` to `/display/{id}`.

- [ ] **Step 1: Add CSS rules for the picker list**

Edit `apps/display-web/src/styles.css`. Append the following at the end of the file (after the `.state` block):

```css
.picker-list {
  list-style: none;
  margin: 1.25rem 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.picker-list a {
  display: block;
  padding: 0.75rem 1rem;
  border-radius: 0.75rem;
  background: rgba(61, 214, 140, 0.12);
  color: var(--accent);
  font-weight: 600;
  text-decoration: none;
  font-size: 1.1rem;
}

.picker-list a:hover,
.picker-list a:focus-visible {
  background: rgba(61, 214, 140, 0.22);
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
```

- [ ] **Step 2: Create the view component**

Create `apps/display-web/src/views/MissingScreenPicker.vue`:

```vue
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
    title="Queue Display â€” Boot gagal"
    :message="error ?? 'Gagal memuat daftar screen.'"
  />

  <section v-else class="panel">
    <h1>Pilih Screen Display</h1>
    <p class="status">Pilih salah satu screen yang tersedia di devices.json.</p>

    <p v-if="status === 'loading'" class="status">Memuat daftar screenâ€¦</p>

    <p v-else-if="empty" class="status error">
      Tidak ada screen display yang terdaftar di devices.json. Tambahkan entry
      dengan <code>role: 'display'</code> terlebih dahulu.
    </p>

    <ul v-else class="picker-list">
      <li v-for="id in screenIds" :key="id">
        <RouterLink :to="`/display/${id}`">{{ id }}</RouterLink>
      </li>
    </ul>
  </section>
</template>
```

Notes:
- The `RouterLink` is resolved through the `vue-router` global component; do
  not import it explicitly.
- `.status` is used for neutral copy and `.status.error` for the empty case.
  Both classes exist in `styles.css` already.
- The branch order is: `error` â†’ `loading` (inside the panel) â†’ `empty` (inside
  the panel) â†’ list. Each branch is exclusive because of the `v-if`/`v-else-if`
  chain and the early `v-if` for error.

- [ ] **Step 3: Run typecheck**

Run from repo root: `pnpm --filter display-web typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/display-web/src/views/MissingScreenPicker.vue apps/display-web/src/styles.css
git commit -m "feat(display-web): add MissingScreenPicker view"
```

---

