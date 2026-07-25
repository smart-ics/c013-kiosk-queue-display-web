# display-web Auto-Login Auth Token Provider

Date: 2026-07-25
Scope: `packages/auth`, `apps/display-web`
Depends on: `apps/config-web` + `POST /login` endpoint (already implemented)
Companion spec (out of scope here): `apps/display-web` `ApiDeviceConfigurationProvider.listDisplayScreenIds()` wiring.

## Problem

`display-web` saat ini menggunakan `EnvAuthTokenProvider` (`apps/display-web/src/infrastructure.ts:45-50`) yang membaca `VITE_BILREG_TOKEN` dari env. Token ini static, harus di-set manual sebelum boot, dan tidak ada flow refresh. Setelah kehadiran `apps/config-web` (yang sudah menggunakan `POST /login` + `SessionAuthTokenProvider`), `display-web` perlu migrasi ke auto-login supaya:

- Zero-config ops (tidak perlu set `VITE_BILREG_TOKEN` lagi).
- Token punya lifecycle yang proper (expired → re-login).
- Bisa panggil `configurationApi.listDisplays()` (spec B) tanpa 403 — token hasil `/login` membawa role claims sesuai `ConfigurationAllowedRoles`.

## Goal

Replace `EnvAuthTokenProvider` di `display-web` dengan `AutoLoginAuthTokenProvider` yang:

1. **First-time boot**: tampilkan inline form login, simpan credentials di `localStorage`, cache token.
2. **Subsequent boots**: silent auto-login dari `localStorage`, tidak ada UI.
3. **Token expired**: silent re-login dari storage; jika gagal, hard block dengan inline form.
4. **Logout**: clear credentials & token, kembali ke `idle`.

## Non-goals

- Wire `ApiDeviceConfigurationProvider.listDisplayScreenIds()` ke `listDisplays()` — companion spec, terpisah.
- Mengubah `EnvAuthTokenProvider` atau `SessionAuthTokenProvider` (tetap dipakai kiosk-web & config-web).
- Refresh token support (backend belum support).
- Menghapus `VITE_BILREG_TOKEN` env variable (deprecated, di luar scope).
- Encrypted storage untuk credentials.
- Multi-account per device.
- Biometric / PIN unlock untuk credentials.

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
  .env.example                                       (modify) deprecate VITE_BILREG_TOKEN
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
│   Router: provider.phase.value                                  │
│      │                                                           │
│      ├── idle/error → /login (LoginView)                        │
│      │         │                                                 │
│      │         ▼ submit                                          │
│      │      POST /login → Bilreg API                            │
│      │         │                                                 │
│      │         ▼ (token + expiredDate)                           │
│      │      save {email, pass} → localStorage                   │
│      │      save {token, expiredAt} → localStorage              │
│      │         │                                                 │
│      │         ▼                                                 │
│      │      redirect to /display/{screenId}                      │
│      │                                                           │
│      ├── logging-in → /login (spinner)                          │
│      │                                                           │
│      └── authenticated → /display/{screenId}                    │
│                                                                  │
│   Runtime: getToken() called                                     │
│      │                                                           │
│      ▼                                                           │
│   check expiredAt vs now + skew                                  │
│      │                                                           │
│      ├── not expired → return cached token                      │
│      │                                                           │
│      └── expired → silent re-login from storage                 │
│              │                                                   │
│              ├── success → return new token                     │
│              │                                                   │
│              └── fail → phase = error; UI shows banner          │
└─────────────────────────────────────────────────────────────────┘
```

### Boundaries

- `AutoLoginAuthTokenProvider` lives in `packages/auth` — single source of truth untuk token state. Tidak tahu soal route atau UI.
- `LoginView` lives di `apps/display-web/src/views/` — UI only, tidak tahu soal storage detail. Emit `login(email, pass)` ke provider, watch `provider.phase` untuk redirect.
- `infrastructure.ts` — single wiring point yang instantiate `AutoLoginAuthTokenProvider` dan pass ke `AdmissionQueueClient`.
- `display-web` tidak import `loginBilreg` langsung; via `AutoLoginAuthTokenProvider` yang inject `loginImpl` (default `loginBilreg`) untuk testability.

### Package: `@aq/auth`

#### `src/autoLoginAuthTokenProvider.ts` (new)

```ts
import { ref, type Ref } from 'vue'
import { loginBilreg } from '@aq/api-client'
import type { IAuthTokenProvider } from './index'

export type AutoLoginPhase =
  | { kind: 'idle' }
  | { kind: 'logging-in' }
  | { kind: 'authenticated'; token: string; expiredAt: string }
  | { kind: 'error'; message: string }

