# Task 2 Report

## What I implemented

Replaced the placeholder `return []` stub in `packages/device-config/src/jsonProvider.ts` with the real `listDisplayScreenIds()` implementation on `JsonDeviceConfigurationProvider`.

Implementation:

```ts
async listDisplayScreenIds(): Promise<string[]> {
  return Object.entries(this.catalog)
    .filter(([, raw]) => raw?.role === 'display')
    .map(([id]) => id)
    .sort((a, b) => a.localeCompare(b))
}
```

- Filters to entries with `role === 'display'` (optional chain handles missing `role`/null entries).
- Maps to deviceId keys.
- Sorts with `localeCompare` (deterministic, locale-aware).
- Does not call `getConfig` and performs no validation — matches the brief.
- Placed at the **bottom of the class** (after `getConfig`), not between `fromJson` and `getConfig` where the stub lived.

## Typecheck

Command: `pnpm --filter @aq/device-config typecheck`

Output: PASS (no diagnostics, exit 0). `tsc -p tsconfig.json --noEmit` ran clean.

## Files changed

- `packages/device-config/src/jsonProvider.ts` — removed 4-line stub, added real method at class bottom (+7 / -4).

## Self-review

- Implementation matches brief: sorted, `role === 'display'` filter, no validation, no `getConfig` call. Confirmed.
- Stub removed (the `return []` body is gone) — not duplicated. Confirmed: the new method appears exactly once.
- New method placed at the **bottom of the class**, after `getConfig`. Confirmed via `read` of the file.
- Typecheck output is pristine (no warnings, no errors). Confirmed.
- Commit subject matches the plan's `git commit -m` text exactly.

## Concerns

None.

## Commit

- `a7915e6` — feat(device-config): implement listDisplayScreenIds on json provider
