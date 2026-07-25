.../__tests__/useDisplayScreenList.spec.ts         | 68 ++++++++++++++++++++++
 .../src/composables/useDisplayScreenList.ts        | 62 ++++++++++++++++++++
 2 files changed, 130 insertions(+)

diff --git a/apps/display-web/src/composables/__tests__/useDisplayScreenList.spec.ts b/apps/display-web/src/composables/__tests__/useDisplayScreenList.spec.ts
new file mode 100644
index 0000000..20cf855
--- /dev/null
+++ b/apps/display-web/src/composables/__tests__/useDisplayScreenList.spec.ts
@@ -0,0 +1,68 @@
+import { describe, expect, it, vi } from 'vitest'
+import { nextTick } from 'vue'
+import { useDisplayScreenList } from '../../composables/useDisplayScreenList'
+
+describe('useDisplayScreenList', () => {
+  it('starts in loading then resolves to ok with ids', async () => {
+    const fetchImpl = vi.fn().mockResolvedValue(['lobby-igd', 'lobby-poli-1'])
+    const state = useDisplayScreenList({ fetchImpl })
+
+    expect(state.status.value).toBe('loading')
+    await new Promise((r) => setTimeout(r, 0))
+    expect(state.status.value).toBe('ok')
+    expect(state.screenIds.value).toEqual(['lobby-igd', 'lobby-poli-1'])
+    expect(state.error.value).toBeNull()
+  })
+
+  it('captures the error message on rejection', async () => {
+    const fetchImpl = vi.fn().mockRejectedValue(new Error('boom'))
+    const state = useDisplayScreenList({ fetchImpl })
+
+    await new Promise((r) => setTimeout(r, 0))
+    expect(state.status.value).toBe('error')
+    expect(state.error.value).toBe('boom')
+    expect(state.screenIds.value).toEqual([])
+  })
+
+  it('uses a fallback error message when the thrown value has no message', async () => {
+    const fetchImpl = vi.fn().mockRejectedValue('nope')
+    const state = useDisplayScreenList({ fetchImpl })
+
+    await new Promise((r) => setTimeout(r, 0))
+    expect(state.status.value).toBe('error')
+    expect(state.error.value).toBe('Gagal memuat daftar screen.')
+  })
+
+  it('refresh re-fetches and replaces state', async () => {
+    let calls = 0
+    const fetchImpl = vi.fn().mockImplementation(async () => {
+      calls += 1
+      return calls === 1 ? ['a'] : ['a', 'b']
+    })
+    const state = useDisplayScreenList({ fetchImpl })
+
+    await new Promise((r) => setTimeout(r, 0))
+    expect(state.screenIds.value).toEqual(['a'])
+
+    state.refresh()
+    await new Promise((r) => setTimeout(r, 0))
+    expect(state.screenIds.value).toEqual(['a', 'b'])
+  })
+
+  it('a stale in-flight call does not overwrite a newer result', async () => {
+    const resolvers: Array<(value: string[]) => void> = []
+    const fetchImpl = vi.fn().mockImplementation(
+      () => new Promise<string[]>((resolve) => resolvers.push(resolve)),
+    )
+    const state = useDisplayScreenList({ fetchImpl })
+
+    state.refresh()
+    resolvers[1]?.(['fresh'])
+    await nextTick()
+    expect(state.screenIds.value).toEqual(['fresh'])
+
+    resolvers[0]?.(['stale'])
+    await nextTick()
+    expect(state.screenIds.value).toEqual(['fresh'])
+  })
+})
diff --git a/apps/display-web/src/composables/useDisplayScreenList.ts b/apps/display-web/src/composables/useDisplayScreenList.ts
new file mode 100644
index 0000000..b0080e6
--- /dev/null
+++ b/apps/display-web/src/composables/useDisplayScreenList.ts
@@ -0,0 +1,62 @@
+import { getCurrentScope, onScopeDispose, ref, type Ref } from 'vue'
+import { getDeviceConfigProvider } from '../infrastructure'
+
+export type DisplayScreenListStatus = 'idle' | 'loading' | 'ok' | 'error'
+
+export interface DisplayScreenListState {
+  status: Ref<DisplayScreenListStatus>
+  screenIds: Ref<string[]>
+  error: Ref<string | null>
+  refresh: () => void
+}
+
+const FALLBACK_ERROR = 'Gagal memuat daftar screen.'
+
+export function useDisplayScreenList(opts?: {
+  fetchImpl?: () => Promise<string[]>
+}): DisplayScreenListState {
+  const status = ref<DisplayScreenListStatus>('idle')
+  const screenIds = ref<string[]>([])
+  const error = ref<string | null>(null)
+  let loadId = 0
+
+  const defaultFetch = async (): Promise<string[]> => {
+    const provider = await getDeviceConfigProvider()
+    return provider.listDisplayScreenIds()
+  }
+
+  const fetchImpl = opts?.fetchImpl ?? defaultFetch
+
+  const run = (): void => {
+    const myId = ++loadId
+    status.value = 'loading'
+    error.value = null
+    fetchImpl()
+      .then((ids) => {
+        if (myId !== loadId) return
+        screenIds.value = ids
+        status.value = 'ok'
+      })
+      .catch((err: unknown) => {
+        if (myId !== loadId) return
+        error.value = err instanceof Error && err.message ? err.message : FALLBACK_ERROR
+        screenIds.value = []
+        status.value = 'error'
+      })
+  }
+
+  run()
+
+  if (getCurrentScope()) {
+    onScopeDispose(() => {
+      loadId += 1
+    })
+  }
+
+  return {
+    status,
+    screenIds,
+    error,
+    refresh: run,
+  }
+}

