# AGENTS.md

Guidance for AI coding agents working in this monorepo.

## Scope

Kiosk and Queue Display clients for Bilreg Admission Queue v1.

- Officer Client stays in `c012_myhospital_web` — do not import HIS modules here.
- Do not couple apps to full HIS auth, workspace routing, or UI kit.

## Layout

```
apps/kiosk-web      Path `/kiosk/{stationId}` intake client
apps/display-web    Path `/display/{screenId}` display client (C3)
packages/shared-types
packages/api-client
packages/device-config
packages/auth
packages/signalr-client
```

## Boundaries

- Device configuration and auth are infrastructure providers (`IDeviceConfigurationProvider`, `IAuthTokenProvider`). Apps must not know whether config is JSON or HTTP, or how the JWT was obtained.
- Shared types must align with API-V1 field names (`queueLabel`, `loketKey`, `announcementVersion`).
- No client-side Queue Label allocation. No second queue ledger.
- SignalR is hint-only (snapshot-first) — implement in C3, not here for kiosk C2.0.

## Commands

```bash
pnpm install
pnpm dev:kiosk
pnpm build
pnpm test
pnpm typecheck
```

## Conventions

- Vue 3 + Vite + TypeScript + Zod + TanStack Query
- Prefer declarative patterns (`computed`, `watch`, query hooks)
- No comments unless explaining non-obvious intent
- Format with Prettier on modified files only
