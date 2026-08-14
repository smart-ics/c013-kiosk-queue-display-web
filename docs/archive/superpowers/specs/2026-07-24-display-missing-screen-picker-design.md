# Display — Missing Screen Picker

Date: 2026-07-24
Scope: `apps/display-web`, `packages/device-config`

## Problem

When `display-web` is opened at `/` (or any path whose `:screenId` is empty after trim),
`DisplayPage.vue` shows a single error line:

> Screen ID kosong. Buka dengan path /display/{screenId}.

This is a dead end. The operator can see the device IDs are configured in
`apps/display-web/public/devices.json` (`lobby-poli-1`, `lobby-igd`) but cannot
pick one from the page. They have to type the URL.

## Goal

Replace the dead-end error with a list of available display screens, each linking
to `/display/{screenId}`. If the list is empty, show a clear "no display screens
configured" message. If the catalog itself fails to load, show the existing
`BootErrorPage` text.

## Non-goals

- No kiosk picker. (C2 has the same shape but is out of scope.)
- No new REST endpoint, no new env var, no auth changes.
- No auto-redirect. Operators always choose explicitly.
- No "change screen" affordance inside a live `DisplayPage` header.
- No internationalization. Indonesian copy matches existing strings.
- No changes to `devices.json` shape.

## Design

### Overview

The router gains a small `RootView` that switches between two children based
on whether `:screenId` is empty:

- Empty → `<MissingScreenPicker />` (new view).
- Non-empty → `<DisplayPage :screenId="..." />` (existing, untouched for the
  non-empty case).

`MissingScreenPicker` calls a new composable `useDisplayScreenList()` which
asks the device-config provider for display-role screen IDs. The provider
interface gains one method, `listDisplayScreenIds(): Promise<string[]>`.

### Package: `@aq/device-config`

`IDeviceConfigurationProvider` (in `packages/device-config/src/provider.ts`)
gains one method:

```ts
listDisplayScreenIds(): Promise<string[]>
```

`JsonDeviceConfigurationProvider.listDisplayScreenIds()` (in
`packages/device-config/src/jsonProvider.ts`) returns the catalog keys
whose `raw.role === 'display'`, sorted with `localeCompare`. It does **not**
validate each entry — that is `getConfig()`'s job. Listing is metadata-only.
If a future provider cannot enumerate, it returns `[]` and the picker shows
"no display screens configured", which is the correct user-visible behavior.

No other provider implementations exist today; the contract is documented on
the interface so future implementations have to think about it.

### App: `apps/display-web`

#### `src/composables/useDisplayScreenList.ts` (new)

Pure function returning reactive state. No module-level singletons.

Signature:

```ts
type Status = 'idle' | 'loading' | 'ok' | 'error'

interface UseDisplayScreenList {
  status: Ref<Status>
  screenIds: Ref<string[]>
  error: Ref<string | null>
  refresh: () => void
}

function useDisplayScreenList(opts?: { fetchImpl?: () => Promise<string[]> }): UseDisplayScreenList
```

Behavior:

- `fetchImpl` defaults to
  `async () => (await getDeviceConfigProvider()).listDisplayScreenIds()`.
  It is injectable for tests.
- On mount, status starts `loading`. On resolve, status `ok` and
  `screenIds` is set. On reject, status `error` and `error` is set to
  `err.message` (or a fallback string).
- Uses a `loadId` counter so that a late-resolving in-flight call cannot
  overwrite a newer call's state. `onScopeDispose` does not cancel
  the underlying promise, but the loadId guard makes it safe.
- `refresh()` increments loadId and re-fetches.

#### `src/views/MissingScreenPicker.vue` (new)

Layout: uses the existing `.panel` class. Title: "Pilih Screen Display".
Subtitle: "Pilih salah satu screen yang tersedia di devices.json."

States:

1. `loading`: shows "Memuat daftar screen…" inside the panel.
2. `ok` + non-empty: a `<ul>` of `<li>` items, each a `<RouterLink :to="\`/display/${id}\`">`
   rendering the deviceId. The link uses Vue Router so browser back works.
3. `ok` + empty: shows the message
   "Tidak ada screen display yang terdaftar di devices.json.
   Tambahkan entry dengan role: 'display' terlebih dahulu."
4. `error`: renders `<BootErrorPage :title="..." :message="error" />` with
   title "Queue Display — Boot gagal" and the underlying error message.

Styling: reuses existing CSS classes (`.panel`, `.status.error`). Adds a
minimal `.picker-list` class for the `<ul>` (indented, no bullets) and
`.picker-list a` (larger tap target, accent color). No new design tokens.

#### `src/views/RootView.vue` (new)

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import DisplayPage from './DisplayPage.vue'
import MissingScreenPicker from './MissingScreenPicker.vue'

const route = useRoute()
const screenId = computed(() => {
  const raw = route.params.screenId
  if (Array.isArray(raw)) return raw[0]?.trim() ?? ''
  return (raw ?? '').toString().trim()
})
</script>

