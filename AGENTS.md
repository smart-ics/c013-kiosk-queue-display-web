# AGENTS.md

Guidance for AI coding agents working in this monorepo.

## Scope

Kiosk (C2) and Queue Display (C3) web clients for **Bilreg Admission Queue v1**.

- Officer Client stays in `c012_myhospital_web` — do not import HIS modules here.
- Do not couple these apps to full HIS auth, workspace routing, or UI kit.
- Canonical contract source: `b09-bilreg-api/docs/contexts/pasien-tracker/`. Local
  operational mirrors live under `docs/` (see `docs/README.md`).
- User-facing overview and env matrix: `README.md`.

## Layout

```
apps/kiosk-web        SPA on path /kiosk/{stationId}        port 5173
apps/display-web      SPA on path /display/{screenId}       port 5174
packages/shared-types     Zod schemas (queueLabel, loketKey, announcementVersion, …)
packages/api-client       AdmissionQueueClient (JSEND) + createAdmissionQueueApi + AQ error codes
packages/device-config    IDeviceConfigurationProvider + JsonDeviceConfigurationProvider
packages/auth             IAuthTokenProvider + EnvAuthTokenProvider
packages/signalr-client   Hint-only createQueueConnection for /hubs/admission-queue
```

Workspace: `pnpm-workspace.yaml` (apps + packages). Build orchestration: `turbo.json`.

## Boundaries (enforced by code, not just docs)

- Apps must not import `@microsoft/signalr` directly. The `@aq/signalr-client`
  wrapper is consumed **only by `apps/display-web`**. `kiosk-web` has no SignalR
  dependency and must not grow one.
- Device config and auth are infrastructure providers. Apps must not know
  whether `devices.json` is JSON or HTTP, or how the JWT was obtained.
  `apps/*/src/infrastructure.ts` is the single wiring point per app.
- `DeviceConfig.role` is checked at boot — kiosk refuses non-`kiosk` ids,
  display requires non-empty `loketIds` (`apps/display-web/src/lib/boot.ts`).
- No client-side Queue Label allocation. No second queue ledger. Queue Labels
  come only from `intake()` response (`AdmissionQueueIntakeResponse.queueLabel`).
- Display C3 is **snapshot-first**. `GET v1/admission-queue/displays/current` is
  the only authority. SignalR `RefreshHint` only triggers a refetch — never
  treats hub payloads as display truth. Hub URL is built from the API base by
  `buildAdmissionQueueHubUrl` (strips trailing `/api`).
- Print proxy contract (`apps/kiosk-web/src/lib/printProxy.ts`):
  `POST http://localhost:{printerProxyPort}/print/?type=image&doctype=antrian&printCopies=1`
  with PNG body. Health check hits `/health` on the same port. Reprint reuses
  the committed `result`; it must never re-trigger intake.

## Setup & commands

Requires Node `^20.19.0 || >=22.12.0` and `pnpm@10.14.0` (enforced via
`packageManager` + `engines`).

```bash
pnpm install
cp apps/kiosk-web/.env.example  apps/kiosk-web/.env.local
cp apps/display-web/.env.example apps/display-web/.env.local
# set VITE_BILREG_API_BASE (e.g. http://localhost:5000/api) and VITE_BILREG_TOKEN
```

Required env (read via `import.meta.env` in `apps/*/src/infrastructure.ts`,
typed in `apps/*/env.d.ts`):

| Variable | Purpose |
|---|---|
| `VITE_BILREG_API_BASE` | Bilreg API root **including** `/api` |
| `VITE_BILREG_TOKEN`    | JWT for REST + SignalR (env-driven; no device login yet) |

If `VITE_BILREG_API_BASE` is missing, boot throws before any view renders. If
`VITE_BILREG_TOKEN` is missing, boot shows a `MissingAuthTokenError` page.

### Root scripts (turbo, fan out per package)

