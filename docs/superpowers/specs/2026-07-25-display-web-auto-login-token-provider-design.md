# display-web Auto-Login Auth Token Provider

Date: 2026-07-25
Scope: `packages/auth`, `apps/display-web`
Depends on: `POST /login` endpoint (already implemented in `@aq/api-client`)
Companion spec (out of scope here): `apps/display-web` `ApiDeviceConfigurationProvider.listDisplayScreenIds()` wiring.

## Problem

`display-web` saat ini menggunakan `EnvAuthTokenProvider` (`apps/display-web/src/infrastructure.ts`) yang membaca `VITE_BILREG_TOKEN` dari env. Token ini static, harus di-set manual sebelum boot, dan tidak ada flow refresh. `display-web` perlu migrasi ke auto-login supaya:

- Zero-config ops (tidak perlu set `VITE_BILREG_TOKEN` lagi).
- Token punya lifecycle yang proper (expired → re-login).
- Bisa panggil `configurationApi.listDisplays()` (spec B) tanpa 403 — token hasil `/login` membawa role claims sesuai `ConfigurationAllowedRoles`.

## Goal

Replace `EnvAuthTokenProvider` di `display-web` dengan `AutoLoginAuthTokenProvider` yang:

1. **First-time boot**: tampilkan inline form login, simpan credentials di `localStorage`.
2. **Subsequent boots**: silent auto-login dari `localStorage` credentials, tidak ada UI.
3. **Token expired**: silent re-login dari storage; jika gagal, hard block dengan inline form.
4. **Logout**: clear credentials, kembali ke `idle`.
5. **Token lives in-memory only** — tidak di-persist ke storage, mengurangi XSS attack surface. Credentials tetap di `localStorage` untuk silent re-login.

## Non-goals

- Wire `ApiDeviceConfigurationProvider.listDisplayScreenIds()` ke `listDisplays()` — companion spec, terpisah.
- Mengubah `EnvAuthTokenProvider` atau `SessionAuthTokenProvider` (tetap dipakai kiosk-web & config-web).
- Refresh token support (backend belum support).
- Menghapus `VITE_BILREG_TOKEN` env variable (deprecated, di luar scope).
- Encrypted storage untuk credentials (see Security considerations below).
- Multi-account per device.
- Biometric / PIN unlock untuk credentials.
- HttpOnly cookie-based auth (requires backend `Set-Cookie` support — not available yet).

## Design

### Component overview

```
packages/auth/
  src/
    autoLoginAuthTokenProvider.ts                    (new) class + types
    index.ts                                         (modify) export
    __tests__/autoLoginAuthTokenProvider.spec.ts     (new) unit tests

apps/display-web/
  src/
    infrastructure.ts                                (modify) wire new provider
    views/
      LoginView.vue                                  (new) inline form
    views/__tests__/LoginView.spec.ts                (new) component tests
    __tests__/infrastructure.spec.ts                 (modify) update
  .env.example                                       (modify) remove VITE_BILREG_TOKEN
  README.md                                          (modify) auth section
```

### Data flow

```
┌─────────────────────────────────────────────────────────────────┐
│ display-web boot                                                  │
│                                                                  │
│   App mount                                                      │
│      │                                                           │
│      ▼                                                           │
│   Constructor: read credentials from localStorage               │
│      │                                                           │
│      ├── No credentials → phase = idle                          │
│      │                                                           │
│      └── Has credentials → phase = logging-in                    │
│              │                                                   │
│              ▼ silentLogin(email, pass)                          │
│              POST /login                                         │
│              │                                                   │
│              ├── success → phase = authenticated                │
│              │   (token in-memory ref only; NOT in localStorage) │
│              │                                                   │
│              └── fail → phase = error (credentials kept)        │
│                                                                  │
│   Router guard: provider.phase.value                            │
│      │                                                           │
│      ├── idle/error → /login (LoginView)                        │
│      │                                                           │
│      ├── logging-in → allow navigation, RootView shows spinner  │
│      │                                                           │
│      └── authenticated → /display/{screenId}                    │
│                                                                  │
│   Runtime: getToken() called by AdmissionQueueClient             │
│      │                                                           │
│      ▼                                                           │
│   phase = authenticated?                                         │
│      │                                                           │
│      ├── yes → check expiredAt vs now + skew                    │
│      │       │                                                   │
│      │       ├── not expired → return token                      │
│      │       │                                                   │
│      │       └── expired → silent re-login from storage          │
│      │               │                                           │
│      │               ├── success → return new token             │
│      │               │                                           │
│      │               └── fail → phase = error; return null      │
│      │                                                           │
│      └── no → return null                                        │
│                                                                  │
│   Runtime: awaitAuthenticated() called by DisplayPage boot       │
│      │                                                           │
│      ▼                                                           │
│   If phase = authenticated → resolve immediately               │
│   If phase = logging-in → wait for in-flight login to finish   │
│   If phase = idle/error → reject with MissingAuthTokenError    │
└─────────────────────────────────────────────────────────────────┘
```

