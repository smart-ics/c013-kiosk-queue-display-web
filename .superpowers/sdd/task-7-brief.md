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
```vue
```
```ts
```
```bash
```
### Task 7: Remove the inline empty-screenId error from `DisplayPage.vue`

**Files:**
- Modify: `apps/display-web/src/views/DisplayPage.vue`

**Interfaces:**
- Consumes: the existing `BootErrorPage` props, the existing `validateDisplayDeviceConfig` from `lib/boot.ts`.
- Produces: `DisplayPage` no longer treats an empty `screenId` as an error. The view now assumes `RootView` only renders it with a non-empty `screenId`. The `trim` on entry is kept as a defensive guard, but the error string is removed.

- [ ] **Step 1: Edit `DisplayPage.vue`**

In `apps/display-web/src/views/DisplayPage.vue`, locate this block inside the
`watch` callback (the current `if (!screenId)` early-return that sets the
`bootError` string):

```ts
    const screenId = rawScreenId?.trim()
    if (!screenId) {
      bootError.value = 'Screen ID kosong. Buka dengan path /display/{screenId}.'
      return
    }
```

Replace it with this:

```ts
    const screenId = rawScreenId?.trim()
    if (!screenId) {
      return
    }
```

Nothing else in the file changes. The `bootError` ref is still set by the
other branches (missing token, wrong role, empty loketIds, unknown screen,
etc.).

- [ ] **Step 2: Run typecheck**

Run from repo root: `pnpm --filter display-web typecheck`
Expected: PASS. The `bootError` ref is still used by other branches.

- [ ] **Step 3: Run all display-web tests**

Run from repo root: `pnpm --filter display-web test`
Expected: PASS. The pre-existing `boot.spec.ts` tests are untouched.

- [ ] **Step 4: Commit**

```bash
git add apps/display-web/src/views/DisplayPage.vue
git commit -m "refactor(display-web): drop dead empty-screenId branch in DisplayPage"
```

---

