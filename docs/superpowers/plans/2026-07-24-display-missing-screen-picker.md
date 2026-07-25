# Display Missing-Screen Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the "Screen ID kosong" dead-end error in `apps/display-web` with a clickable picker that lists every display-role screen from `devices.json` and links to `/display/{screenId}`.

**Architecture:** Router gains a `RootView` switch that renders either `DisplayPage` (non-empty `screenId`) or a new `MissingScreenPicker` (empty `screenId`). The picker asks a new `listDisplayScreenIds()` method on `IDeviceConfigurationProvider` for the list. The `JsonDeviceConfigurationProvider` filters its in-memory catalog by `raw.role === 'display'` and returns sorted keys.

**Tech Stack:** Vue 3 (`<script setup lang="ts">`), Vue Router 4, TypeScript, Vitest, vue-test-utils, jsdom.

**Spec:** `docs/superpowers/specs/2026-07-24-display-missing-screen-picker-design.md`

## Global Constraints

- Node `^20.19.0 || >=22.12.0`; pnpm `10.14.0`; enforced via `packageManager` + `engines` in root `package.json`.
- TypeScript strict: `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax`.
- Vue apps: `vue-tsc -p tsconfig.app.json --noEmit` (typecheck); `vitest run` (test).
- Packages: `tsc` (typecheck); `vitest run` (test).
- `pnpm` is the package manager. Do not introduce npm/yarn scripts.
- Indonesian user-facing copy; matches existing strings (e.g. "Memuat…", "Boot gagal").
- No comments unless explaining non-obvious intent (existing repo convention).
- Do not add `@microsoft/signalr` to `kiosk-web` (out of scope; nothing here imports it).
- `apps/*/src/infrastructure.ts` is the only place that wires `getDeviceConfigProvider()` outside of tests.
- `device-config` package has no Vue dependency; `apps/display-web` has the composable + view.
- Existing `BootErrorPage` props (`title`, `message`) are reused as-is.
- `RouterLink` (from `vue-router`) is the link primitive. Do not hand-roll `<a>` tags for app routes.

## File Structure

| File | Status | Responsibility |
| --- | --- | --- |
| `packages/device-config/src/provider.ts` | Modify | Add `listDisplayScreenIds(): Promise<string[]>` to the interface. |
| `packages/device-config/src/jsonProvider.ts` | Modify | Implement the method: return sorted catalog keys whose `raw.role === 'display'`. |
| `packages/device-config/src/__tests__/deviceConfig.spec.ts` | Modify | Add unit tests for the new method. |
| `apps/display-web/src/composables/useDisplayScreenList.ts` | Create | Reactive `{ status, screenIds, error, refresh }` over the provider method; injectable `fetchImpl`. |
| `apps/display-web/src/composables/__tests__/useDisplayScreenList.spec.ts` | Create | Unit tests for the composable. |
| `apps/display-web/src/views/MissingScreenPicker.vue` | Create | Picker view: list / empty / error branches. |
| `apps/display-web/src/views/RootView.vue` | Create | Switches between `DisplayPage` and `MissingScreenPicker` based on `screenId`. |
| `apps/display-web/src/router.ts` | Modify | Replace the two existing routes with `/:screenId?` → `RootView`. |
| `apps/display-web/src/views/DisplayPage.vue` | Modify | Drop the inline empty-screenId error branch. |
| `apps/display-web/src/styles.css` | Modify | Add `.picker-list` and `.picker-list a` rules. |

Tasks are ordered to keep each one independently testable and to keep package
changes separate from app changes. Tasks 1–3 ship the package surface; Tasks
4–7 ship the app.

---

### Task 1: Add `listDisplayScreenIds()` to the device-config interface

**Files:**
- Modify: `packages/device-config/src/provider.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `IDeviceConfigurationProvider.listDisplayScreenIds(): Promise<string[]>`.

- [ ] **Step 1: Edit `packages/device-config/src/provider.ts`**

Add the new method declaration to the interface. The full file becomes:

```ts
import type { DeviceConfig } from '@aq/shared-types'

export interface IDeviceConfigurationProvider {
  getConfig(deviceId: string): Promise<DeviceConfig>
  listDisplayScreenIds(): Promise<string[]>
}

export class DeviceConfigNotFoundError extends Error {
  readonly code = 'DEVICE_CONFIG_NOT_FOUND' as const
  readonly deviceId: string

  constructor(deviceId: string) {
    super(`Unknown device configuration for '${deviceId}'`)
    this.name = 'DeviceConfigNotFoundError'
    this.deviceId = deviceId
  }
}

