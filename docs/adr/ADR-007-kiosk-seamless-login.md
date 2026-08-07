# ADR-007: Kiosk Seamless Login (Hardcoded Credentials → JWT)

- **Status:** Accepted
- **Date:** 2026-08-05
- **Branch:** feature/kiosk-self-registration

## Context

Kiosk-web currently sends `Authorization: Bearer kiosk-no-auth` on every authenticated request. The backend is being hardened to require real JWT tokens for Booking, HIS registration, and other endpoints. The kiosk has no login page and must authenticate transparently on boot using a shared kiosk credential.

## Decision

**Login on boot with hardcoded kiosk credentials, before the Vue app mounts.**

### Login contract

```
POST {bilregApiBase}/user/login
Body: { email: "kiosk@smart-ics.com", pass: "0rch1d", appId: "Bilreg" }
```

Response (JSend unwrapped by AdmissionQueueClient):

```ts
{
  pegId: string
  userName: string
  userLogin: string
  email: string
  expiredDate: string
  tokenAuth: string        // ← Bearer token for subsequent requests
  listRole: Array<{ role: string }>
}
```

### Token lifecycle

- Token stored **in-memory** (module-level singleton in `kioskLogin.ts`).
- **No refresh** — re-login on next boot. `expiredDate` is observed but not acted upon; the kiosk reboots daily.
- **No session persistence** — lost on page reload, which is acceptable for a kiosk terminal.

### Failure handling

- **5 retries, 3-second interval** (15s total).
- After all retries exhausted: render the existing config-failed error pattern in `#app` div — `"Login failed. Please contact administrator."`.

### Schema

- `KioskLoginResponse` Zod schema in `@aq/shared-types`, consistent with existing type patterns. Missing/invalid `tokenAuth` → login failure.

### Wiring

- New file `apps/kiosk-web/src/lib/kioskLogin.ts` exports `kioskLogin(): Promise<void>` (performs login + retries, stores token) and `getKioskToken(): string` (returns the stored token, throws if login hasn't completed).
- `main.ts` calls `configService.initialize()` then `kioskLogin()` before `createApp(...).mount('#app')`.
- `infrastructure.ts` factories use `getKioskToken` as the `IAuthTokenProvider` instead of the static `'kiosk-no-auth'` string.
- `@aq/auth` remains unused by kiosk-web — the in-memory singleton is simpler than introducing another provider abstraction.

### Boot sequence (main.ts)

`kioskLogin()` reads `bilregApiBase` from the config service, so config must be loaded first.

```
1. configService.initialize() → load global_config.json (public, no auth)
2. kioskLogin() → login to /user/login with retries → store tokenAuth
3. createApp(App).mount('#app')
```

## Alternatives considered

| Alternative | Rejected because |
|---|---|
| Env-based token (`VITE_BILREG_TOKEN`) | Requires pre-provisioning JWT per deployment; hardcoded creds + login is self-service. |
| `@aq/auth` SessionAuthTokenProvider | Overkill — no sessionStorage lifecycle needed; kiosk reboots wipe memory. |
| Login after app mount with loading UI | Extra complexity; blocking mount is simpler and avoids flash of unauthenticated UI. |
| Auto-refresh before expiry | Unnecessary — kiosk boots daily, token TTL is longer. |

## Consequences

- Kiosk becomes **dependent on bilregApiBase `/user/login` availability** at boot. If the auth endpoint is down, the kiosk stops with an error (no fallback to `kiosk-no-auth`).
- Hardcoded credentials `kiosk@smart-ics.com` / `0rch1d` are in source. This is acceptable for a kiosk terminal (no user-facing attack surface) and matches the existing `userId: "hidokkiosk"` pattern.
