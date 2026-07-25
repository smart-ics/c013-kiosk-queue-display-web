# Task 8 — Context note from controller

The brief's Task 8 assumes manual browser testing (`pnpm dev:display` + click links). Subagents do not have a browser. This task has been adapted to use a combination of build verification, static-file serving, HTTP fetching, and Vue component tests that exercise the same routing logic.

**Adapted verification plan:**

1. **Build**: `pnpm --filter display-web build` — must succeed (this is a strong end-to-end check; it runs `vue-tsc` typecheck and then `vite build` to bundle).
2. **Preview server**: start `pnpm --filter display-web preview` on port 4173 (vite preview's default). Curl the three URLs (`/`, `/display/lobby-poli-1`, `/display/nope`) and confirm the bundled `index.html` is served with the right script reference.
3. **Component test for `RootView`**: create a focused vue-test-utils spec that mounts `RootView` with stubbed children (`DisplayPage` and `MissingScreenPicker`) and asserts which child is rendered for empty vs. non-empty vs. whitespace `screenId`. This is the closest automated equivalent to "click each URL."
4. **Stop the server** and clean up.

The 7 steps in the brief are mapped to:

| Brief step | Adapted step |
| --- | --- |
| Step 1: Start dev server | Adapted step 1: `pnpm --filter display-web build` |
| Step 2: Open `/` and verify the picker renders | Adapted step 3a: `RootView` spec — empty `screenId` renders `MissingScreenPicker` |
| Step 3: Click a link and verify navigation | Adapted step 3b: `RootView` spec — non-empty `screenId` renders `DisplayPage` with the prop |
| Step 4: Verify the unknown-screen error path | Adapted step 3c: `RootView` spec — non-empty `screenId` still routes to `DisplayPage` (the unknown-screen error is `DisplayPage`'s own behavior, not a routing concern) |
| Step 5: Verify whitespace `screenId` is treated as empty | Adapted step 3d: `RootView` spec — whitespace `screenId` renders `MissingScreenPicker` |
| Step 6: Stop the dev server | Adapted step 4: stop `vite preview` and clean up |
| Step 7: Doc follow-ups | No new doc references exist (per spec review). No commit needed. |

## Important constraints

- The preview server must be started in a way that the subagent can kill it. Use `Start-Process` or a background job. Capture the PID; kill it at the end.
- The component test must use `vue-test-utils` `mount`, NOT `shallowMount`, because the children are simple enough to render but stubs avoid the heavy `DisplayPage` lifecycle (TanStack Query, etc.). Use `vi.mock` or stub components.
- Do NOT commit the new component test file if it lands on a feature branch that already has unrelated dirty files. Stage ONLY the new spec file. (Task 7's report flagged pre-existing dirty files; the new spec file is a clean addition.)
- UTF-8: the new spec file is ASCII-only.

## Action

Follow the adapted steps in the brief below. The brief itself is the source of truth for the manual plan; the notes above are the adaptation.

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
```vue
```
```ts
```
```bash
```
```ts
```
```ts
```
```bash
```
### Task 8: Manual smoke verification

**Files:** none (verification only).

This is not a test the framework runs; it is a sanity pass the implementer performs
before declaring the work done. Use the dev server.

- [ ] **Step 1: Start the dev server**

Run from repo root: `pnpm dev:display`
Expected: Vite serves `apps/display-web` at `http://localhost:5174/display/`.

- [ ] **Step 2: Open `/` and verify the picker renders**

Visit `http://localhost:5174/display/`.
Expected: Picker panel titled "Pilih Screen Display" lists `lobby-igd` and
`lobby-poli-1` (per the bundled `devices.json`).

- [ ] **Step 3: Click a link and verify navigation**

Click `lobby-poli-1`.
Expected: URL becomes `/display/lobby-poli-1`; the page transitions to the
existing display view (header "Antrian Admisi", `Screen lobby-poli-1`).

- [ ] **Step 4: Verify the unknown-screen error path still works**

Visit `http://localhost:5174/display/nope`.
Expected: Existing `BootErrorPage` text "Konfigurasi tidak ditemukan untuk
screen 'nope'." (The empty-list state must NOT trigger here because a
`screenId` is present.)

- [ ] **Step 5: Verify whitespace `screenId` is treated as empty**

Visit `http://localhost:5174/display/%20%20` (URL-encoded whitespace).
Expected: Picker view renders. (No new screen is created.)

- [ ] **Step 6: Stop the dev server**

Press `Ctrl+C` in the terminal running the dev server.

- [ ] **Step 7: Commit any doc follow-ups (if needed)**

If any doc reference to the removed error string was discovered, update it in
this commit. (Pre-check: no such reference exists in the repo per spec review.)

---
