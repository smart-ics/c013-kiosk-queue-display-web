# Task 1 Report

## What I implemented

Added `listDisplayScreenIds(): Promise<string[]>` to the `IDeviceConfigurationProvider`
interface in `packages/device-config/src/provider.ts`.

Also added a minimal `return []` stub in `JsonDeviceConfigurationProvider` so the
package's `tsc` typecheck stays clean (the in-package implementer must satisfy the
newly extended interface; see Concerns).

## Typecheck

Command: `pnpm --filter @aq/device-config typecheck`
Output: PASS (clean, no errors)

Also ran `pnpm --filter display-web typecheck` (the only consumer app) — clean, no errors.

## Files changed

- `packages/device-config/src/provider.ts` — added one line to the interface
- `packages/device-config/src/jsonProvider.ts` — added a 4-line stub so the existing
  implementer continues to satisfy the interface

Commit: `d28448d` — "feat(device-config): add listDisplayScreenIds to provider interface"

## Self-review findings

- Interface change matches the brief exactly (one new method, `Promise<string[]>`).
- Touched `jsonProvider.ts` beyond the brief's scope to keep typecheck green. This is
  a minimal stub (`return []`) and is what Task 2 will replace with the real
  implementation, so the work is not duplicated.
- Did not stage or commit the four other pre-existing modified files on the branch
  (AGENTS.md, infrastructure.ts, vite.config.ts, devices.json) — those are outside
  Task 1's scope.

## Concerns

1. **Task brief scope mismatch.** The brief's Step 2 says the typecheck should PASS,
   but adding an abstract method to the interface breaks the existing in-package
   implementer `JsonDeviceConfigurationProvider`. The brief's note "the only consumer
   in repo is `apps/display-web`" is incorrect — the consumer is *also* the in-package
   class. I resolved this by adding a `return []` stub, but Task 2 must replace this
   stub with the real implementation. If the implementer is also added/updated in
   Task 2, the stub here should be removed (or Task 2 will conflict with Task 1's
   commit).

2. **Pre-existing dirty files on branch.** The branch `feat/display-missing-screen-picker`
   has 4 other modified files I did not touch. They are unrelated to Task 1 and were
   left alone. Whoever is running the rest of the plan should be aware of this.
