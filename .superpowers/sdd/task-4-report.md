# Task 4 Report — `useDisplayScreenList` composable

## What was implemented

Created the Vue 3 composable `useDisplayScreenList` in
`apps/display-web/src/composables/useDisplayScreenList.ts` plus its
Vitest spec at `apps/display-web/src/composables/__tests__/useDisplayScreenList.spec.ts`.

The composable wraps `IDeviceConfigurationProvider.listDisplayScreenIds()`,
exposes reactive `status` / `screenIds` / `error` refs, a `refresh()` action,
and uses a `loadId` counter to discard stale in-flight resolutions. When
no `fetchImpl` is provided it lazily resolves the singleton
`IDeviceConfigurationProvider` via `getDeviceConfigProvider()` so tests
can run without the module-level singleton.

Both files were created verbatim from the task brief (Steps 1 and 3).
No deviation from the specified text.

## TDD Evidence

### RED — test fails because module does not exist

Command:
```
pnpm --filter display-web test -- src/composables/__tests__/useDisplayScreenList.spec.ts
```

Relevant output (pre-implementation):
```
 FAIL  src/composables/__tests__/useDisplayScreenList.spec.ts
Error: Failed to resolve import "../../composables/useDisplayScreenList"
from "src/composables/__tests__/useDisplayScreenList.spec.ts". Does the file exist?
  Plugin: vite:import-analysis
 Test Files  1 failed (1)
      Tests  no tests
```

Why this is the expected failure: the spec file imports
`useDisplayScreenList` from a module that has not been created yet. The
transform/import-analysis plugin rejects the resolution, so vitest reports
the suite as failed before any test body runs. This proves the test is
actually exercising the new module path.

### GREEN — all five tests pass

Command (identical):
```
pnpm --filter display-web test -- src/composables/__tests__/useDisplayScreenList.spec.ts
```

Relevant output (post-implementation):
```
 RUN  v3.2.7  E:/PROJECT/ICS/FE/c013-kiosk-queue-display-web/apps/display-web

stderr | useDisplayScreenList > starts in loading then resolves to ok with ids
[Vue warn] onScopeDispose() is called when there is no active effect scope to be associated with.
stderr | useDisplayScreenList > captures the error message on rejection
[Vue warn] onScopeDispose() is called when there is no active effect scope to be associated with.
stderr | useDisplayScreenList > uses a fallback error message when the thrown value has no message
[Vue warn] onScopeDispose() is called when there is no active effect scope to be associated with.
stderr | useDisplayScreenList > refresh re-fetches and replaces state
[Vue warn] onScopeDispose() is called when there is no active effect scope to be associated with.
stderr | useDisplayScreenList > a stale in-flight call does not overwrite a newer result
[Vue warn] onScopeDispose() is called when there is no active effect scope to be associated with.

 ✓ src/composables/__tests__/useDisplayScreenList.spec.ts (5 tests) 36ms

 Test Files  1 passed (1)
      Tests  5 passed (5)
```

All 5/5 cases pass:
1. `starts in loading then resolves to ok with ids`
2. `captures the error message on rejection`
3. `uses a fallback error message when the thrown value has no message`
4. `refresh re-fetches and replaces state`
5. `a stale in-flight call does not overwrite a newer result`

A full `pnpm --filter display-web test` run also passed (6 files, 22/22 tests).

## Files changed

- `apps/display-web/src/composables/useDisplayScreenList.ts` (new, 60 lines)
- `apps/display-web/src/composables/__tests__/useDisplayScreenList.spec.ts` (new, 68 lines)

Commit: `3afd194 feat(display-web): add useDisplayScreenList composable`

## Self-review findings

- **Spec file matches brief line-for-line:** yes — copied the exact content
  from Step 1, including the `'use vitest'` style imports and the
  `await new Promise((r) => setTimeout(r, 0))` flushing idiom.
- **Implementation matches brief line-for-line:** yes — copied the exact
  content from Step 3, including the `onScopeDispose` registration,
  the `loadId` race-guard pattern, and the `FALLBACK_ERROR` constant.
- **TDD actually ran (RED then GREEN):** both runs captured above, in
  chronological order.
- **Test output pristine?** No — the green run emits five
  `[Vue warn] onScopeDispose() is called when there is no active effect
  scope to be associated with.` warnings (one per test). These are
  emitted by the composable itself, not by a test bug. See concerns below.
- **Commit message exact:** `feat(display-web): add useDisplayScreenList composable`
  matches Step 5 of the brief exactly.
- **Typecheck:** `pnpm --filter display-web typecheck` passes silently.

## Concerns

1. **Vue warning on `onScopeDispose`.** The composable registers an
   `onScopeDispose` cleanup that increments `loadId`. When the test calls
   the composable without an active Vue effect scope, Vue logs a warning
   per call. The brief specifies this exact implementation, so the warning
   is intrinsic to the chosen design (and harmless — `loadId` is just a
   counter, the increment is a no-op when the component is unmounted). It
   is not a test failure and does not affect behaviour. The other
   composable test in this app (`useVersionAutoRefresh.spec.ts`) does not
   trigger this warning because it does not use `onScopeDispose`. If the
   team wants a pristine test output, the cleanup can be moved behind a
   `try { onScopeDispose(...) } catch {}` guard or made conditional on
   `getCurrentScope()`, but that would be a deviation from the brief and
   is left to a follow-up.
2. The test is fully self-contained — `fetchImpl` is provided in every
   case, so `getDeviceConfigProvider()` is never invoked. No need to
   reset infrastructure singletons in the spec.
