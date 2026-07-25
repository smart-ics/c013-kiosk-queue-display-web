# Task 8 — Report

**Status: BLOCKED** (build failure from rebase integration)

## Adapted Step 1: Production build

**Command:** `pnpm --filter display-web build`

**Result: FAIL** — `vue-tsc` reports 3 type errors before `vite build` can run.

```
src/infrastructure.ts(39,3): error TS2741: Property 'listDisplayScreenIds' is missing in type
  'ApiDeviceConfigurationProvider' but required in type 'IDeviceConfigurationProvider'.
src/infrastructure.ts(42,3): error TS2322: Type 'IDeviceConfigurationProvider | null' is not
  assignable to type 'IDeviceConfigurationProvider'.
  Type 'null' is not assignable to type 'IDeviceConfigurationProvider'.
../../packages/device-config/src/apiProvider.ts(12,14): error TS2420: Class
  'ApiDeviceConfigurationProvider' incorrectly implements interface 'IDeviceConfigurationProvider'.
  Property 'listDisplayScreenIds' is missing in type 'ApiDeviceConfigurationProvider' but required
  in type 'IDeviceConfigurationProvider'.
```

### Diagnosis (rebase integration bug, pre-existing — NOT a Task 8 issue)

The rebase of `feat/display-missing-screen-picker` onto `main` interleaved commits
from a different feature branch (`feat/config-web` / API-backed device config). The
interleaving left the workspace in a state where:

- `IDeviceConfigurationProvider` requires `listDisplayScreenIds()`
  (added in `430fc81 feat(device-config): add listDisplayScreenIds to provider interface`)
- `JsonDeviceConfigurationProvider` implements it (`c32c7ad`)
- `ApiDeviceConfigurationProvider` (introduced in main via `1f825ed feat(display): add
  API-backed device configuration provider`) was committed **before** the interface
  gained the method and never received the implementation.

The picker's runtime path uses `JsonDeviceConfigurationProvider` (when
`VITE_DEVICE_CONFIG_PROVIDER=json`) or `ApiDeviceConfigurationProvider` (default).
The `json` mode would typecheck if selected at build time, but the default is `api`
(see `getProviderMode()` in `apps/display-web/src/infrastructure.ts:20`), so the
type error fires unconditionally at `vue-tsc` time.

This is a pre-existing rebase artifact, not new in Task 8. Tasks 1–7 did not touch
`packages/device-config/src/apiProvider.ts` or `apps/display-web/src/infrastructure.ts`
(both file histories end before the Task 1 work).

### Why I did not fix it in this task

The brief for Task 8 says "STOP and escalate... when the build fails for a
non-obvious reason." The fix lives in the device-config package and the
infrastructure wiring — neither of which Task 8 owns. Touching them would expand
the task scope into a rebase-cleanup effort.

Suggested next step (for the controller): add a `listDisplayScreenIds()` stub
to `ApiDeviceConfigurationProvider` (returns `[]` and/or queries the API once that
endpoint exists), or split the interface so the API provider implements a
display-read subset. Either fix is small but is out of Task 8's verification
scope.

## Adapted Steps 2–3, 4, 5, 6: NOT EXECUTED

- **Step 2** (start preview server): skipped — no build artifact to serve.
- **Step 3** (curl three URLs): skipped.
- **Step 4** (write & run `RootView.spec.ts`): skipped — the new spec file would
  still be valuable, but per the brief it must be committed *with* a green build
  for Step 6 to make sense. The spec is also valid to land independently; see
  "Partial option" below.
- **Step 5** (cleanup): not needed (no server was started).
- **Step 6** (commit): not executed (no files committed).

### Partial option (decision left to controller)

If the controller wants the spec file added now as a forward-looking commit, the
`RootView.spec.ts` file does not depend on the API provider and is safe to land
on the branch independent of the build fix. It would still pass `vitest run` for
the `display-web` filter once the build is unblocked, because the test does not
import `infrastructure.ts`. I did not write it because the brief orders the test
under Step 4, which presupposes a green build, and creating a new commit on a
broken build felt like the wrong default. Happy to write the spec in a follow-up
if desired.

## Self-review findings

- The three type errors all trace back to the same root cause (one missing method
  on one class). The two errors in `infrastructure.ts` cascade from the first.
- The non-null assertion in the type at `infrastructure.ts:42` is a pre-existing
  pattern (line 38 `getRuntimeDeviceApi()` already returns nullable before the
  rebase; the cascade exposed it). Fixing the API provider will also resolve
  this.
- I verified the brief's "Other packages out of scope" list matches my diagnosis:
  no other package (kiosk-web, config-web, api-client, auth, signalr-client,
  shared-types) is implicated in the type errors.

## Concerns

1. **Build is red before this task even started.** The rebase into main left the
   branch in a state where `vue-tsc` fails. Any task that calls `pnpm --filter
   display-web build` (Tasks 1–7 also implicitly relied on this) would hit the
   same wall. Worth re-confirming the rebase was intentional and that the
   device-config package's interface evolution was supposed to ship together.
2. **The fix is small but the call is out-of-scope.** Adding
   `async listDisplayScreenIds(): Promise<string[]> { return [] }` to
   `ApiDeviceConfigurationProvider` (and a follow-up to query the real API when
   it exists) would unblock the build. The controller should decide whether Task
   8 absorbs that fix or whether a dedicated Task 0.5 (rebase cleanup) owns it.
3. **No new commits created.** Branch is dirty with `.superpowers/sdd/progress.md`
   only; no source code was added or modified by Task 8.