export class DeviceConfigInvalidError extends Error {
  readonly code = 'DEVICE_CONFIG_INVALID' as const
  readonly deviceId: string

  constructor(deviceId: string, message: string) {
    super(message)
    this.name = 'DeviceConfigInvalidError'
    this.deviceId = deviceId
  }
}
```

The only change is the single new line in the interface body.

- [ ] **Step 2: Run typecheck to confirm the interface change compiles**

Run from repo root: `pnpm --filter @aq/device-config typecheck`
Expected: PASS. (`tsc` will not typecheck other packages; the only consumer in repo is `apps/display-web` which is not wired to the new method yet — that is Task 5.)

- [ ] **Step 3: Commit**

```bash
git add packages/device-config/src/provider.ts
git commit -m "feat(device-config): add listDisplayScreenIds to provider interface"
```

---

### Task 2: Implement `listDisplayScreenIds()` on `JsonDeviceConfigurationProvider`

**Files:**
- Modify: `packages/device-config/src/jsonProvider.ts`

**Interfaces:**
- Consumes: `IDeviceConfigurationProvider` from Task 1.
- Produces: `JsonDeviceConfigurationProvider.listDisplayScreenIds()` returns the sorted deviceIds whose `raw.role === 'display'`. Sort uses `localeCompare`. Entries with no `role` or a non-`'display'` role are excluded. Does not call `getConfig`; does not validate.

- [ ] **Step 1: Add the method to `JsonDeviceConfigurationProvider`**

Edit `packages/device-config/src/jsonProvider.ts`. The full file becomes:

```ts
import { deviceConfigSchema, type DeviceConfig } from '@aq/shared-types'
import {
  DeviceConfigInvalidError,
  DeviceConfigNotFoundError,
  type IDeviceConfigurationProvider,
} from './provider'

export type DeviceConfigCatalog = Record<string, Omit<DeviceConfig, 'deviceId'> & { deviceId?: string }>

export class JsonDeviceConfigurationProvider implements IDeviceConfigurationProvider {
  private readonly catalog: DeviceConfigCatalog

  constructor(catalog: DeviceConfigCatalog) {
    this.catalog = catalog
  }

  static fromJson(json: unknown): JsonDeviceConfigurationProvider {
    if (!json || typeof json !== 'object' || Array.isArray(json)) {
      throw new DeviceConfigInvalidError('*', 'Device catalog must be a JSON object keyed by deviceId')
    }
    return new JsonDeviceConfigurationProvider(json as DeviceConfigCatalog)
  }

  async getConfig(deviceId: string): Promise<DeviceConfig> {
    const key = deviceId.trim()
    if (!key) throw new DeviceConfigNotFoundError(deviceId)

    const raw = this.catalog[key]
    if (!raw) throw new DeviceConfigNotFoundError(key)

    const parsed = deviceConfigSchema.safeParse({
      ...raw,
      deviceId: raw.deviceId ?? key,
    })

    if (!parsed.success) {
      throw new DeviceConfigInvalidError(key, parsed.error.message)
    }

    if (parsed.data.deviceId !== key) {
      throw new DeviceConfigInvalidError(
        key,
        `Catalog entry deviceId '${parsed.data.deviceId}' does not match key '${key}'`,
      )
    }

    return parsed.data
  }

  async listDisplayScreenIds(): Promise<string[]> {
    return Object.entries(this.catalog)
      .filter(([, raw]) => raw?.role === 'display')
      .map(([id]) => id)
      .sort((a, b) => a.localeCompare(b))
  }
}
```

The only addition is the `listDisplayScreenIds` method at the bottom of the class.

- [ ] **Step 2: Run typecheck**

Run from repo root: `pnpm --filter @aq/device-config typecheck`
Expected: PASS. The implementation matches the interface from Task 1.

- [ ] **Step 3: Commit**

```bash
git add packages/device-config/src/jsonProvider.ts
git commit -m "feat(device-config): implement listDisplayScreenIds on json provider"
```

---

### Task 3: Unit tests for `listDisplayScreenIds()`

**Files:**
- Modify: `packages/device-config/src/__tests__/deviceConfig.spec.ts`

**Interfaces:**
- Consumes: `JsonDeviceConfigurationProvider` from Task 2.
- Produces: tests that pass with the implementation in Task 2.

- [ ] **Step 1: Add a `describe` block to the existing spec file**

Edit `packages/device-config/src/__tests__/deviceConfig.spec.ts`. The full file becomes:

```ts
import { describe, expect, it } from 'vitest'
import { parseScreenIdFromPath, parseStationIdFromPath } from '../path'
import { JsonDeviceConfigurationProvider } from '../jsonProvider'
import { DeviceConfigNotFoundError } from '../provider'

