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

### Fullscreen & Kiosk Deployment

Both client apps (`kiosk-web` and `display-web`) do not request fullscreen programmatically inside Vue code due to browser security restrictions on auto-fullscreen without user interaction. Fullscreen must be handled at the OS/Browser launch level:

- **Chrome Kiosk Mode Command:**
  ```text
  chrome.exe --kiosk --edge-kiosk-type=fullscreen --no-first-run --clear-token-caches http://<host>/kiosk/{stationId}
  chrome.exe --kiosk --edge-kiosk-type=fullscreen --no-first-run --clear-token-caches http://<host>/display/{screenId}
  ```
- **Automated Helper Scripts:** Interactive scripts are available to auto-generate these shortcuts on the Windows Desktop:
  - For Kiosk: [scripts/create-kiosk-shortcut.bat](file:///E:/PROJECT/ICS/FE/c013-kiosk-queue-display-web/scripts/create-kiosk-shortcut.bat)
  - For Queue Display: [scripts/create-display-shortcut.bat](file:///E:/PROJECT/ICS/FE/c013-kiosk-queue-display-web/scripts/create-display-shortcut.bat)


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

## Agent Workflow

When executing complex tasks or styling/UI changes, follow this systematic workflow:

1. **Research & Plan**:
   - Inspect existing components, configuration, and stylesheets.
   - Draft an implementation plan (`/plan`) detailing modified files, new features, and changes to CSS styling.
   - Document any changes to `global_config.json` configurations.
   - Seek user approval before starting execution.

2. **Implement & Refine**:
   - Make single contiguous edits using `replace_file_content` or `write_to_file`.
   - Update config templates (`global_config.json`) and service logic (`src/lib/branding.ts`) to handle configuration dynamically.
   - Follow clean code and CSS practices (e.g. use fluid styling like `clamp()`, and reduce text density/font-weight where appropriate to ensure elegance).

3. **Verify & Stage**:
   - Write/update tests for newly introduced functions or fields (e.g. inside `__tests__` directories).
   - Test changes using Vitest and verify builds compile without error:
     ```bash
     pnpm --filter <app-name> run build
     pnpm --filter <app-name> test
     ```
   - Review git changes with `git status` and `git diff` before staging.

4. **Commit & Push**:
   - Stage modified files (excluding temporary files like workspace configuration and untracked drafts).
   - Commit with a descriptive message specifying scope (e.g., `feat(display-web): ...`).
   - Push to the remote branch and use GitHub CLI (`gh pr create --head <branch>`) to create a PR.

## Print Development Mode Guidelines

When developing or debugging receipt, ticket, or label rendering in `apps/kiosk-web`:
1. **DEV Mode Auto-Download**: During active development of print templates/renderers, a temporary `import.meta.env.DEV` check can be enabled in composables (e.g., `useKioskSelfPrint.ts`) to automatically trigger a browser download of the rendered PNG Blob (`antrian_*.png`, `label_*.png`) for quick visual inspection.
2. **Mandatory Production Cleanup**: BEFORE committing code or declaring a task complete, ALL temporary auto-download snippets MUST be removed to ensure production builds run cleanly without triggering client-side downloads.