### Boundaries

- `AutoLoginAuthTokenProvider` lives in `packages/auth` — single source of truth untuk token state. Tidak tahu soal route atau UI. Provider tidak tahu soal `appId` — itu di-adapter di `infrastructure.ts`.
- `LoginView` lives di `apps/display-web/src/views/` — UI only, tidak tahu soal storage detail. Call `provider.login(email, pass)`, watch `provider.phase` untuk redirect.
- `infrastructure.ts` — single wiring point yang instantiate `AutoLoginAuthTokenProvider` dengan adapter untuk `loginBilreg` (menambahkan `appId: 'BilregDisplay'`).
- `display-web` tidak import `loginBilreg` langsung; provider menerima `loginImpl` dengan narrow type `(apiBase, { email, pass }) => Promise<LoginResponse>`.

### Security considerations

**Plaintext credentials in localStorage**: Credentials (`email`, `pass`) disimpan plaintext di `localStorage` key `aq.display.credentials`. Ini diperlukan untuk silent re-login. Risiko mitigasi:

- Display screens adalah dedicated device di internal network (bukan public kiosk).
- XSS di display-web adalah limited surface — app tidak load third-party scripts.
- Token JWT **tidak** di-persist ke storage — hanya lives in-memory. Jika tab ditutup, token hilang dan re-login diperlukan, tapi credentials tetap ada.
- Deferred: encrypted storage, HttpOnly cookie (butuh backend support).

**Key scoping**: `aq.` prefix digunakan (`aq.display.credentials`) untuk menghindari collision dengan `aq.session.token` (config-web) dan key lain di same origin.

## Package: `@aq/auth`

### `src/autoLoginAuthTokenProvider.ts` (new)