describe('parseStationIdFromPath', () => {
  it('parses stationId from /kiosk/{stationId}', () => {
    expect(parseStationIdFromPath('/kiosk/loket-03')).toBe('loket-03')
    expect(parseStationIdFromPath('/kiosk/loket-03/')).toBe('loket-03')
  })

  it('returns null for unknown or empty paths', () => {
    expect(parseStationIdFromPath('/display/lobby-1')).toBeNull()
    expect(parseStationIdFromPath('/kiosk/')).toBeNull()
    expect(parseStationIdFromPath('/')).toBeNull()
  })
})

describe('parseScreenIdFromPath', () => {
  it('parses screenId from /display/{screenId}', () => {
    expect(parseScreenIdFromPath('/display/lobby-poli-1')).toBe('lobby-poli-1')
  })
})

describe('JsonDeviceConfigurationProvider', () => {
  const provider = new JsonDeviceConfigurationProvider({
    'loket-03': {
      role: 'kiosk',
      servicePointIds: ['SP-REG'],
    },
    'lobby-poli-1': {
      role: 'display',
      loketIds: ['L1', 'L2'],
      pollIntervalMs: 15000,
      audioEnabled: true,
    },
  })

  it('returns config for known station', async () => {
    const config = await provider.getConfig('loket-03')
    expect(config).toEqual({
      deviceId: 'loket-03',
      role: 'kiosk',
      servicePointIds: ['SP-REG'],
    })
  })

  it('returns config for known display screen', async () => {
    const config = await provider.getConfig('lobby-poli-1')
    expect(config).toEqual({
      deviceId: 'lobby-poli-1',
      role: 'display',
      loketIds: ['L1', 'L2'],
      pollIntervalMs: 15000,
      audioEnabled: true,
    })
  })

  it('fails closed for unknown station', async () => {
    await expect(provider.getConfig('unknown-station')).rejects.toBeInstanceOf(
      DeviceConfigNotFoundError,
    )
  })

  it('lists only display-role screen ids', async () => {
    const ids = await provider.listDisplayScreenIds()
    expect(ids).toEqual(['lobby-poli-1'])
  })
})

describe('JsonDeviceConfigurationProvider.listDisplayScreenIds', () => {
  it('returns sorted display ids from a mixed catalog', async () => {
    const provider = new JsonDeviceConfigurationProvider({
      'lobby-igd': { role: 'display', loketIds: ['L3'] },
      'lobby-poli-1': { role: 'display', loketIds: ['L1', 'L2'] },
      'loket-03': { role: 'kiosk', servicePointIds: ['SP-REG'] },
    })
    const ids = await provider.listDisplayScreenIds()
    expect(ids).toEqual(['lobby-igd', 'lobby-poli-1'])
  })

  it('returns an empty array when there are no display entries', async () => {
    const provider = new JsonDeviceConfigurationProvider({
      'loket-03': { role: 'kiosk', servicePointIds: ['SP-REG'] },
    })
    expect(await provider.listDisplayScreenIds()).toEqual([])
  })

  it('returns an empty array for an empty catalog', async () => {
    const provider = new JsonDeviceConfigurationProvider({})
    expect(await provider.listDisplayScreenIds()).toEqual([])
  })

  it('ignores entries with no role', async () => {
    const provider = new JsonDeviceConfigurationProvider({
      'no-role': { servicePointIds: ['SP-REG'] } as never,
    })
    expect(await provider.listDisplayScreenIds()).toEqual([])
  })

  it('returns ids even if the entry would fail getConfig validation', async () => {
    const provider = new JsonDeviceConfigurationProvider({
      'broken-display': { role: 'display' } as never,
    })
    expect(await provider.listDisplayScreenIds()).toEqual(['broken-display'])
  })
})
```

The change is two new `describe` blocks (one nested, one top-level) at the end of the file.

- [ ] **Step 2: Run the test suite**

Run from repo root: `pnpm --filter @aq/device-config test`
Expected: PASS, all old tests still pass, all new tests pass.

- [ ] **Step 3: Commit**

```bash
git add packages/device-config/src/__tests__/deviceConfig.spec.ts
git commit -m "test(device-config): cover listDisplayScreenIds"
```

---

### Task 4: Create the `useDisplayScreenList` composable

**Files:**
- Create: `apps/display-web/src/composables/useDisplayScreenList.ts`

**Interfaces:**
- Consumes: `getDeviceConfigProvider` from `apps/display-web/src/infrastructure.ts`. The composable imports it lazily (only when no `fetchImpl` is provided) so tests can run without the module-level singleton.
- Produces:

```ts
export type DisplayScreenListStatus = 'idle' | 'loading' | 'ok' | 'error'

