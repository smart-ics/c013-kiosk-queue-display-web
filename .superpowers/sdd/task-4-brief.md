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
Expected: FAIL â€” the module does not exist yet, so import will throw.

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
Expected: PASS â€” all five tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/display-web/src/composables/useDisplayScreenList.ts apps/display-web/src/composables/__tests__/useDisplayScreenList.spec.ts
git commit -m "feat(display-web): add useDisplayScreenList composable"
```

---