```ts
import { ref, type Ref } from 'vue'
import type { IAuthTokenProvider } from './index'
import type { LoginResponse } from '@aq/shared-types'

export type AutoLoginPhase =
  | { kind: 'idle' }
  | { kind: 'logging-in' }
  | { kind: 'authenticated'; token: string; expiredAt: string }
  | { kind: 'error'; message: string }

export type LoginImpl = (
  apiBase: string,
  credentials: { email: string; pass: string },
) => Promise<LoginResponse>

export interface AutoLoginAuthTokenProviderOptions {
  apiBase: string
  loginImpl: LoginImpl
  storage?: Storage
  clock?: () => Date
  /** Default 1 hour if login response lacks expiredDate. */
  defaultLifetimeMs?: number
  /** Refresh 5 min before actual expiry. */
  expirySkewMs?: number
}

const CRED_KEY = 'aq.display.credentials'

type StoredCredentials = { email: string; pass: string }

export class AutoLoginAuthTokenProvider implements IAuthTokenProvider {
  readonly phase: Ref<AutoLoginPhase>
  private readonly apiBase: string
  private readonly login: LoginImpl
  private readonly storage: Storage
  private readonly clock: () => Date
  private readonly defaultLifetimeMs: number
  private readonly expirySkewMs: number
  private inFlight: Promise<void> | null = null

  constructor(options: AutoLoginAuthTokenProviderOptions) {
    this.apiBase = options.apiBase
    this.login = options.loginImpl
    this.storage = options.storage ?? safeLocalStorage()
    this.clock = options.clock ?? (() => new Date())
    this.defaultLifetimeMs = options.defaultLifetimeMs ?? 60 * 60_000
    this.expirySkewMs = options.expirySkewMs ?? 5 * 60_000
    this.phase = ref<AutoLoginPhase>({ kind: 'idle' })

    const credentials = this.readCredentials()
    if (credentials) {
      void this.silentLogin(credentials.email, credentials.pass)
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', this.handleStorageEvent)
    }
  }

  /**
   * Synchronous token getter for IAuthTokenProvider contract.
   * Returns null during logging-in, idle, or error phases.
   * Callers that need to wait for an in-flight login should use awaitAuthenticated().
   */
  getToken(): string | null {
    const current = this.phase.value
    if (current.kind !== 'authenticated') return null
    if (this.isExpired(current.expiredAt)) {
      const credentials = this.readCredentials()
      if (credentials) {
        void this.silentLogin(credentials.email, credentials.pass)
      } else {
        this.phase.value = { kind: 'idle' }
      }
      return null
    }
    return current.token
  }

  /**
   * Wait for an in-flight login to complete. Resolves immediately if
   * authenticated. Rejects with MissingAuthTokenError if phase is idle or
   * error. Used by callers that need a valid token before proceeding
   * (e.g. DisplayPage boot).
   */
  async awaitAuthenticated(): Promise<void> {
    const current = this.phase.value
    if (current.kind === 'authenticated' && !this.isExpired(current.expiredAt)) {
      return
    }
    if (this.inFlight) {
      await this.inFlight
      const after = this.phase.value
      if (after.kind === 'authenticated') return
      const { MissingAuthTokenError } = await import('./index')
      throw new MissingAuthTokenError(
        after.kind === 'error' ? after.message : undefined,
      )
    }
    const { MissingAuthTokenError } = await import('./index')
    throw new MissingAuthTokenError(
      current.kind === 'error' ? current.message : undefined,
    )
  }

  async login(email: string, pass: string): Promise<void> {
    if (this.inFlight) return this.inFlight
    this.phase.value = { kind: 'logging-in' }
    this.inFlight = this.doLogin(email, pass, /* clearOnAuthFail */ true)
    try {
      await this.inFlight
    } finally {
      this.inFlight = null
    }
  }

  logout(): void {
    try { this.storage.removeItem(CRED_KEY) } catch {}
    this.phase.value = { kind: 'idle' }
  }

  private async silentLogin(email: string, pass: string): Promise<void> {
    if (this.inFlight) return this.inFlight
    this.phase.value = { kind: 'logging-in' }
    this.inFlight = this.doLogin(email, pass, /* clearOnAuthFail */ false)
    try {
      await this.inFlight
    } finally {
      this.inFlight = null
    }
  }

  private async doLogin(
    email: string,
    pass: string,
    clearOnAuthFail: boolean,
  ): Promise<void> {
    try {
      const response = await this.login(this.apiBase, { email, pass })
      const expiredAt = this.computeExpiredAt(response.expiredDate)
      this.writeCredentials({ email, pass })
      this.phase.value = {
        kind: 'authenticated',
        token: response.tokenAuth,
        expiredAt,
      }
    } catch (error) {
      const message = this.toMessage(error)
      if (clearOnAuthFail) {
        try { this.storage.removeItem(CRED_KEY) } catch {}
      }
      this.phase.value = { kind: 'error', message }
    }
  }

  private isExpired(expiredAt: string): boolean {
    const exp = Date.parse(expiredAt)
    if (Number.isNaN(exp)) return true
    return this.clock().getTime() + this.expirySkewMs >= exp
  }

  private computeExpiredAt(serverExpiredDate: string | undefined): string {
    if (serverExpiredDate) {
      const parsed = Date.parse(serverExpiredDate)
      if (!Number.isNaN(parsed)) return new Date(parsed).toISOString()
    }
    return new Date(this.clock().getTime() + this.defaultLifetimeMs).toISOString()
  }

  private toMessage(error: unknown): string {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      const status = (error as { statusCode: number }).statusCode
      if (status === 401) return 'Email atau password salah.'
      if (status === 403) return 'Akun tidak punya akses.'
      if (status >= 500) return 'Server sedang gangguan. Coba lagi.'
      if (status === 0) return 'Tidak dapat menghubungi server.'
    }
    if (error instanceof Error) return error.message
    return 'Login gagal.'
  }

  private readCredentials(): StoredCredentials | null {
    try {
      const raw = this.storage.getItem(CRED_KEY)
      if (!raw) return null
      const parsed = JSON.parse(raw) as StoredCredentials
      if (typeof parsed.email === 'string' && typeof parsed.pass === 'string') {
        return parsed
      }
      this.storage.removeItem(CRED_KEY)
      return null
    } catch {
      try { this.storage.removeItem(CRED_KEY) } catch {}
      return null
    }
  }

  private writeCredentials(credentials: StoredCredentials): void {
    try {
      this.storage.setItem(CRED_KEY, JSON.stringify(credentials))
    } catch {}
  }

  private readonly handleStorageEvent = (event: StorageEvent) => {
    if (event.key !== null && event.key !== CRED_KEY) return
    // Another tab cleared or changed credentials. Re-read state.
    // During intermediate states (one removeItem call in progress),
    // fall through to checking credentials presence.
    if (!this.readCredentials()) {
      this.phase.value = { kind: 'idle' }
    } else if (this.phase.value.kind === 'idle') {
      // Credentials appeared from another tab's login — attempt silent login.
      const credentials = this.readCredentials()!
      void this.silentLogin(credentials.email, credentials.pass)
    }
  }

  /** @internal For test cleanup only. */
  destroy() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', this.handleStorageEvent)
    }
  }
}

function safeLocalStorage(): Storage {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const probe = '__aq_probe__'
      window.localStorage.setItem(probe, probe)
      window.localStorage.removeItem(probe)
      return window.localStorage
    }
  } catch {}
  return memoryStorage()
}

function memoryStorage(): Storage {
  const map = new Map<string, string>()
  return {
    get length() { return map.size },
    clear() { map.clear() },
    getItem(key) { return map.get(key) ?? null },
    key(i) { return Array.from(map.keys())[i] ?? null },
    removeItem(key) { map.delete(key) },
    setItem(key, value) { map.set(key, value) },
  }
}
```