```bash
pnpm dev:kiosk     # pnpm --filter kiosk-web dev
pnpm dev:display   # pnpm --filter display-web dev
pnpm build         # turbo run build
pnpm test          # turbo run test
pnpm typecheck     # turbo run typecheck
pnpm lint          # turbo run lint  (currently no-op in all packages)
```

### Per-package (when working in one)

```bash
# apps
pnpm --filter kiosk-web   test       # vitest run (jsdom)
pnpm --filter display-web test
pnpm --filter kiosk-web   typecheck  # vue-tsc -p tsconfig.app.json --noEmit
pnpm --filter display-web typecheck

# packages
pnpm --filter @aq/api-client      test
pnpm --filter @aq/device-config   test
pnpm --filter @aq/auth            test
pnpm --filter @aq/signalr-client  test
pnpm --filter @aq/shared-types    test
```

Test pattern: `*.spec.ts` colocated under `src/**/__tests__/`. Vitest is
configured per package (`vitest.config.ts` in apps; default in packages).
Test a single file with `pnpm --filter <pkg> test -- path/to/spec.ts`.

## Build artifacts & IIS deployment

- Both apps ship a Vite `versionJsonPlugin` that writes `dist/version.json` and
  copies `web.config` on `closeBundle`. Do not delete these plugins.
- `web.config` rewrites unknown paths to `/kiosk/index.html` or
  `/display/index.html` (SPA fallback) and sets `Cache-Control: no-cache` for
  all responses.
- `useVersionAutoRefresh` (`apps/display-web/src/composables/`) polls
  `version.json` and soft-reloads the page when it changes while idle.
- `display-web` is a true SPA on `/display/`. `kiosk-web` is a true SPA on
  `/kiosk/`. No SSR, no router base tricks beyond `base: '/kiosk/'` /
  `base: '/display/'` in each `vite.config.ts`.
- Deploy flow: `pnpm build` → copy `apps/{kiosk,display}-web/dist` into IIS
  `wwwroot/{kiosk,display}`. Full checklist: `docs/TRACKER-ADMISSION-QUEUE-IIS-CLIENT-CUTOVER-CHECKLIST.md`.

## Conventions

- Vue 3 (`<script setup lang="ts">`) + Vite + TypeScript + Zod + TanStack Query.
- Path alias `@/` → `src/` is set in both `vite.config.ts` and each
  `tsconfig.app.json`. Workspace deps use the `@aq/*` alias; do not import them
  via relative paths from apps.
- Prefer declarative patterns: `computed`, `watch`, `useQuery`. Composable
  files under `apps/*/src/composables/` are pure functions returning refs —
  pass injectable `IntakeFn`, `PrintProxyClient`, `fetchVersion`, `reload` for
  testability (see `useKioskIntake.ts`, `useKioskPrint.ts`,
  `useVersionAutoRefresh.ts`).
- Tests reset module-level singletons with `__resetInfrastructureForTests()`
  exported from each `infrastructure.ts`.
- TypeScript is strict (`tsconfig.base.json`): `noUnusedLocals`,
  `noUnusedParameters`, `verbatimModuleSyntax`. `vue-tsc` is the typecheck
  driver for apps; plain `tsc` for packages.
- `.prettierignore` excludes `*.md`. No Prettier config file — formatting is
  optional. Don't add comments unless explaining non-obvious intent (existing
  file convention).

## Doc map

| Doc | Use when |
|---|---|
| `README.md` | Quick start, env matrix, IIS deploy summary |
| `docs/README.md` | Index of mirrored ops docs (cutover, runbook, API V1) |
| `docs/TRACKER-ADMISSION-QUEUE-API-V1.md` | REST / SignalR / error contract |
| `docs/TRACKER-ADMISSION-QUEUE-IIS-CLIENT-CUTOVER-CHECKLIST.md` | Deploy Go / No-Go |
| `docs/TRACKER-ADMISSION-QUEUE-RUNBOOK.md` | Migrate/config/smoke + client E2E §§8–11 |
| `docs/{C2,C3,C4}-implementation-summary.md` | Per-phase pointers |