export interface DisplayScreenListState {
  status: Ref<DisplayScreenListStatus>
  screenIds: Ref<string[]>
  error: Ref<string | null>
  refresh: () => void
}

export function useDisplayScreenList(opts?: {
  fetchImpl?: () => Promise<string[]>
}): DisplayScreenListState
```

Behavior contract:
- On first call (status `idle`), kicks off a fetch (status `loading`).
- On resolve, sets status `ok` and `screenIds` to the resolved array.
- On reject, sets status `error` and `error` to `err.message ?? 'Gagal memuat daftar screen.'`.
- A `loadId` counter prevents a stale in-flight call from overwriting a newer state.
- `refresh()` increments `loadId` and re-fetches.

- [ ] **Step 1: Write the failing test**

Create `apps/display-web/src/composables/__tests__/useDisplayScreenList.spec.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { useDisplayScreenList } from '../../composables/useDisplayScreenList'

describe('useDisplayScreenList', () => {
  it('starts in loading then resolves to ok with ids', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(['lobby-igd', 'lobby-poli-1'])
    const state = useDisplayScreenList({ fetchImpl })

    expect(state.status.value).toBe('loading')
    await new Promise((r) => setTimeout(r, 0))
    expect(state.status.value).toBe('ok')
    expect(state.screenIds.value).toEqual(['lobby-igd', 'lobby-poli-1'])
    expect(state.error.value).toBeNull()
  })

  it('captures the error message on rejection', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('boom'))
    const state = useDisplayScreenList({ fetchImpl })

    await new Promise((r) => setTimeout(r, 0))
    expect(state.status.value).toBe('error')
    expect(state.error.value).toBe('boom')
    expect(state.screenIds.value).toEqual([])
  })

  it('uses a fallback error message when the thrown value has no message', async () => {
    const fetchImpl = vi.fn().mockRejectedValue('nope')
    const state = useDisplayScreenList({ fetchImpl })

    await new Promise((r) => setTimeout(r, 0))
    expect(state.status.value).toBe('error')
    expect(state.error.value).toBe('Gagal memuat daftar screen.')
  })

  it('refresh re-fetches and replaces state', async () => {
    let calls = 0
    const fetchImpl = vi.fn().mockImplementation(async () => {
      calls += 1
      return calls === 1 ? ['a'] : ['a', 'b']
    })
    const state = useDisplayScreenList({ fetchImpl })

    await new Promise((r) => setTimeout(r, 0))
    expect(state.screenIds.value).toEqual(['a'])

    state.refresh()
    await new Promise((r) => setTimeout(r, 0))
    expect(state.screenIds.value).toEqual(['a', 'b'])
  })

  it('a stale in-flight call does not overwrite a newer result', async () => {
    const resolvers: Array<(value: string[]) => void> = []
    const fetchImpl = vi.fn().mockImplementation(
      () => new Promise<string[]>((resolve) => resolvers.push(resolve)),
    )
    const state = useDisplayScreenList({ fetchImpl })

    state.refresh()
    resolvers[1]?.(['fresh'])
    await nextTick()
    expect(state.screenIds.value).toEqual(['fresh'])

    resolvers[0]?.(['stale'])
    await nextTick()
    expect(state.screenIds.value).toEqual(['fresh'])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run from repo root: `pnpm --filter display-web test -- src/composables/__tests__/useDisplayScreenList.spec.ts`
Expected: FAIL — the module does not exist yet, so import will throw.

- [ ] **Step 3: Implement the composable**

Create `apps/display-web/src/composables/useDisplayScreenList.ts`:

```ts
import { onScopeDispose, ref, type Ref } from 'vue'
import { getDeviceConfigProvider } from '../infrastructure'

export type DisplayScreenListStatus = 'idle' | 'loading' | 'ok' | 'error'

export interface DisplayScreenListState {
  status: Ref<DisplayScreenListStatus>
  screenIds: Ref<string[]>
  error: Ref<string | null>
  refresh: () => void
}

const FALLBACK_ERROR = 'Gagal memuat daftar screen.'

export function useDisplayScreenList(opts?: {
  fetchImpl?: () => Promise<string[]>
}): DisplayScreenListState {
  const status = ref<DisplayScreenListStatus>('idle')
  const screenIds = ref<string[]>([])
  const error = ref<string | null>(null)
  let loadId = 0

  const defaultFetch = async (): Promise<string[]> => {
    const provider = await getDeviceConfigProvider()
    return provider.listDisplayScreenIds()
  }

  const fetchImpl = opts?.fetchImpl ?? defaultFetch

  const run = (): void => {
    const myId = ++loadId
    status.value = 'loading'
    error.value = null
    fetchImpl()
      .then((ids) => {
        if (myId !== loadId) return
        screenIds.value = ids
        status.value = 'ok'
      })
      .catch((err: unknown) => {
        if (myId !== loadId) return
        error.value = err instanceof Error && err.message ? err.message : FALLBACK_ERROR
        screenIds.value = []
        status.value = 'error'
      })
  }

  run()

  onScopeDispose(() => {
    loadId += 1
  })

  return {
    status,
    screenIds,
    error,
    refresh: run,
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run from repo root: `pnpm --filter display-web test -- src/composables/__tests__/useDisplayScreenList.spec.ts`
Expected: PASS — all five tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/display-web/src/composables/useDisplayScreenList.ts apps/display-web/src/composables/__tests__/useDisplayScreenList.spec.ts
git commit -m "feat(display-web): add useDisplayScreenList composable"
```

---

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
    title="Queue Display — Boot gagal"
    :message="error ?? 'Gagal memuat daftar screen.'"
  />

  <section v-else class="panel">
    <h1>Pilih Screen Display</h1>
    <p class="status">Pilih salah satu screen yang tersedia di devices.json.</p>

    <p v-if="status === 'loading'" class="status">Memuat daftar screen…</p>

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
- The branch order is: `error` → `loading` (inside the panel) → `empty` (inside
  the panel) → list. Each branch is exclusive because of the `v-if`/`v-else-if`
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

### Task 9: Final verification (full test + typecheck + build)

**Files:** none.

- [ ] **Step 1: Run all package tests**

Run from repo root: `pnpm --filter @aq/device-config test`
Expected: PASS.

- [ ] **Step 2: Run all app tests**

Run from repo root: `pnpm --filter display-web test`
Expected: PASS.

- [ ] **Step 3: Run typecheck for the changed package and app**

Run from repo root: `pnpm --filter @aq/device-config typecheck && pnpm --filter display-web typecheck`
Expected: PASS.

- [ ] **Step 4: Run the full monorepo build**

Run from repo root: `pnpm build`
Expected: PASS. (`turbo` fans out to all packages; the kiosk app and other
packages should be unaffected.)

- [ ] **Step 5: Commit nothing (or a chore commit if the build surfaced a fix)**

If everything passes, do not create a new commit. If a build fix was needed,
commit it now with message `chore: build fix from display picker rollout`.

---

## Self-Review

1. **Spec coverage:**
   - New `listDisplayScreenIds()` on interface → Task 1.
   - Implementation on `JsonDeviceConfigurationProvider` → Task 2.
   - Tests for the new method (sorted, ignores non-display, empty catalog, missing role, invalid entry still listed) → Task 3.
   - Composable with injectable `fetchImpl` and loadId guard → Task 4.
   - Picker view with list / empty / loading / error branches → Task 5.
   - Router change `/:screenId?` → `RootView` → Task 6.
   - Remove dead empty-screenId error from `DisplayPage` → Task 7.
   - Trims whitespace (URL like `/display/%20%20`) → covered in `RootView` (Task 6) and verified manually in Task 8.
   - Catalog fetch failure → `BootErrorPage` in `MissingScreenPicker` (Task 5).
   - Empty list message → "Tidak ada screen display yang terdaftar…" (Task 5).
   - Each item is a clickable link to `/display/{screenId}` → `RouterLink` (Task 5).
   - `devices.json` shape unchanged → no file change to it.
   - No new env vars, no new API → no file change for env/API.

2. **Placeholder scan:** No TBD/TODO/"implement later". Every step has the
   code or command it requires.

3. **Type consistency:** The composable returns `{ status, screenIds, error,
   refresh }`; both the test (Task 4) and the consumer (Task 5) use exactly
   these names. The provider method name `listDisplayScreenIds` is identical
   across Tasks 1, 2, 3, and the production call in Task 4 (`defaultFetch`).
   `MissingScreenPicker` reads `screenIds` and `error` and writes nothing
   back, matching the composable's return contract.
