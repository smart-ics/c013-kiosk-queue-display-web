# Task 1 Report: `@aq/app-config` — optional `jetliApiBase` + schema test

## Status: DONE

## What I changed

- `packages/app-config/src/index.ts`: Exported `appConfigSchema` and added optional `jetliApiBase` field (exact code from brief Step 3). `AppConfig` stays derived via `z.infer`; `ConfigService`/`configService` unchanged.
- `packages/app-config/package.json`: Written exactly as the brief Step 4 (added `scripts.test: "vitest run --passWithNoTests"`, added `vitest: ^3.2.4` devDependency, kept `typescript: ^5.2.2`).
- `packages/app-config/src/index.spec.ts`: Created (verbatim from brief Step 1) with 2 tests.
- `pnpm-lock.yaml`: Updated by `pnpm install` (adds `vitest` import spec for the app-config importer only).

## Ordering note

The brief's Step 2 (run failing test) requires vitest to be installed, but Step 4 (add vitest) comes after it. vitest did not exist anywhere reachable by `@aq/app-config` before Step 4. I therefore applied the Step 4 package.json first, ran `pnpm install`, then ran the failing test (Step 2) — which produced the intended failure (`appConfigSchema` not exported), then applied Step 3 (schema change), then ran the passing test (Step 5). TDD intent preserved; only the physical ordering of Step 2 vs Step 4 was swapped.

## Fail step output

Command: `pnpm --filter @aq/app-config exec vitest run src/index.spec.ts`

```
 RUN  v3.2.7  E:/PROJECT/ICS/FE/c013-kiosk-queue-display-web/packages/app-config

 ❯ src/index.spec.ts (2 tests | 2 failed) 32ms
   × appConfigSchema > accepts bilregApiBase without jetliApiBase 17ms
     → Cannot read properties of undefined (reading 'safeParse')
   × appConfigSchema > accepts jetliApiBase when provided 3ms
     → Cannot read properties of undefined (reading 'parse')

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/index.spec.ts > appConfigSchema > accepts bilregApiBase without jetliApiBase
TypeError: Cannot read properties of undefined (reading 'safeParse')
 ❯ src/index.spec.ts:6:36

 Test Files  1 failed (1)
      Tests  2 failed (2)
   Start at  09:09:04
   Duration  6.46s (transform 3.34s, setup 0ms, collect 3.70s, tests 32ms, environment 0ms, prepare 1.49s)
```

Failure cause: `appConfigSchema` was not exported from `./index` (the schema is declared but not exported), so it was `undefined` at runtime.

## Pass step output

Command: `pnpm --filter @aq/app-config test`

```
> @aq/app-config@0.0.0 test E:\PROJECT\ICS\FE\c013-kiosk-queue-display-web\packages\app-config
> vitest run --passWithNoTests

 RUN  v3.2.7  E:/PROJECT/ICS/FE/c013-kiosk-queue-display-web/packages/app-config

 ✓ src/index.spec.ts (2 tests) 9ms

 Test Files  1 passed (1)
      Tests  2 passed (2)
   Start at  09:09:46
   Duration  1.17s (transform 174ms, setup 0ms, collect 227ms, tests 9ms, environment 0ms, prepare 316ms)
```

## Commit

`017038e0a26235c639f9c05e8c95120b403b6eff` — `feat(app-config): optional jetliApiBase for BPJS integration`

Files in commit: `packages/app-config/package.json`, `packages/app-config/src/index.ts`, `packages/app-config/src/index.spec.ts`, `pnpm-lock.yaml`.

## Concerns

- Ordering deviation (Step 2 vs Step 4 swapped) as described above — necessary because vitest wasn't installed.
- `pnpm install` emitted a warning about 2 deprecated subdependencies (`glob@10.5.0`, `whatwg-encoding@3.1.1`) — pre-existing, not introduced by this change.
- Untracked docs/ADR files and `.superpowers/sdd/*` modifications were left unstaged, as instructed.