--- Changes ---

apps/display-web/src/composables/__tests__/useDisplayScreenList.spec.ts
  @@ -0,0 +1,68 @@
  +import { describe, expect, it, vi } from 'vitest'
  +import { nextTick } from 'vue'
  +import { useDisplayScreenList } from '../../composables/useDisplayScreenList'
  +
  +describe('useDisplayScreenList', () => {
  +  it('starts in loading then resolves to ok with ids', async () => {
  +    const fetchImpl = vi.fn().mockResolvedValue(['lobby-igd', 'lobby-poli-1'])
  +    const state = useDisplayScreenList({ fetchImpl })
  +
  +    expect(state.status.value).toBe('loading')
  +    await new Promise((r) => setTimeout(r, 0))
  +    expect(state.status.value).toBe('ok')
  +    expect(state.screenIds.value).toEqual(['lobby-igd', 'lobby-poli-1'])
  +    expect(state.error.value).toBeNull()
  +  })
  +
  +  it('captures the error message on rejection', async () => {
  +    const fetchImpl = vi.fn().mockRejectedValue(new Error('boom'))
  +    const state = useDisplayScreenList({ fetchImpl })
  +
  +    await new Promise((r) => setTimeout(r, 0))
  +    expect(state.status.value).toBe('error')
  +    expect(state.error.value).toBe('boom')
  +    expect(state.screenIds.value).toEqual([])
  +  })
  +
  +  it('uses a fallback error message when the thrown value has no message', async () => {
  +    const fetchImpl = vi.fn().mockRejectedValue('nope')
  +    const state = useDisplayScreenList({ fetchImpl })
  +
  +    await new Promise((r) => setTimeout(r, 0))
  +    expect(state.status.value).toBe('error')
  +    expect(state.error.value).toBe('Gagal memuat daftar screen.')
  +  })
  +
  +  it('refresh re-fetches and replaces state', async () => {
  +    let calls = 0
  +    const fetchImpl = vi.fn().mockImplementation(async () => {
  +      calls += 1
  +      return calls === 1 ? ['a'] : ['a', 'b']
  +    })
  +    const state = useDisplayScreenList({ fetchImpl })
  +
  +    await new Promise((r) => setTimeout(r, 0))
  +    expect(state.screenIds.value).toEqual(['a'])
  +
  +    state.refresh()
  +    await new Promise((r) => setTimeout(r, 0))
  +    expect(state.screenIds.value).toEqual(['a', 'b'])
  +  })
  +
  +  it('a stale in-flight call does not overwrite a newer result', async () => {
  +    const resolvers: Array<(value: string[]) => void> = []
  +    const fetchImpl = vi.fn().mockImplementation(
  +      () => new Promise<string[]>((resolve) => resolvers.push(resolve)),
  +    )
  +    const state = useDisplayScreenList({ fetchImpl })
  +
  +    state.refresh()
  +    resolvers[1]?.(['fresh'])
  +    await nextTick()
  +    expect(state.screenIds.value).toEqual(['fresh'])
  +
  +    resolvers[0]?.(['stale'])
  +    await nextTick()
  +    expect(state.screenIds.value).toEqual(['fresh'])
  +  })
  +})
  +68 -0

apps/display-web/src/composables/useDisplayScreenList.ts
  @@ -0,0 +1,62 @@
  +import { getCurrentScope, onScopeDispose, ref, type Ref } from 'vue'
  +import { getDeviceConfigProvider } from '../infrastructure'
  +
  +export type DisplayScreenListStatus = 'idle' | 'loading' | 'ok' | 'error'
  +
  +export interface DisplayScreenListState {
  +  status: Ref<DisplayScreenListStatus>
  +  screenIds: Ref<string[]>
  +  error: Ref<string | null>
  +  refresh: () => void
  +}
  +
  +const FALLBACK_ERROR = 'Gagal memuat daftar screen.'
  +
  +export function useDisplayScreenList(opts?: {
  +  fetchImpl?: () => Promise<string[]>
  +}): DisplayScreenListState {
  +  const status = ref<DisplayScreenListStatus>('idle')
  +  const screenIds = ref<string[]>([])
  +  const error = ref<string | null>(null)
  +  let loadId = 0
  +
  +  const defaultFetch = async (): Promise<string[]> => {
  +    const provider = await getDeviceConfigProvider()
  +    return provider.listDisplayScreenIds()
  +  }
  +
  +  const fetchImpl = opts?.fetchImpl ?? defaultFetch
  +
  +  const run = (): void => {
  +    const myId = ++loadId
  +    status.value = 'loading'
  +    error.value = null
  +    fetchImpl()
  +      .then((ids) => {
  +        if (myId !== loadId) return
  +        screenIds.value = ids
  +        status.value = 'ok'
  +      })
  +      .catch((err: unknown) => {
  +        if (myId !== loadId) return
  +        error.value = err instanceof Error && err.message ? err.message : FALLBACK_ERROR
  +        screenIds.value = []
  +        status.value = 'error'
  +      })
  +  }
  +
  +  run()
  +
  +  if (getCurrentScope()) {
  +    onScopeDispose(() => {
  +      loadId += 1
  +    })
  +  }
  +
  +  return {
  +    status,
  +    screenIds,
  +    error,
  +    refresh: run,
  +  }
  +}
  +62 -0
8a74319 feat(display-web): add useDisplayScreenList composable