#### Design decisions (diff from v1 spec)

| # | Issue | Decision |
|---|---|---|
| 3/5 | `getToken()` returns null during async re-login; callers like DisplayPage crash with `MissingAuthTokenError` | Added `awaitAuthenticated(): Promise<void>` — waits for in-flight login, resolves immediately if authenticated, rejects with `MissingAuthTokenError` if idle/error. `getToken()` stays sync for `IAuthTokenProvider` compatibility. |
| 1 | `loginImpl` type was `typeof loginBilreg` requiring `{ email, pass, appId }` | Narrowed to `LoginImpl = (apiBase, { email, pass }) => Promise<LoginResponse>`. `appId` added by adapter in `infrastructure.ts`. |
| 4 | Token was persisted to `localStorage` via `TOKEN_KEY` but never read on boot — wasted `/login` call every refresh | **Removed `TOKEN_KEY` persistence entirely.** Token lives only in the Vue `ref` (in-memory). On refresh, `silentLogin` from stored credentials is always needed, which is correct — the token would be stale anyway. |
| 6 | Router guard redirected `logging-in` to `/login`, causing login page flash on every refresh with stored credentials | Guard now allows navigation during `logging-in` — `RootView` shows a loading spinner. Only `idle`/`error` redirect to `/login`. |
| 2 | Plaintext password in localStorage, risk undocumented | Added "Security considerations" section documenting risk, deployment context, and in-memory-only token mitigation. |
| 7 | README said "sessionStorage credentials" but code used localStorage | Fixed: spec text now consistently says localStorage. |
| 8 | Cross-tab `storage` event could see intermediate state | `handleStorageEvent` now resilient: only checks credentials presence and phase transitions, no longer reads `TOKEN_KEY`. |
| 9 | `appId` for display-web not specified | Spec documents `appId: 'BilregDisplay'` in `infrastructure.ts` adapter. Backend role mapping is out of scope. |

### `src/index.ts` (modify)

Add exports:

```ts
export {
  AutoLoginAuthTokenProvider,
  type AutoLoginAuthTokenProviderOptions,
  type AutoLoginPhase,
  type LoginImpl,
} from './autoLoginAuthTokenProvider'
```

### `src/__tests__/autoLoginAuthTokenProvider.spec.ts` (new)

Unit tests dengan injected `loginImpl`, `storage`, `clock`. Coverage:

1. Constructor: no credentials → `idle`. With credentials → silent `login()` → `authenticated`.
2. Storage corrupted JSON → `idle`, no throw. Storage unavailable → fallback memory, no throw. Console warn on fallback.
3. `login()`: success, success tanpa `expiredDate` (default 1h), 401 (creds cleared), 5xx (creds kept), network reject (creds kept), concurrent calls (single in-flight).
4. `getToken()`: `authenticated`+not expired → cached; `authenticated`+expired → triggers silent re-login, returns `null`; `logging-in` → `null`; `idle`/`error` → `null`.
5. `awaitAuthenticated()`: `authenticated` → resolves immediately; `logging-in` → waits for in-flight, resolves on success; `logging-in` → waits, rejects `MissingAuthTokenError` on failure; `idle` → rejects `MissingAuthTokenError`; `error` → rejects with error message.
6. Expiry: 1 ms before skew → re-login. Exactly at skew → re-login. After skew → cached. `expiredDate` past → re-login.
7. `logout()`: clear credentials from storage, phase `idle`, subsequent `getToken()` → `null`.
8. Cross-tab: mock `storage` event with credentials cleared → phase `idle`. Credentials appeared → silent login triggered.
9. Zod parse error: response missing required fields → throw, phase `error`.
10. Token is NOT persisted to localStorage after successful login (no `aq.display.authToken` key).
11. `destroy()` removes `storage` event listener.

### App: `apps/display-web`

### `src/infrastructure.ts` (modify)

Replace `EnvAuthTokenProvider` with `AutoLoginAuthTokenProvider`. Wire `loginImpl` adapter that calls `loginBilreg` with `appId: 'BilregDisplay'`:

```ts
import { AutoLoginAuthTokenProvider } from '@aq/auth'
import { loginBilreg } from '@aq/api-client'

let authTokenProvider: AutoLoginAuthTokenProvider | null = null

export function getAuthTokenProvider(): AutoLoginAuthTokenProvider {
  if (!authTokenProvider) {
    const baseUrl = import.meta.env.VITE_BILREG_API_BASE?.trim()
    if (!baseUrl) {
      throw new Error('VITE_BILREG_API_BASE is not configured')
    }
    authTokenProvider = new AutoLoginAuthTokenProvider({
      apiBase: baseUrl,
      loginImpl: (apiBase, credentials) =>
        loginBilreg(apiBase, { ...credentials, appId: 'BilregDisplay' }),
    })
  }
  return authTokenProvider
}
```

Return type narrowed to `AutoLoginAuthTokenProvider` so callers (`LoginView`, `router.ts` guard) can read `.phase` and call `.awaitAuthenticated()` without casting. Downstream consumers that need only the `IAuthTokenProvider` contract (e.g. `AdmissionQueueClient`) accept it via interface subtyping.

### `src/views/LoginView.vue` (new)

```vue
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getAuthTokenProvider } from '../infrastructure'

const provider = getAuthTokenProvider()
const route = useRoute()
const router = useRouter()

const email = ref('')
const pass = ref('')
const sessionExpired = computed(() => route.query.session === 'expired')

async function submit() {
  if (!email.value || !pass.value) return
  await provider.login(email.value, pass.value)
}

watch(
  () => provider.phase.value,
  (phase) => {
    if (phase.kind === 'authenticated') {
      const redirect = (route.query.redirect as string) || '/display/'
      void router.push(redirect)
    }
  },
)
</script>

<template>
  <section class="panel">
    <h1>Login Display</h1>

    <p v-if="sessionExpired" class="status error">
      Sesi Anda telah berakhir. Silakan login ulang.
    </p>

    <p v-else class="status">
      Login diperlukan untuk pertama kali. Credentials akan disimpan di device ini.
    </p>

    <p v-if="provider.phase.value.kind === 'logging-in'" class="status">
      Sedang login…
    </p>

    <p v-else-if="provider.phase.value.kind === 'error'" class="status error">
      {{ provider.phase.value.message }}
    </p>

    <form v-if="provider.phase.value.kind === 'idle' || provider.phase.value.kind === 'error'" @submit.prevent="submit">
      <label>
        Email
        <input v-model="email" type="email" required autocomplete="username" />
      </label>
      <label>
        Password
        <input v-model="pass" type="password" required autocomplete="current-password" />
      </label>
      <button type="submit" :disabled="!email || !pass">Login</button>
    </form>
  </section>
</template>
```

### `src/router.ts` (modify)

Add `/login` route. Navigation guard: allow `logging-in` to proceed (shows loading state in `RootView`), only redirect `idle`/`error` to `/login`:

```ts
import { createRouter, createWebHistory } from 'vue-router'
import RootView from './views/RootView.vue'
import LoginView from './views/LoginView.vue'
import { getAuthTokenProvider } from './infrastructure'

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/login', name: 'login', component: LoginView },
    { path: '/:screenId?', name: 'display-root', component: RootView },
  ],
})

router.beforeEach((to) => {
  if (to.name === 'login') return true
  const phase = getAuthTokenProvider().phase.value
  if (phase.kind === 'authenticated' || phase.kind === 'logging-in') return true
  return { name: 'login', query: { redirect: to.fullPath } }
})
```

Key difference from v1: `logging-in` is allowed through. `RootView` / `DisplayPage` uses `awaitAuthenticated()` to wait for the token, showing a loading state in the meantime.

### `src/views/RootView.vue` (modify)

Show loading state during `logging-in` phase:

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import DisplayPage from './DisplayPage.vue'
import MissingScreenPicker from './MissingScreenPicker.vue'
import { getAuthTokenProvider } from '../infrastructure'

const route = useRoute()
const provider = getAuthTokenProvider()

const screenId = computed(() => {
  const raw = route.params.screenId
  const first = Array.isArray(raw) ? raw[0] : raw
  return (first ?? '').toString().trim()
})

const authPending = computed(() =>
  provider.phase.value.kind === 'logging-in'
)
</script>

<template>
  <p v-if="authPending" class="loading">Memverifikasi login…</p>
  <DisplayPage v-else-if="screenId" :screen-id="screenId" />
  <MissingScreenPicker v-else />
</template>
```

### `src/views/DisplayPage.vue` (modify)

Replace synchronous `getToken()` check with `awaitAuthenticated()`. This fixes the race condition where `getToken()` returns `null` during in-flight silent login:

```ts
// Before (line 54-55):
// const token = getAuthTokenProvider().getToken()
// if (!token) throw new MissingAuthTokenError()

// After:
await getAuthTokenProvider().awaitAuthenticated()
```

And update the `MissingAuthTokenError` handler:

```ts
if (error instanceof MissingAuthTokenError) {
  bootError.value = 'Sesi berakhir. Silakan login ulang.'
  return
}
```

Full boot watch replacement:

```ts
watch(
  () => props.screenId,
  async (rawScreenId, _prev, onCleanup) => {
    let cancelled = false
    onCleanup(() => {
      cancelled = true
    })

    bootError.value = null
    deviceConfig.value = null
    const screenId = rawScreenId?.trim()
    if (!screenId) {
      return
    }

    try {
      await getAuthTokenProvider().awaitAuthenticated()

      const provider = await getDeviceConfigProvider()
      const config = await provider.getConfig(screenId)
      if (cancelled) return
      const validation = validateDisplayDeviceConfig(screenId, config)
      if (!validation.ok) {
        bootError.value = validation.message
        return
      }
      deviceConfig.value = config
    } catch (error) {
      if (cancelled) return
      if (error instanceof DeviceConfigNotFoundError) {
        bootError.value = `Konfigurasi tidak ditemukan untuk screen '${error.deviceId}'.`
        return
      }
      if (error instanceof DeviceConfigInvalidError) {
        bootError.value = `Konfigurasi tidak valid untuk '${error.deviceId}'.`
        return
      }
      if (error instanceof MissingAuthTokenError) {
        bootError.value = 'Sesi berakhir. Silakan login ulang.'
        return
      }
      bootError.value = error instanceof Error ? error.message : 'Boot gagal.'
    }
  },
  { immediate: true },
)
```

### `src/__tests__/infrastructure.spec.ts` (modify)

Update existing tests: `getAuthTokenProvider()` returns `AutoLoginAuthTokenProvider`. `__resetInfrastructureForTests()` clears it. Test that `loginImpl` adapter passes `appId: 'BilregDisplay'`.

### `.env.example` (modify)

Remove `VITE_BILREG_TOKEN` line. Keep only `VITE_BILREG_API_BASE`:

```
VITE_BILREG_API_BASE=http://localhost:5000/api
```

### `env.d.ts` (modify)

Remove `VITE_BILREG_TOKEN` from `ImportMetaEnv`:

```ts
interface ImportMetaEnv {
  readonly VITE_BILREG_API_BASE: string
  readonly VITE_DEVICE_CONFIG_PROVIDER?: string
}
```

### `README.md` (modify)

Update auth section: explain first-time login flow, localStorage credentials, in-memory token, no env token needed.

## Error handling

Key invariants:

- HTTP 401 → credentials cleared, phase `error`, user must re-enter.
- HTTP 5xx / network → credentials kept, phase `error`, user can retry.
- `getToken()` always returns `null` if phase bukan `authenticated` (caller handles via `awaitAuthenticated()` or watch).
- `awaitAuthenticated()` waits for in-flight login, rejects `MissingAuthTokenError` if phase becomes `idle`/`error`.
- Concurrent `getToken()` & `login()` share single in-flight promise (no double-fire).

## Testing

Unit tests di `packages/auth/src/__tests__/autoLoginAuthTokenProvider.spec.ts` (new) — see above.

Component tests di `apps/display-web/src/views/__tests__/LoginView.spec.ts` (new):

1. Mount with `idle` → form visible, fields, submit.
2. Submit valid → call `provider.login`, on `authenticated` → redirect to `redirect` query or `/display/`.
3. Submit empty → button disabled.
4. Mount with `logging-in` → spinner, form hidden.
5. Mount with `error` → form + banner.
6. Mount with `authenticated` → redirect immediately.
7. Route query `?session=expired` → "Sesi berakhir" banner.

Integration tests di `apps/display-web/src/__tests__/infrastructure.spec.ts` (update):

1. `getAuthTokenProvider()` returns `AutoLoginAuthTokenProvider`.
2. `loginImpl` adapter passes `appId: 'BilregDisplay'`.
3. `getAdmissionQueueApi()` & `getRuntimeDeviceApi()` use the auto-login provider.
4. `__resetInfrastructureForTests()` clears all singletons.

Manual smoke (post-implementation):

1. Set `VITE_BILREG_API_BASE`, don't set `VITE_BILREG_TOKEN`.
2. Open `http://localhost:5174/display/lobby-poli-1`.
3. Expected: redirect to `/login?redirect=/display/lobby-poli-1`.
4. Submit valid credentials → redirect to `/display/lobby-poli-1`.
5. Refresh → no login form, silent auto-login (shows "Memverifikasi login…" briefly), display normal.
6. DevTools: localStorage has `aq.display.credentials`, NO `aq.display.authToken`.
7. DevTools clear localStorage + refresh → login form.
8. Open second tab, login → first tab reflects new state via `storage` event.
9. Wait for token to expire → `getToken()` triggers silent re-login → no interruption.

