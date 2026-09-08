# Task 1 Report: Add the Manual Configuration Contract

## Status: DONE

## What I Implemented

Followed the brief verbatim. Only three files touched:

1. `packages/app-config/src/index.ts` — added `fallbackServicePointsSchema` (zod object with `bookingFailure` string, trimmed, optional, transforms empty/whitespace to `undefined`) and the `FallbackServicePoints` type above `appConfigSchema`, plus `fallbackServicePoints: fallbackServicePointsSchema.optional()` on `appConfigSchema`. Matched existing file style (no semicolons).
2. `packages/app-config/src/index.spec.ts` — appended the three tests from the brief verbatim.
3. `apps/kiosk-web/public/global_config.json` — added the `fallbackServicePoints.bookingFailure` template key (empty string = no recommendation).

## What I Tested and Results

- Focused suite `pnpm --filter @aq/app-config exec vitest run src/index.spec.ts`: 8/8 pass (5 pre-existing + 3 new).
- Full `@aq/app-config` suite: 8/8 pass.
- Typecheck `pnpm --filter @aq/app-config exec tsc -p tsconfig.json --noEmit`: clean (no output, exit 0).
- `global_config.json` parses with `ConvertFrom-Json`: valid.

## TDD Evidence

**RED** — after appending tests, before implementation:

```
× appConfigSchema > accepts fallbackServicePoints.bookingFailure
  → expected undefined to be 'SP-ADMISI' // Object.is equality
Test Files  1 failed (1)
     Tests  1 failed | 7 passed (8)
```

The other two new tests passed on RED because the schema strips unknown keys (`fallbackServicePoints` becomes undefined), so `toBeUndefined()` assertions held — a known property of unknown-key-stripping; the meaningful failing test asserted the positive case.

**GREEN** — after adding the schema property and template:

```
✓ src/index.spec.ts (8 tests)
Test Files  1 passed (1)
     Tests  8 passed (8)
```

## Files Changed

- `packages/app-config/src/index.ts` (+11)
- `packages/app-config/src/index.spec.ts` (+24)
- `apps/kiosk-web/public/global_config.json` (+4/-1)

## Self-Review Findings

- **Completeness**: All 5 brief steps done; schema property, transform, type, and JSON template verbatim.
- **Quality**: Matches existing no-semicolon style; transform normalizes empty string to `undefined` so a blank template value is treated as "no recommendation".
- **YAGNI**: No extra code. Did not touch `b09-bilreg-api`, `apps/config-web`, or any app behavior.
- **Test quality**: Tests assert real parsed values, including the empty-string normalization and optionality.

## Concerns

- None blocking. Minor note: on RED, the "normalizes empty" and "keeps optional" tests passed even before implementation because Zod strips unknown keys (output is `undefined`). The primary failing test covered the positive path, which is the meaningful RED signal.