# Task 4 Fix Report — useDisplayScreenList `onScopeDispose` warning

## What changed

Two edits to `apps/display-web/src/composables/useDisplayScreenList.ts`:

1. Import line — added `getCurrentScope`:
   ```ts
   // before
   import { onScopeDispose, ref, type Ref } from 'vue'
   // after
   import { getCurrentScope, onScopeDispose, ref, type Ref } from 'vue'
   ```

2. Guarded the `onScopeDispose` call so it only registers when an active
   effect scope exists. Production behavior is identical (Vue components
   always provide one); tests that call the composable without a scope
   no longer trigger Vue's warning.
   ```ts
   if (getCurrentScope()) {
     onScopeDispose(() => {
       loadId += 1
     })
   }
   ```

The composable's public contract is unchanged: `loadId` is still bumped
on dispose when a scope exists (real components), and the stale-loadId
guard inside `run()` is still correct in all current call sites.

## Test output BEFORE the fix

5 `useDisplayScreenList` tests passed, but each one printed a Vue
warning on stderr:

```
[Vue warn] onScopeDispose() is called when there is no active effect scope to be associated with.
```

…repeated 5 times (once per test).

Captured verbatim in `.superpowers/sdd/task-4-before.txt`.

## Test output AFTER the fix

```
✓ src/composables/__tests__/useDisplayScreenList.spec.ts (5 tests) 37ms

Test Files  1 passed (1)
     Tests  5 passed (5)
```

Zero `[Vue warn]` lines on stderr. Captured in
`.superpowers/sdd/task-4-after.txt`.

## Full display-web suite

```
✓ src/lib/__tests__/snapshot.spec.ts                (4 tests)
✓ src/lib/__tests__/announcementGate.spec.ts        (5 tests)
✓ src/lib/__tests__/boot.spec.ts                    (3 tests)
✓ src/composables/__tests__/useVersionAutoRefresh.spec.ts (2 tests)
✓ src/__tests__/infrastructure.spec.ts              (3 tests)
✓ src/composables/__tests__/useDisplayScreenList.spec.ts (5 tests)

Test Files  6 passed (6)
     Tests  22 passed (22)
```

No Vue warnings anywhere. Captured in `.superpowers/sdd/task-4-full.txt`.

## Typecheck

`pnpm --filter display-web typecheck` (vue-tsc -p tsconfig.app.json --noEmit)
produced no output and exited 0. Captured in
`.superpowers/sdd/task-4-typecheck.txt`.

## Amended commit

- Old SHA: `3afd194 feat(display-web): add useDisplayScreenList composable`
- New SHA: `8a74319 feat(display-web): add useDisplayScreenList composable`
- Diff against the previous tip: +6 / -4 in
  `apps/display-web/src/composables/useDisplayScreenList.ts` (the import
  line and the guarded block).

## Self-review

- The guard is the exact pattern the brief mandated; no creative deviation.
- No other composable in `apps/display-web/src/composables/` was touched
  or needed a similar guard. `useVersionAutoRefresh` is only consumed
  inside a real component (`App.vue`) where the scope always exists.
- `loadId` is a closure-local, so skipping the dispose registration in
  test environments has no observable effect on tests — the stale-loadId
  guard in `run()` is only meaningful when a later `run()` can race
  against a still-pending fetch after a parent component unmounts. In
  tests each call to `useDisplayScreenList` lives for the whole test and
  is the only owner of `loadId`.
- The `--amend` was scoped to a single file via `rtk git add …`; the
  unrelated modifications to `AGENTS.md` and `apps/kiosk-web/public/devices.json`
  were left unstaged and are not part of this commit.
- No production code path is changed: every component invocation still
  registers a dispose callback because `effectScope` is always present
  in component setup.

## Concerns

None. The fix is a one-line behavioral guard plus the matching import,
all verification commands pass, and the commit history stays clean.