export interface AutoLoginAuthTokenProviderOptions {
  apiBase: string
  loginImpl?: typeof loginBilreg
  storage?: Storage
  clock?: () => Date
  /** Default 1 hour if login response lacks expiredDate. */
  defaultLifetimeMs?: number
  /** Refresh 5 min before actual expiry. */
  expirySkewMs?: number
}

const CRED_KEY = 'display.deviceCredentials'
const TOKEN_KEY = 'display.authToken'

type StoredCredentials = { email: string; pass: string }
type StoredToken = { token: string; expiredAt: string }

export class AutoLoginAuthTokenProvider implements IAuthTokenProvider {
  readonly phase: Ref<AutoLoginPhase>
  private readonly apiBase: string
  private readonly login: typeof loginBilreg
  private readonly storage: Storage
  private readonly clock: () => Date
  private readonly defaultLifetimeMs: number
  private readonly expirySkewMs: number
  private inFlight: Promise<void> | null = null

  constructor(options: AutoLoginAuthTokenProviderOptions) {
    this.apiBase = options.apiBase
    this.login = options.loginImpl ?? loginBilreg
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
    try { this.storage.removeItem(TOKEN_KEY) } catch {}
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
      this.writeToken({ token: response.tokenAuth, expiredAt })
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

  private readToken(): StoredToken | null {
    try {
      const raw = this.storage.getItem(TOKEN_KEY)
      if (!raw) return null
      const parsed = JSON.parse(raw) as StoredToken
      if (typeof parsed.token === 'string' && typeof parsed.expiredAt === 'string') {
        return parsed
      }
      this.storage.removeItem(TOKEN_KEY)
      return null
    } catch {
      try { this.storage.removeItem(TOKEN_KEY) } catch {}
      return null
    }
  }

  private writeToken(token: StoredToken): void {
    try {
      this.storage.setItem(TOKEN_KEY, JSON.stringify(token))
    } catch {}
  }

  private readonly handleStorageEvent = (event: StorageEvent) => {
    if (event.key !== TOKEN_KEY && event.key !== CRED_KEY) return
    const token = this.readToken()
    if (token && !this.isExpired(token.expiredAt)) {
      this.phase.value = {
        kind: 'authenticated',
        token: token.token,
        expiredAt: token.expiredAt,
      }
    } else if (!this.readCredentials()) {
      this.phase.value = { kind: 'idle' }
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

#### `src/index.ts` (modify)

Add exports:

```ts
export {
  AutoLoginAuthTokenProvider,
  type AutoLoginAuthTokenProviderOptions,
  type AutoLoginPhase,
} from './autoLoginAuthTokenProvider'
```

#### `src/__tests__/autoLoginAuthTokenProvider.spec.ts` (new)

Unit tests dengan injected `loginImpl`, `storage`, `clock`. Coverage:

1. Constructor: no credentials → `idle`. With credentials → silent `login()` → `authenticated`.
2. Storage corrupted JSON → `idle`, no throw. Storage unavailable → fallback memory, no throw.
3. `login()`: success, success tanpa `expiredDate` (default 1h), 401 (creds cleared), 5xx (creds kept), network reject (creds kept), concurrent calls (single in-flight).
4. `getToken()`: `authenticated`+not expired → cached; `authenticated`+expired → silent re-login; `logging-in` → `null`; `idle`/`error` → `null`; multiple concurrent during `logging-in` → all `null`.
5. Expiry: 1 ms before skew → re-login. Exactly at skew → re-login. After skew → cached. `expiredDate` past → re-login.
6. `logout()`: clear storage, phase `idle`, subsequent `getToken()` → `null`.
7. Cross-tab: mock `storage` event → reload phase.
8. Zod parse error: response missing required fields → throw, phase `error`.

### App: `apps/display-web`

#### `src/infrastructure.ts` (modify)

Replace `EnvAuthTokenProvider` with `AutoLoginAuthTokenProvider`. Single change in `getAuthTokenProvider()`:

```ts
import { AutoLoginAuthTokenProvider } from '@aq/auth'

let authTokenProvider: AutoLoginAuthTokenProvider | null = null

export function getAuthTokenProvider(): AutoLoginAuthTokenProvider {
  if (!authTokenProvider) {
    const baseUrl = import.meta.env.VITE_BILREG_API_BASE?.trim()
    if (!baseUrl) {
      throw new Error('VITE_BILREG_API_BASE is not configured')
    }
    authTokenProvider = new AutoLoginAuthTokenProvider({ apiBase: baseUrl })
  }
  return authTokenProvider
}
```

Return type narrowed to `AutoLoginAuthTokenProvider` so callers (`LoginView`, `router.ts` guard) can read `.phase` without casting. Downstream consumers that need only the `IAuthTokenProvider` contract (e.g. `AdmissionQueueClient`) accept it via interface subtyping.

#### `src/views/LoginView.vue` (new)

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
      void router.push('/display/')
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

#### `src/router.ts` (modify)

Add `/login` route. Existing `/:screenId?` stays. New navigation guard reads `provider.phase` and redirects. The provider is a singleton (`getAuthTokenProvider()`), so the same instance is read by `LoginView` and the guard.

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
  if (phase.kind === 'authenticated') return true
  return { name: 'login', query: to.query }
})
```

#### `src/views/RootView.vue` (modify)

When `getToken()` returns `null` (e.g. expired, no re-login), DisplayPage shows `BootErrorPage` with "VITE_BILREG_TOKEN belum dikonfigurasi." — change to generic "Sesi berakhir, login ulang." and link to `/login`. Update `DisplayPage.vue:76-79`:

```ts
if (error instanceof MissingAuthTokenError) {
  bootError.value = 'Sesi berakhir. Silakan login ulang.'
  return
}
```

#### `src/__tests__/infrastructure.spec.ts` (modify)

Update existing tests: `getAuthTokenProvider()` returns `AutoLoginAuthTokenProvider`. `__resetInfrastructureForTests()` clears it.

#### `.env.example` (modify)

Remove `VITE_BILREG_TOKEN` line. Keep only `VITE_BILREG_API_BASE`:

```
VITE_BILREG_API_BASE=http://localhost:5000/api
```

#### `README.md` (modify)

Update auth section: explain first-time login flow, sessionStorage credentials, no env token needed.

## Error handling

See "Error matrix" in brainstorming section 4 (preserved as comments in `doLogin` & `toMessage`). Key invariants:

- HTTP 401 → credentials cleared, phase `error`, user must re-enter.
- HTTP 5xx / network → credentials kept, phase `error`, user can retry.
- `getToken()` always returns `null` if phase bukan `authenticated` (caller handles).
- Concurrent `getToken()` & `login()` share single in-flight promise (no double-fire).

## Testing

Unit tests di `packages/auth/src/__tests__/autoLoginAuthTokenProvider.spec.ts` (new) — see above.

Component tests di `apps/display-web/src/views/__tests__/LoginView.spec.ts` (new):

1. Mount with `idle` → form visible, fields, submit.
2. Submit valid → call `provider.login`, on `authenticated` → redirect `/display/`.
3. Submit empty → button disabled.
4. Mount with `logging-in` → spinner, form hidden.
5. Mount with `error` → form + banner.
6. Mount with `authenticated` → redirect immediately.
7. Route query `?session=expired` → "Sesi berakhir" banner.

Integration tests di `apps/display-web/src/__tests__/infrastructure.spec.ts` (update):

1. `getAuthTokenProvider()` returns `AutoLoginAuthTokenProvider`.
2. `getAdmissionQueueApi()` & `getRuntimeDeviceApi()` use the auto-login provider.
3. `__resetInfrastructureForTests()` clears all singletons.

Manual smoke (post-implementation):

1. Set `VITE_BILREG_API_BASE`, don't set `VITE_BILREG_TOKEN`.
2. Open `http://localhost:5174/display/lobby-poli-1`.
3. Expected: redirect to `/login?…` (or `/login`).
4. Submit valid credentials → redirect to `/display/lobby-poli-1`.
5. Refresh → no login form, silent auto-login, display normal.
6. DevTools: localStorage has `display.deviceCredentials` & `display.authToken`.
7. DevTools clear storage + refresh → login form.
8. Open second tab, login → first tab reflects new state.

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
- `IAuthTokenProvider` interface unchanged — `AutoLoginAuthTokenProvider` is a drop-in replacement.
- **`VITE_BILREG_TOKEN` is fully removed from `display-web`.** No fallback. The `EnvAuthTokenProvider` import is removed from `infrastructure.ts`. `.env.example` line for `VITE_BILREG_TOKEN` is removed (not deprecated). Rationale: dual-path adds ambiguity; the spec's whole point is to remove the static-token dependency. If rollback is needed, revert the commit.
- `display-web` does NOT introduce `@microsoft/signalr`; existing boundary holds.
- `LoginView` does NOT import any device-config or queue API; minimal coupling.
- **`expiredAt` is stored and read as ISO 8601 string** (`new Date().toISOString()` / `Date.parse`). Spec uses UTC consistently; no timezone handling in client.

## Out of scope (deferred)

- Companion spec: wire `ApiDeviceConfigurationProvider.listDisplayScreenIds()` ke `listDisplays()`. Requires this spec to be merged first.
- Removing `VITE_BILREG_TOKEN` env support entirely.
- Refresh token flow (backend support).
- Encrypted storage untuk credentials.
- Multi-account per device.
- Biometric/PIN unlock.