<template>
  <DisplayPage v-if="screenId" :screen-id="screenId" />
  <MissingScreenPicker v-else />
</template>
```

The trim is intentional: a URL like `/display/%20` should also show the
picker, not pass a whitespace screenId into `DisplayPage`.

#### `src/router.ts` (updated)

Replace the two existing routes with a single route whose optional param
captures the screenId:

```ts
routes: [
  {
    path: '/:screenId?',
    name: 'display-root',
    component: RootView,
  },
]
```

This matches both `/` (`:screenId === undefined`) and `/foo`
(`:screenId === 'foo'`). `RootView` decides which child to render.

#### `src/views/DisplayPage.vue` (updated)

Remove the inline empty-screenId error branch (the lines that set
`bootError.value = 'Screen ID kosong. …'`). `RootView` no longer passes
an empty `screenId` to this view, so the check is dead. Keep all other
boot-error handling (missing token, wrong role, empty loketIds, etc.).

The existing `watch` on `props.screenId` stays; it no longer needs the
empty-string short-circuit.

### Files touched

- `packages/device-config/src/provider.ts` — interface gains one method.
- `packages/device-config/src/jsonProvider.ts` — implements the method.
- `packages/device-config/src/index.ts` — no new exports required.
- `apps/display-web/src/composables/useDisplayScreenList.ts` (new).
- `apps/display-web/src/composables/__tests__/useDisplayScreenList.spec.ts` (new).
- `apps/display-web/src/views/MissingScreenPicker.vue` (new).
- `apps/display-web/src/views/RootView.vue` (new).
- `apps/display-web/src/router.ts` — point both routes at `RootView`.
- `apps/display-web/src/views/DisplayPage.vue` — drop empty-screenId error branch.
- `apps/display-web/src/styles.css` — add `.picker-list` and `.picker-list a` rules.

### Data flow

```
/                  → RootView (screenId='') → MissingScreenPicker
                                          → useDisplayScreenList
                                          → provider.listDisplayScreenIds()
                                          → render list | empty | error

/display/lobby-poli-1
                  → RootView (screenId='lobby-poli-1') → DisplayPage
                                                       → existing boot path
```

## Error handling

- `devices.json` fetch failure: caught in `useDisplayScreenList`; status
  `error`; renders `<BootErrorPage>` with the underlying message
  (e.g., "Failed to load devices.json (404)").
- Catalog parse failure: surfaces as `error` from the composable.
- Empty result: not an error. Renders the explicit "no display screens
  configured" message.
- Late-arriving promise from a previous call cannot clobber a newer
  call's state (loadId guard).

## Testing

`packages/device-config` (vitest, default config):

- `JsonDeviceConfigurationProvider.listDisplayScreenIds()`:
  - Returns sorted display-role ids from a mixed-role catalog.
  - Ignores `kiosk` and other roles.
  - Returns `[]` for an empty catalog.
  - Returns `[]` when entries are missing `role` (defensive — matches
    what the existing `deviceConfigSchema` would reject in `getConfig`,
    but listing is metadata-only and must not throw).
  - Does not validate entries (a malformed display entry still appears
    in the list; `DisplayPage` will surface the parse error on click).

`apps/display-web` (vitest, jsdom):

- `useDisplayScreenList.spec.ts`:
  - `loading` then `ok` with ids on resolve.
  - `error` state with message on reject.
  - Late resolve from a previous call does not overwrite state when
    a second call is in flight.
  - `refresh()` re-fetches.
  - No `infrastructure` imports in the test (inject `fetchImpl`).
- `MissingScreenPicker` (component test, vue-test-utils):
  - Renders the list of `<RouterLink>` with correct `to` values.
  - Renders the empty message when list is empty.
  - Renders `BootErrorPage` when `status === 'error'`.
- `RootView` (component test):
  - Empty `screenId` → renders `MissingScreenPicker`.
  - Non-empty `screenId` → renders `DisplayPage` with the prop.
  - Whitespace `screenId` is treated as empty (trims).

Run:

```bash
pnpm --filter @aq/device-config test
pnpm --filter display-web test
pnpm --filter @aq/device-config typecheck
pnpm --filter display-web typecheck
```

## Compatibility

- `devices.json` shape unchanged.
- Existing `/:screenId` URLs continue to render `DisplayPage` via `RootView`.
- `VITE_BILREG_TOKEN` and `VITE_BILREG_API_BASE` are not required to see
  the picker, matching today's behavior (the page already renders at `/`
  even without them — it just shows a worse UI).
- The literal error string
  "Screen ID kosong. Buka dengan path /display/{screenId}." is removed.
  No repo files reference it (verified by reading the source tree);
  no docs to update.

## Out of scope (deferred)

- A "Change screen" button inside `DisplayPage` header.
- A kiosk picker (C2) using the same pattern.
- Showing `loketIds` per screen.
- Sorting by `loketIds` instead of `deviceId`.
- Auto-redirect when the catalog has exactly one display entry.
- Persisting the chosen screenId in `localStorage`.