Run:

```bash
pnpm --filter @aq/auth test
pnpm --filter display-web test
pnpm --filter @aq/auth typecheck
pnpm --filter display-web typecheck
pnpm build
```

## Compatibility

- `EnvAuthTokenProvider` & `SessionAuthTokenProvider` unchanged. `kiosk-web` & `config-web` unaffected.
- `IAuthTokenProvider` interface unchanged — `AutoLoginAuthTokenProvider.getToken()` is a drop-in replacement. `awaitAuthenticated()` is an additional method, not on the interface.
- **`VITE_BILREG_TOKEN` is fully removed from `display-web`.** No fallback. The `EnvAuthTokenProvider` import is removed from `infrastructure.ts`. `.env.example` line for `VITE_BILREG_TOKEN` is removed. `env.d.ts` removes the type. Rationale: dual-path adds ambiguity; the spec's whole point is to remove the static-token dependency. If rollback is needed, revert the commit.
- `display-web` does NOT introduce `@microsoft/signalr`; existing boundary holds.
- `LoginView` does NOT import any device-config or queue API; minimal coupling.
- **Token is in-memory only** — not persisted to `localStorage`. On page refresh, silent re-login from stored credentials obtains a fresh token. This reduces XSS attack surface (stolen credentials are a risk, but a stolen persistent JWT is worse since it can be used independently).
- **`appId: 'BilregDisplay'`** is set in the `infrastructure.ts` adapter, not in the provider. Backend role mapping (`BilregDisplay` → Display role claims) is out of scope but must be configured on the server side.

## Out of scope (deferred)

- Companion spec: wire `ApiDeviceConfigurationProvider.listDisplayScreenIds()` ke `listDisplays()`. Requires this spec to be merged first.
- Removing `VITE_BILREG_TOKEN` env support from `kiosk-web` (separate concern).
- Refresh token flow (backend support).
- Encrypted storage untuk credentials (see Security considerations).
- Multi-account per device.
- Biometric/PIN unlock.
- HttpOnly cookie-based auth (requires backend `Set-Cookie` + CORS `credentials: include`; not currently supported by `POST /login`).