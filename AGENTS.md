# AGENTS.md

Guidance for AI coding agents working in this monorepo.

## Scope

Kiosk and Queue Display clients for Bilreg Admission Queue v1.

- Officer Client stays in `c012_myhospital_web` — do not import HIS modules here.
- Do not couple apps to full HIS auth, workspace routing, or UI kit.

## Layout

```
apps/kiosk-web      Path `/kiosk/{stationId}` intake client (C2)
apps/display-web    Path `/display/{screenId}` display client (C3)
apps/config-web     Path `/queue-config/` device configuration (D0–D7)
packages/shared-types
packages/api-client
packages/device-config
packages/app-config
packages/auth
packages/signalr-client
```

## Boundaries

- Device configuration and auth are infrastructure providers (`IDeviceConfigurationProvider`, `IAuthTokenProvider`). Apps must not know whether config is JSON or HTTP, or how the JWT was obtained.
- Shared types must align with API-V1 field names (`queueLabel`, `loketKey`, `announcementVersion`).
- No client-side Queue Label allocation. No second queue ledger.
- SignalR is hint-only (snapshot-first). Display C3 consumes `/hubs/admission-queue`; never treat hub payloads as display authority.

## Commands

pnpm (v10) is the only package manager. Turborepo (`turbo run`) orchestrates cross-package
tasks. Use `pnpm` prefixes, never raw `turbo`/`tsc`/`vite`/`vitest`/`vue-tsc` on Windows —
pnpm puts local `node_modules/.bin` on PATH.

### Install

```bash
pnpm install                     # dev — updates lockfile
pnpm install --frozen-lockfile   # CI / reproducible — lockfile must match
```

### Verification gate (run before finishing work)

`lint` is a **noop** in every package — never use it as a gate. The CI gatekeeper is:

```bash
pnpm turbo run typecheck test    # canonical: typecheck + test across the repo
```

Root aliases (equivalent, single-op):
```bash
pnpm build       # turbo run build
pnpm test        # turbo run test
pnpm typecheck   # turbo run typecheck
```

### Per-package (turbo filter / pnpm filter)

```bash
pnpm --filter <name> run <script>   # run a workspace script (e.g. pnpm --filter kiosk-web test)
pnpm --filter kiosk-web exec vitest run src/lib/__tests__/flow.spec.ts   # run one test file with args
pnpm --filter kiosk-web exec tsx src/main.ts                             # arbitrary bin in package context
pnpm turbo run build --filter=kiosk-web                                  # build one app + its package deps
```

`<name>` values: apps `kiosk-web` `display-web` `config-web`; packages `@aq/shared-types`
`@aq/api-client` `@aq/app-config` `@aq/device-config` `@aq/auth` `@aq/signalr-client`.

### Typecheck / test by package kind

| Kind | Package | Typecheck | Test |
|---|---|---|---|
| Apps (Vue) | kiosk, display, config | `vue-tsc -p tsconfig.app.json --noEmit` | `vitest run` (jsdom) |
| Packages | `@aq/*` | `tsc -p tsconfig.json --noEmit` | `vitest run` |
| Type-only | shared-types, app-config | (tsc) | `vitest run --passWithNoTests` |

Apps split TS into `tsconfig.app.json` (src) + `tsconfig.node.json` (config); shared TS base is
`tsconfig.base.json`. Vitest config lives in each app/package (`vitest.config.ts`, jsdom, glob
`src/**/*.spec.ts`).

### Dev servers

```bash
pnpm dev:kiosk     # http://localhost:5173/kiosk/{stationId}
pnpm dev:display   # http://localhost:5174/display/{screenId}
pnpm dev:config    # http://localhost:5175/queue-config/
# single app: pnpm --filter kiosk-web dev
```

### Formatting

Prettier is optional and **not installed**. Config `.prettierrc.json`:
`semi:false`, `singleQuote:true`, `printWidth:100` (+ tailwind plugin). Format only
modified files when a .prettierignore allows it (all `*.md` ignored):

```bash
npx prettier --write <file...>
```

### Config/runtime (not build-time)

Post-deploy runtime config lives in each app's `public/global_config.json`
(see `bilregApiBase`, optional `jetliApiBase`). Local dev proxy config uses `.env.local`
(`VITE_BILREG_API_BASE` for display SignalR proxy). No static JWT is embedded at build time.

## Conventions

Vue 3 + Vite + TypeScript + Zod + TanStack Query.

### Vue conventions

- `<script setup lang="ts">` + Composition API in every SFC — never Options API
- Type-based `defineProps<...>` / `defineEmits<...>`; use `withDefaults` for prop defaults
- `ref()` for state; `reactive()` only for grouped form objects. `computed` for derived values, `watch` over `watchEffect`
- Filter/sort/group lists via `computed`, not methods, in `v-for`; always provide a stable `:key`
- PascalCase component filenames and registration
- Props are read-only — communicate upward via `emit`, never mutate
- No comments unless explaining non-obvious intent
- Format with Prettier on modified files only
