# display-web Auto-Login Auth Token Provider Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `EnvAuthTokenProvider` di `display-web` dengan `AutoLoginAuthTokenProvider` yang auto-login via `POST /login` dengan credentials disimpan di `localStorage`. First-time boot tampilkan form login; subsequent boots silent auto-login.

**Architecture:** New class `AutoLoginAuthTokenProvider` di `packages/auth` yang implement `IAuthTokenProvider` plus method `login()`/`logout()`/`awaitAuthenticated()` dan reactive `phase`. `infrastructure.ts` wire provider ini dengan adapter untuk `loginBilreg` (menambahkan `appId: 'BilregDisplay'`). New `LoginView.vue` handle UI form. Router guard redirect ke `/login` saat `idle`/`error`, allow `logging-in` untuk pass through. `RootView` show loading saat `logging-in`. `DisplayPage` use `awaitAuthenticated()` instead of sync `getToken()`.

**Tech Stack:** Vue 3 (`<script setup lang="ts">`), Vue Router 4, TypeScript, Vitest, vue-test-utils, jsdom, Zod, `localStorage` API.

**Spec:** `docs/superpowers/specs/2026-07-25-display-web-auto-login-token-provider-design.md`

## Global Constraints

- Node `^20.19.0 || >=22.12.0`; pnpm `10.14.0`; enforced via `packageManager` + `engines` di root `package.json`.
- TypeScript strict: `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax`.
- Vue apps: `vue-tsc -p tsconfig.app.json --noEmit` (typecheck); `vitest run` (test).
- Packages: `tsc` (typecheck); `vitest run` (test).
- `pnpm` is the package manager. Do not introduce npm/yarn scripts.
- Indonesian user-facing copy; matches existing strings.
- No comments unless explaining non-obvious intent (existing repo convention).
- Do not add `@microsoft/signalr` to `kiosk-web` or anywhere outside `apps/display-web` (boundary holds).
- `apps/*/src/infrastructure.ts` is the only place that wires provider singletons outside of tests.
- `display-web` `.env.example` MUST NOT mention `VITE_BILREG_TOKEN` after Task 8.
- Storage key for credentials MUST be `aq.display.credentials` (namespaced, matches existing `aq.session.token` pattern from `SessionAuthTokenProvider`).
- `appId` in `loginImpl` adapter MUST be `'BilregDisplay'`. Backend role mapping is out of scope for this plan.
- Token is **in-memory only** (Vue `ref`); never persisted to storage. Credentials are persisted to `localStorage` for silent re-login.

## File Structure

| File | Status | Responsibility |
| --- | --- | --- |
| `packages/auth/src/autoLoginAuthTokenProvider.ts` | Create | `AutoLoginAuthTokenProvider` class, `AutoLoginPhase` type, `LoginImpl` type, `AutoLoginAuthTokenProviderOptions` type. |
| `packages/auth/src/index.ts` | Modify | Re-export new class + types. |
| `packages/auth/src/__tests__/autoLoginAuthTokenProvider.spec.ts` | Create | Unit tests for the new class. |
| `apps/display-web/src/infrastructure.ts` | Modify | Wire `AutoLoginAuthTokenProvider` with `loginBilreg` adapter (appId). Remove `EnvAuthTokenProvider` import. |
| `apps/display-web/src/views/LoginView.vue` | Create | Inline form login UI. |
| `apps/display-web/src/views/__tests__/LoginView.spec.ts` | Create | Component tests for LoginView. |
| `apps/display-web/src/router.ts` | Modify | Add `/login` route + `beforeEach` guard. |
| `apps/display-web/src/views/RootView.vue` | Modify | Show loading state during `logging-in` phase. |
| `apps/display-web/src/views/DisplayPage.vue` | Modify | Replace sync `getToken()` with `awaitAuthenticated()`. Update error message. |
| `apps/display-web/src/__tests__/infrastructure.spec.ts` | Modify | Add test that `getAuthTokenProvider()` returns `AutoLoginAuthTokenProvider` with correct `appId` adapter. |
| `apps/display-web/env.d.ts` | Modify | Remove `VITE_BILREG_TOKEN` from `ImportMetaEnv`. |
| `apps/display-web/.env.example` | Modify | Remove `VITE_BILREG_TOKEN` line. |
| `apps/display-web/README.md` | Modify | Update auth section: explain first-time login flow. |

Tasks are ordered to keep each one independently testable, with package changes first, then app changes. Tasks 1–2 ship the package surface; Tasks 3–8 ship the app; Task 9 is manual smoke; Task 10 is final verification.

---

### Task 1: Create `AutoLoginAuthTokenProvider` class

**Files:**
- Create: `packages/auth/src/autoLoginAuthTokenProvider.ts`
- Create: `packages/auth/src/__tests__/autoLoginAuthTokenProvider.spec.ts`

**Interfaces:**
- Consumes: `IAuthTokenProvider` from `packages/auth/src/index.ts`, `LoginResponse` from `@aq/shared-types`.
- Produces: `AutoLoginPhase` discriminated union, `LoginImpl` type, `AutoLoginAuthTokenProviderOptions` interface, `AutoLoginAuthTokenProvider` class with methods `getToken()`, `awaitAuthenticated()`, `login(email, pass)`, `logout()`, `destroy()`.

- [ ] **Step 1: Write the failing test for phase `idle` when no credentials in storage**

Create `packages/auth/src/__tests__/autoLoginAuthTokenProvider.spec.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import {
  AutoLoginAuthTokenProvider,
  type LoginImpl,
  type AutoLoginAuthTokenProviderOptions,
} from '../autoLoginAuthTokenProvider'

function createMemoryStorage(): Storage {
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

function createOkLogin(
  token = 'jwt.token.value',
  expiredDate: string | undefined = new Date(Date.now() + 60 * 60_000).toISOString(),
): LoginImpl {
  return vi.fn(async (_apiBase, _creds) => ({
    pegId: 'PEG1',
    userName: 'Display User',
    userLogin: 'display',
    email: 'display@example.com',
    expiredDate,
    tokenAuth: token,
    listRole: [],
  }))
}

function createOptions(
  overrides: Partial<AutoLoginAuthTokenProviderOptions> = {},
): AutoLoginAuthTokenProviderOptions {
  return {
    apiBase: 'http://localhost:5000/api',
    loginImpl: createOkLogin(),
    storage: createMemoryStorage(),
    clock: () => new Date('2026-07-25T10:00:00.000Z'),
    ...overrides,
  }
}

describe('AutoLoginAuthTokenProvider', () => {
  let providers: AutoLoginAuthTokenProvider[] = []

  afterEach(() => {
    for (const p of providers) p.destroy()
    providers = []
  })

  function create(options: Partial<AutoLoginAuthTokenProviderOptions> = {}) {
    const p = new AutoLoginAuthTokenProvider(createOptions(options))
    providers.push(p)
    return p
  }

  describe('constructor', () => {
    it('starts in idle phase when no credentials are stored', () => {
      const provider = create()
      expect(provider.phase.value).toEqual({ kind: 'idle' })
      expect(provider.getToken()).toBeNull()
    })

    it('attempts silent login when credentials are stored', async () => {
      const storage = createMemoryStorage()
      storage.setItem(
        'aq.display.credentials',
        JSON.stringify({ email: 'a@b.c', pass: 'pw' }),
      )
      const provider = create({ storage, loginImpl: createOkLogin('jwt.from.silent') })
      await nextTick()
      expect(provider.phase.value).toMatchObject({ kind: 'authenticated' })
      expect(provider.getToken()).toBe('jwt.from.silent')
    })

    it('treats corrupted credential JSON as idle without throwing', () => {
      const storage = createMemoryStorage()
      storage.setItem('aq.display.credentials', 'not json')
      const provider = create({ storage })
      expect(provider.phase.value).toEqual({ kind: 'idle' })
      expect(storage.getItem('aq.display.credentials')).toBeNull()
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run from repo root: `pnpm --filter @aq/auth test`
Expected: FAIL — `autoLoginAuthTokenProvider` module does not exist yet, import will throw.

- [ ] **Step 3: Implement the class skeleton (no behavior yet, just types + stub)**

Create `packages/auth/src/autoLoginAuthTokenProvider.ts`:

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
  defaultLifetimeMs?: number
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
  private readonly handleStorageEvent = (event: StorageEvent) => {
    if (event.key !== null && event.key !== CRED_KEY) return
    if (!this.readCredentials()) {
      this.phase.value = { kind: 'idle' }
    } else if (this.phase.value.kind === 'idle') {
      const credentials = this.readCredentials()!
      void this.silentLogin(credentials.email, credentials.pass)
    }
  }

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

  destroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', this.handleStorageEvent)
    }
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

- [ ] **Step 4: Run test to verify it passes**

Run from repo root: `pnpm --filter @aq/auth test`
Expected: PASS for the 3 constructor tests in the suite. The full test file has more (next steps).

- [ ] **Step 5: Commit**

```bash
git add packages/auth/src/autoLoginAuthTokenProvider.ts packages/auth/src/__tests__/autoLoginAuthTokenProvider.spec.ts
git commit -m "feat(auth): add AutoLoginAuthTokenProvider class"
```

---

### Task 2: Add comprehensive unit tests for `AutoLoginAuthTokenProvider`

**Files:**
- Modify: `packages/auth/src/__tests__/autoLoginAuthTokenProvider.spec.ts`

**Interfaces:**
- Consumes: class from Task 1.
- Produces: tests covering login/logout/getToken/awaitAuthenticated/expiry/cross-tab.

- [ ] **Step 1: Add tests for `login()`, `getToken()`, expiry, logout, error, concurrent, and cross-tab**

Append to the existing `describe('AutoLoginAuthTokenProvider', ...)` block in the test file. Insert the new `describe` blocks after the existing `describe('constructor', ...)` block:

```ts
  describe('login()', () => {
    it('transitions idle → logging-in → authenticated on success', async () => {
      const storage = createMemoryStorage()
      const provider = create({ storage })
      const phases: string[] = []
      const stop = () => {
        // capture snapshots after the call resolves
      }

      const promise = provider.login('a@b.c', 'pw')
      phases.push(provider.phase.value.kind)
      await promise
      phases.push(provider.phase.value.kind)

      expect(phases).toEqual(['logging-in', 'authenticated'])
      expect(provider.getToken()).toBe('jwt.token.value')
      expect(JSON.parse(storage.getItem('aq.display.credentials')!)).toEqual({
        email: 'a@b.c',
        pass: 'pw',
      })
    })

    it('uses default 1h lifetime when expiredDate is missing', async () => {
      const now = new Date('2026-07-25T10:00:00.000Z')
      const loginImpl = createOkLogin('t', undefined)
      const storage = createMemoryStorage()
      const provider = create({
        storage,
        loginImpl,
        clock: () => now,
      })
      await provider.login('a@b.c', 'pw')
      const phase = provider.phase.value
      if (phase.kind !== 'authenticated') throw new Error('expected authenticated')
      const expectedExpiry = new Date(now.getTime() + 60 * 60_000).toISOString()
      expect(phase.expiredAt).toBe(expectedExpiry)
    })

    it('clears credentials on HTTP 401', async () => {
      const storage = createMemoryStorage()
      const loginImpl: LoginImpl = vi.fn(async () => {
        const error = new Error('Unauthorized') as Error & { statusCode: number }
        error.statusCode = 401
        throw error
      })
      const provider = create({ storage, loginImpl })
      await provider.login('a@b.c', 'pw')
      expect(provider.phase.value).toMatchObject({ kind: 'error' })
      expect(storage.getItem('aq.display.credentials')).toBeNull()
    })

    it('keeps credentials on HTTP 500', async () => {
      const storage = createMemoryStorage()
      const loginImpl: LoginImpl = vi.fn(async () => {
        const error = new Error('Boom') as Error & { statusCode: number }
        error.statusCode = 500
        throw error
      })
      const provider = create({ storage, loginImpl })
      await provider.login('a@b.c', 'pw')
      expect(provider.phase.value).toMatchObject({
        kind: 'error',
        message: 'Server sedang gangguan. Coba lagi.',
      })
      expect(JSON.parse(storage.getItem('aq.display.credentials')!)).toEqual({
        email: 'a@b.c',
        pass: 'pw',
      })
    })

    it('keeps credentials on network failure (statusCode 0)', async () => {
      const storage = createMemoryStorage()
      const loginImpl: LoginImpl = vi.fn(async () => {
        const error = new Error('Network') as Error & { statusCode: number }
        error.statusCode = 0
        throw error
      })
      const provider = create({ storage, loginImpl })
      await provider.login('a@b.c', 'pw')
      expect(provider.phase.value).toMatchObject({
        kind: 'error',
        message: 'Tidak dapat menghubungi server.',
      })
      expect(storage.getItem('aq.display.credentials')).not.toBeNull()
    })

    it('shares a single in-flight login across concurrent calls', async () => {
      let resolveLogin: (value: LoginResponse) => void = () => {}
      const loginImpl = vi.fn(
        () => new Promise<LoginResponse>((resolve) => { resolveLogin = resolve }),
      )
      const provider = create({ loginImpl })
      const p1 = provider.login('a@b.c', 'pw')
      const p2 = provider.login('a@b.c', 'pw')
      expect(loginImpl).toHaveBeenCalledTimes(1)
      resolveLogin({
        pegId: 'P', userName: 'U', email: 'a@b.c',
        tokenAuth: 't', listRole: [],
      })
      await Promise.all([p1, p2])
      expect(provider.phase.value).toMatchObject({ kind: 'authenticated' })
    })

    it('does NOT persist token to storage (only credentials)', async () => {
      const storage = createMemoryStorage()
      const provider = create({ storage })
      await provider.login('a@b.c', 'pw')
      const keys = Array.from(
        { length: storage.length },
        (_v, i) => storage.key(i),
      )
      expect(keys).toEqual(['aq.display.credentials'])
    })
  })

  describe('getToken()', () => {
    it('returns null during logging-in', async () => {
      let resolveLogin: (value: LoginResponse) => void = () => {}
      const loginImpl = vi.fn(
        () => new Promise<LoginResponse>((resolve) => { resolveLogin = resolve }),
      )
      const provider = create({ loginImpl })
      void provider.login('a@b.c', 'pw')
      await nextTick()
      expect(provider.phase.value.kind).toBe('logging-in')
      expect(provider.getToken()).toBeNull()
      resolveLogin({
        pegId: 'P', userName: 'U', email: 'a@b.c',
        tokenAuth: 't', listRole: [],
      })
    })

    it('triggers silent re-login when token is past skew', async () => {
      const storedTime = new Date('2026-07-25T10:00:00.000Z')
      const storage = createMemoryStorage()
      const loginImpl = createOkLogin('new.jwt', new Date('2026-07-25T12:00:00.000Z').toISOString())
      const provider = create({
        storage, loginImpl, clock: () => storedTime,
      })
      await provider.login('a@b.c', 'pw')
      // jump past the default 1h lifetime
      const future = new Date('2026-07-25T11:30:00.000Z')
      const stale = new AutoLoginAuthTokenProvider({
        apiBase: 'http://localhost:5000/api',
        loginImpl,
        storage,
        clock: () => future,
      })
      providers.push(stale)
      expect(stale.getToken()).toBeNull()
      await nextTick()
      expect(stale.phase.value).toMatchObject({ kind: 'authenticated' })
      expect(stale.getToken()).toBe('new.jwt')
    })

    it('returns null when phase is error', async () => {
      const loginImpl: LoginImpl = vi.fn(async () => {
        const error = new Error('Boom') as Error & { statusCode: number }
        error.statusCode = 500
        throw error
      })
      const provider = create({ loginImpl })
      await provider.login('a@b.c', 'pw')
      expect(provider.getToken()).toBeNull()
    })
  })

  describe('awaitAuthenticated()', () => {
    it('resolves immediately when authenticated', async () => {
      const provider = create()
      await provider.login('a@b.c', 'pw')
      await expect(provider.awaitAuthenticated()).resolves.toBeUndefined()
    })

    it('waits for in-flight login and resolves on success', async () => {
      let resolveLogin: (value: LoginResponse) => void = () => {}
      const loginImpl = vi.fn(
        () => new Promise<LoginResponse>((resolve) => { resolveLogin = resolve }),
      )
      const provider = create({ loginImpl })
      const awaited = provider.awaitAuthenticated()
      resolveLogin({
        pegId: 'P', userName: 'U', email: 'a@b.c',
        tokenAuth: 't', listRole: [],
      })
      await expect(awaited).resolves.toBeUndefined()
    })

    it('rejects with MissingAuthTokenError when phase is error', async () => {
      const loginImpl: LoginImpl = vi.fn(async () => {
        const error = new Error('Boom') as Error & { statusCode: number }
        error.statusCode = 401
        throw error
      })
      const provider = create({ loginImpl })
      await provider.login('a@b.c', 'pw')
      const { MissingAuthTokenError } = await import('../index')
      await expect(provider.awaitAuthenticated()).rejects.toBeInstanceOf(MissingAuthTokenError)
    })

    it('rejects with MissingAuthTokenError when phase is idle', async () => {
      const provider = create()
      const { MissingAuthTokenError } = await import('../index')
      await expect(provider.awaitAuthenticated()).rejects.toBeInstanceOf(MissingAuthTokenError)
    })
  })

  describe('logout()', () => {
    it('clears credentials from storage and returns phase to idle', async () => {
      const storage = createMemoryStorage()
      const provider = create({ storage })
      await provider.login('a@b.c', 'pw')
      expect(storage.getItem('aq.display.credentials')).not.toBeNull()
      provider.logout()
      expect(storage.getItem('aq.display.credentials')).toBeNull()
      expect(provider.phase.value).toEqual({ kind: 'idle' })
      expect(provider.getToken()).toBeNull()
    })
  })

  describe('cross-tab storage event', () => {
    it('returns to idle when credentials are cleared in another tab', async () => {
      const storage = createMemoryStorage()
      const provider = create({ storage })
      await provider.login('a@b.c', 'pw')

      // simulate other tab clearing credentials
      storage.removeItem('aq.display.credentials')
      const event = new StorageEvent('storage', {
        key: 'aq.display.credentials',
        oldValue: null,
        newValue: null,
        storageArea: storage,
      })
      window.dispatchEvent(event)

      expect(provider.phase.value).toEqual({ kind: 'idle' })
    })
  })
```

- [ ] **Step 2: Run tests to verify they pass**

Run from repo root: `pnpm --filter @aq/auth test`
Expected: PASS. All ~18 tests in the file pass.

- [ ] **Step 3: Run typecheck**

Run from repo root: `pnpm --filter @aq/auth typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/auth/src/__tests__/autoLoginAuthTokenProvider.spec.ts
git commit -m "test(auth): cover AutoLoginAuthTokenProvider"
```

---

### Task 3: Re-export `AutoLoginAuthTokenProvider` from `@aq/auth` index

**Files:**
- Modify: `packages/auth/src/index.ts`

**Interfaces:**
- Consumes: types and class from `autoLoginAuthTokenProvider.ts` (Task 1).
- Produces: re-exports so `apps/display-web` can `import { AutoLoginAuthTokenProvider } from '@aq/auth'`.

- [ ] **Step 1: Add export block to `index.ts`**

Edit `packages/auth/src/index.ts`. Append at the end of the file (after the existing `createSessionAuthTokenProvider` export):

```ts
export {
  AutoLoginAuthTokenProvider,
  type AutoLoginAuthTokenProviderOptions,
  type AutoLoginPhase,
  type LoginImpl,
} from './autoLoginAuthTokenProvider'
```

The full file becomes (insert at end, leave existing content untouched):

```ts
export interface IAuthTokenProvider {
  getToken(): string | null
}

export class MissingAuthTokenError extends Error {
  readonly code = 'AUTH_TOKEN_MISSING' as const

  constructor(message = 'Authentication token is not configured') {
    super(message)
    this.name = 'MissingAuthTokenError'
  }
}

export class EnvAuthTokenProvider implements IAuthTokenProvider {
  constructor(private readonly token: string | undefined | null) {}

  getToken(): string | null {
    const value = this.token?.trim()
    return value ? value : null
  }

  requireToken(): string {
    const token = this.getToken()
    if (!token) throw new MissingAuthTokenError()
    return token
  }
}

export function createEnvAuthTokenProvider(
  env: Record<string, string | undefined> = {},
): EnvAuthTokenProvider {
  return new EnvAuthTokenProvider(env.VITE_BILREG_TOKEN)
}

const SESSION_STORAGE_KEY = 'aq.session.token'

/**
 * Interactive session token holder for config-web.
 * Tokens are persisted to sessionStorage so they survive a full-page reload
 * within the same tab. They are cleared when the tab is closed and are
 * intentionally not written to localStorage to limit cross-session exposure.
 *
 * Storage key is namespaced (`aq.session.token`) so the package does not
 * collide with other code touching the same origin.
 */
export class SessionAuthTokenProvider implements IAuthTokenProvider {
  getToken(): string | null {
    try {
      return sessionStorage.getItem(SESSION_STORAGE_KEY)
    } catch {
      return null
    }
  }

  setToken(token: string | null | undefined): void {
    const value = token?.trim()
    try {
      if (value) sessionStorage.setItem(SESSION_STORAGE_KEY, value)
      else sessionStorage.removeItem(SESSION_STORAGE_KEY)
    } catch {
      // Storage may be unavailable (private mode, disabled, quota); fall through.
    }
  }

  clear(): void {
    try {
      sessionStorage.removeItem(SESSION_STORAGE_KEY)
    } catch {
      // ignore
    }
  }

  requireToken(): string {
    const token = this.getToken()
    if (!token) throw new MissingAuthTokenError('Session authentication token is missing')
    return token
  }
}

export function __resetSessionAuthForTests(): void {
  try {
    sessionStorage.removeItem(SESSION_STORAGE_KEY)
  } catch {
    // ignore
  }
}

export function createSessionAuthTokenProvider(): SessionAuthTokenProvider {
  return new SessionAuthTokenProvider()
}

export {
  AutoLoginAuthTokenProvider,
  type AutoLoginAuthTokenProviderOptions,
  type AutoLoginPhase,
  type LoginImpl,
} from './autoLoginAuthTokenProvider'
```

- [ ] **Step 2: Run typecheck to confirm re-exports compile**

Run from repo root: `pnpm --filter @aq/auth typecheck`
Expected: PASS. No consumers yet — the re-export is just plumbing.

- [ ] **Step 3: Commit**

```bash
git add packages/auth/src/index.ts
git commit -m "feat(auth): re-export AutoLoginAuthTokenProvider"
```

---

### Task 4: Wire `AutoLoginAuthTokenProvider` in `display-web/src/infrastructure.ts`

**Files:**
- Modify: `apps/display-web/src/infrastructure.ts`
- Modify: `apps/display-web/src/__tests__/infrastructure.spec.ts`

**Interfaces:**
- Consumes: `AutoLoginAuthTokenProvider`, `loginBilreg` from `@aq/api-client`.
- Produces: `getAuthTokenProvider()` returns `AutoLoginAuthTokenProvider` with `loginImpl` adapter that adds `appId: 'BilregDisplay'`.

- [ ] **Step 1: Add failing test in `infrastructure.spec.ts`**

Edit `apps/display-web/src/__tests__/infrastructure.spec.ts`. Append at the end of the file (after the existing `describe('getAdmissionQueueHubUrl', ...)` block):

```ts
describe('getAuthTokenProvider', () => {
  it('returns an AutoLoginAuthTokenProvider', async () => {
    ;(import.meta.env as Record<string, string | boolean>).VITE_BILREG_API_BASE =
      'http://localhost:5000/api'
    const { getAuthTokenProvider, __resetInfrastructureForTests } = await import(
      '@/infrastructure'
    )
    __resetInfrastructureForTests()
    const { AutoLoginAuthTokenProvider } = await import('@aq/auth')
    const provider = getAuthTokenProvider()
    expect(provider).toBeInstanceOf(AutoLoginAuthTokenProvider)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run from repo root: `pnpm --filter display-web test -- src/__tests__/infrastructure.spec.ts`
Expected: FAIL — `getAuthTokenProvider` still returns `EnvAuthTokenProvider`.

- [ ] **Step 3: Update `infrastructure.ts` to wire `AutoLoginAuthTokenProvider`**

Edit `apps/display-web/src/infrastructure.ts`. The full file becomes:

```ts
import { AutoLoginAuthTokenProvider, type IAuthTokenProvider } from '@aq/auth'
import {
  AdmissionQueueClient,
  buildAdmissionQueueHubUrl,
  createAdmissionQueueApi,
  createRuntimeDeviceApi,
  loginBilreg,
  type AdmissionQueueApi,
} from '@aq/api-client'
import {
  ApiDeviceConfigurationProvider,
  JsonDeviceConfigurationProvider,
  type IDeviceConfigurationProvider,
} from '@aq/device-config'

let deviceConfigProvider: IDeviceConfigurationProvider | null = null
let authTokenProvider: AutoLoginAuthTokenProvider | null = null
let admissionQueueApi: AdmissionQueueApi | null = null
let runtimeDeviceApi: ReturnType<typeof createRuntimeDeviceApi> | null = null

function getProviderMode(): 'api' | 'json' {
  const raw = (import.meta.env.VITE_DEVICE_CONFIG_PROVIDER ?? 'api').trim().toLowerCase()
  return raw === 'json' ? 'json' : 'api'
}

export async function getDeviceConfigProvider(): Promise<IDeviceConfigurationProvider> {
  if (deviceConfigProvider) return deviceConfigProvider
  const mode = getProviderMode()
  if (mode === 'json') {
    const response = await fetch(`${import.meta.env.BASE_URL}devices.json`, { cache: 'no-store' })
    if (!response.ok) {
      throw new Error(`Failed to load devices.json (${response.status})`)
    }
    const json = (await response.json()) as unknown
    deviceConfigProvider = JsonDeviceConfigurationProvider.fromJson(json)
    return deviceConfigProvider
  }

  const runtime = getRuntimeDeviceApi()
  deviceConfigProvider = new ApiDeviceConfigurationProvider({
    getDisplayBootConfig: (displayId) => runtime.getDisplayBootConfig(displayId),
  })
  return deviceConfigProvider
}

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

export function getAdmissionQueueApi(): AdmissionQueueApi {
  if (admissionQueueApi) return admissionQueueApi
  const baseUrl = import.meta.env.VITE_BILREG_API_BASE?.trim()
  if (!baseUrl) {
    throw new Error('VITE_BILREG_API_BASE is not configured')
  }
  const client = new AdmissionQueueClient({
    baseUrl,
    auth: getAuthTokenProvider(),
  })
  admissionQueueApi = createAdmissionQueueApi(client)
  return admissionQueueApi
}

function getRuntimeDeviceApi() {
  if (runtimeDeviceApi) return runtimeDeviceApi
  const baseUrl = import.meta.env.VITE_BILREG_API_BASE?.trim()
  if (!baseUrl) {
    throw new Error('VITE_BILREG_API_BASE is not configured')
  }
  const client = new AdmissionQueueClient({
    baseUrl,
    auth: getAuthTokenProvider(),
  })
  runtimeDeviceApi = createRuntimeDeviceApi(client)
  return runtimeDeviceApi
}

export function getAdmissionQueueHubUrl(): string {
  const baseUrl = import.meta.env.VITE_BILREG_API_BASE?.trim()
  if (!baseUrl) {
    throw new Error('VITE_BILREG_API_BASE is not configured')
  }
  if (import.meta.env.DEV) {
    return '/hubs/admission-queue'
  }
  return buildAdmissionQueueHubUrl(baseUrl)
}

export function __resetInfrastructureForTests() {
  deviceConfigProvider = null
  authTokenProvider = null
  admissionQueueApi = null
  runtimeDeviceApi = null
}

// IAuthTokenProvider type re-export so consumers (e.g. tests) can type-narrow
// without importing the package directly.
export type { IAuthTokenProvider }
```

Key changes:
- Import `AutoLoginAuthTokenProvider` from `@aq/auth`.
- Import `loginBilreg` from `@aq/api-client`.
- `getAuthTokenProvider()` now returns `AutoLoginAuthTokenProvider` (not `IAuthTokenProvider`).
- `loginImpl` adapter adds `appId: 'BilregDisplay'`.
- `AdmissionQueueClient` accepts `getAuthTokenProvider()` directly (subtype of `IAuthTokenProvider`).

- [ ] **Step 4: Run test to verify it passes**

Run from repo root: `pnpm --filter display-web test -- src/__tests__/infrastructure.spec.ts`
Expected: PASS.

- [ ] **Step 5: Run typecheck**

Run from repo root: `pnpm --filter display-web typecheck`
Expected: PASS. Downstream consumers (`DisplayPage.vue`, `MissingScreenPicker.vue`) still see `IAuthTokenProvider` contract via `getToken()`.

- [ ] **Step 6: Commit**

```bash
git add apps/display-web/src/infrastructure.ts apps/display-web/src/__tests__/infrastructure.spec.ts
git commit -m "feat(display-web): wire AutoLoginAuthTokenProvider with appId"
```

---

### Task 5: Create `LoginView.vue` with form

**Files:**
- Create: `apps/display-web/src/views/LoginView.vue`
- Create: `apps/display-web/src/views/__tests__/LoginView.spec.ts`

**Interfaces:**
- Consumes: `getAuthTokenProvider()` from `infrastructure.ts` (Task 4).
- Produces: form-based view that calls `provider.login(email, pass)`, watches `phase`, redirects on `authenticated`. Honors `?session=expired` banner and `?redirect=...` query.

- [ ] **Step 1: Write the failing component test**

Create `apps/display-web/src/views/__tests__/LoginView.spec.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { ref } from 'vue'
import {
  AutoLoginAuthTokenProvider,
  type AutoLoginPhase,
  type LoginImpl,
} from '@aq/auth'

const loginImpl = vi.fn<LoginImpl>(async () => ({
  pegId: 'P', userName: 'U', email: 'a@b.c',
  tokenAuth: 'jwt', listRole: [],
}))

let phase: { value: AutoLoginPhase }
let provider: AutoLoginAuthTokenProvider

beforeEach(() => {
  phase = ref<AutoLoginPhase>({ kind: 'idle' }) as { value: AutoLoginPhase }
  provider = {
    phase,
    login: vi.fn(async (email: string, pass: string) => {
      await loginImpl('http://localhost:5000/api', { email, pass })
      phase.value = { kind: 'authenticated', token: 'jwt', expiredAt: new Date(Date.now() + 3600_000).toISOString() }
    }),
    logout: vi.fn(),
    getToken: () => null,
    awaitAuthenticated: async () => {},
    destroy: vi.fn(),
  } as unknown as AutoLoginAuthTokenProvider
})

afterEach(() => {
  vi.restoreAllMocks()
})

async function mountView(initialRoute = '/login') {
  const LoginView = (await import('../LoginView.vue')).default
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/login', name: 'login', component: LoginView },
      { path: '/display/:screenId?', name: 'display', component: { template: '<div>display</div>' } },
    ],
  })
  await router.push(initialRoute)
  await router.isReady()

  const wrapper = mount(LoginView, {
    global: { plugins: [router] },
  })
  // Inject the mocked provider
  ;(wrapper.vm as unknown as { provider: AutoLoginAuthTokenProvider }).provider = provider
  return { wrapper, router }
}

describe('LoginView', () => {
  it('renders form when phase is idle', async () => {
    const { wrapper } = await mountView()
    expect(wrapper.find('input[type=email]').exists()).toBe(true)
    expect(wrapper.find('input[type=password]').exists()).toBe(true)
    expect(wrapper.find('button[type=submit]').exists()).toBe(true)
  })

  it('disables submit when fields are empty', async () => {
    const { wrapper } = await mountView()
    const button = wrapper.find('button[type=submit]')
    expect(button.attributes('disabled')).toBeDefined()
  })

  it('calls provider.login on submit and redirects on authenticated', async () => {
    const { wrapper, router } = await mountView('/login?redirect=/display/lobby')
    await wrapper.find('input[type=email]').setValue('a@b.c')
    await wrapper.find('input[type=password]').setValue('pw')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()
    expect(provider.login).toHaveBeenCalledWith('a@b.c', 'pw')
    expect(router.currentRoute.value.fullPath).toBe('/display/lobby')
  })

  it('shows "Sedang login…" when phase is logging-in', async () => {
    phase.value = { kind: 'logging-in' }
    const { wrapper } = await mountView()
    expect(wrapper.text()).toContain('Sedang login')
  })

  it('shows error banner when phase is error', async () => {
    phase.value = { kind: 'error', message: 'Email atau password salah.' }
    const { wrapper } = await mountView()
    expect(wrapper.text()).toContain('Email atau password salah.')
  })

  it('shows session-expired banner when ?session=expired', async () => {
    const { wrapper } = await mountView('/login?session=expired')
    expect(wrapper.text()).toContain('Sesi Anda telah berakhir')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run from repo root: `pnpm --filter display-web test -- src/views/__tests__/LoginView.spec.ts`
Expected: FAIL — `LoginView.vue` does not exist.

- [ ] **Step 3: Implement `LoginView.vue`**

Create `apps/display-web/src/views/LoginView.vue`:

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

    <form
      v-if="provider.phase.value.kind === 'idle' || provider.phase.value.kind === 'error'"
      @submit.prevent="submit"
    >
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

- [ ] **Step 4: Run test to verify it passes**

Run from repo root: `pnpm --filter display-web test -- src/views/__tests__/LoginView.spec.ts`
Expected: PASS. All 6 tests pass.

- [ ] **Step 5: Run typecheck**

Run from repo root: `pnpm --filter display-web typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/display-web/src/views/LoginView.vue apps/display-web/src/views/__tests__/LoginView.spec.ts
git commit -m "feat(display-web): add LoginView with inline form"
```

---

### Task 6: Add `/login` route and navigation guard to router

**Files:**
- Modify: `apps/display-web/src/router.ts`

**Interfaces:**
- Consumes: `LoginView` from Task 5, `getAuthTokenProvider()` from Task 4.
- Produces: router with `/login` route and `beforeEach` guard that redirects to `/login` when phase is `idle` or `error`, allows `logging-in` and `authenticated` through.

- [ ] **Step 1: Update `router.ts`**

Edit `apps/display-web/src/router.ts`. The full file becomes:

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

- [ ] **Step 2: Run typecheck**

Run from repo root: `pnpm --filter display-web typecheck`
Expected: PASS.

- [ ] **Step 3: Run all display-web tests to ensure no regression**

Run from repo root: `pnpm --filter display-web test`
Expected: PASS. The 22 existing tests + 6 new LoginView tests + 1 new infrastructure test all pass.

- [ ] **Step 4: Commit**

```bash
git add apps/display-web/src/router.ts
git commit -m "feat(display-web): add /login route and navigation guard"
```

---

### Task 7: Update `RootView.vue` to show loading state during `logging-in`

**Files:**
- Modify: `apps/display-web/src/views/RootView.vue`

**Interfaces:**
- Consumes: `getAuthTokenProvider()` from Task 4, `DisplayPage` + `MissingScreenPicker` (existing).
- Produces: when phase is `logging-in`, show "Memverifikasi login…" instead of `DisplayPage` or `MissingScreenPicker`. Otherwise existing behavior.

- [ ] **Step 1: Update `RootView.vue`**

Edit `apps/display-web/src/views/RootView.vue`. The full file becomes:

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

const authPending = computed(() => provider.phase.value.kind === 'logging-in')
</script>

<template>
  <p v-if="authPending" class="loading">Memverifikasi login…</p>
  <DisplayPage v-else-if="screenId" :screen-id="screenId" />
  <MissingScreenPicker v-else />
</template>
```

- [ ] **Step 2: Run typecheck**

Run from repo root: `pnpm --filter display-web typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/display-web/src/views/RootView.vue
git commit -m "feat(display-web): show loading state during auto-login"
```

---

### Task 8: Replace sync `getToken()` with `awaitAuthenticated()` in `DisplayPage.vue`

**Files:**
- Modify: `apps/display-web/src/views/DisplayPage.vue`

**Interfaces:**
- Consumes: `getAuthTokenProvider()` returning `AutoLoginAuthTokenProvider` with `awaitAuthenticated()` method.
- Produces: `DisplayPage.vue` watch callback that awaits `awaitAuthenticated()` instead of checking `getToken()` synchronously. Error message updated.

- [ ] **Step 1: Update the boot watch in `DisplayPage.vue`**

Edit `apps/display-web/src/views/DisplayPage.vue`. Locate the existing `watch` block that contains:

```ts
    try {
      const token = getAuthTokenProvider().getToken()
      if (!token) throw new MissingAuthTokenError()

      const provider = await getDeviceConfigProvider()
      ...
```

Replace the `try` block's first two lines (`const token = ...; if (!token) throw ...`) with:

```ts
    try {
      await getAuthTokenProvider().awaitAuthenticated()

      const provider = await getDeviceConfigProvider()
      ...
```

The full updated watch block (with surrounding context) becomes:

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

Changes from current:
- `const token = getAuthTokenProvider().getToken(); if (!token) throw new MissingAuthTokenError()` → `await getAuthTokenProvider().awaitAuthenticated()`
- `'VITE_BILREG_TOKEN belum dikonfigurasi.'` → `'Sesi berakhir. Silakan login ulang.'`

- [ ] **Step 2: Run typecheck**

Run from repo root: `pnpm --filter display-web typecheck`
Expected: PASS.

- [ ] **Step 3: Run all display-web tests**

Run from repo root: `pnpm --filter display-web test`
Expected: PASS. The 22 existing tests + 6 LoginView + 1 infrastructure = 29 total all pass.

- [ ] **Step 4: Commit**

```bash
git add apps/display-web/src/views/DisplayPage.vue
git commit -m "refactor(display-web): use awaitAuthenticated in DisplayPage boot"
```

---

### Task 9: Remove `VITE_BILREG_TOKEN` from env, types, and README

**Files:**
- Modify: `apps/display-web/.env.example`
- Modify: `apps/display-web/env.d.ts`
- Modify: `apps/display-web/README.md`

**Interfaces:**
- Consumes: existing `.env.example`, `env.d.ts`, `README.md`.
- Produces: `VITE_BILREG_TOKEN` removed from all three. README updated to explain auto-login flow.

- [ ] **Step 1: Update `.env.example`**

Edit `apps/display-web/.env.example`. Remove the `VITE_BILREG_TOKEN=` line. The file becomes:

```
VITE_BILREG_API_BASE=http://localhost:5000/api
```

- [ ] **Step 2: Update `env.d.ts`**

Edit `apps/display-web/env.d.ts`. Remove `VITE_BILREG_TOKEN` from the `ImportMetaEnv` interface. The file becomes:

```ts
interface ImportMetaEnv {
  readonly VITE_BILREG_API_BASE: string
  readonly VITE_DEVICE_CONFIG_PROVIDER?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
```

- [ ] **Step 3: Update `README.md` auth section**

Edit `apps/display-web/README.md`. Replace the existing "Features" and "Dev" sections with updated copy. The full file becomes:

```markdown
# display-web

Admission Queue Display client (Phase **C3** complete + Auto-Login).

Path: `/display/{screenId}`

## Features

- Device-config boot from API (`/devices/displays/{displayId}`) with optional `devices.json` fallback (legacy, via `VITE_DEVICE_CONFIG_PROVIDER=json`).
- Snapshot authority via `GET /api/v1/admission-queue/displays/current` + poll.
- SignalR `RefreshHint` → snapshot refetch (never authoritative state).
- AnnouncementVersion-gated Web Speech TTS.
- Idle soft reload when `version.json` changes.
- **Auto-login**: first boot shows inline form, subsequent boots silent re-login from `localStorage` credentials.

## Dev

```bash
pnpm --filter display-web dev
# http://localhost:5174/display/lobby-poli-1
```

Required env: `VITE_BILREG_API_BASE` only. The dev server is at `http://localhost:5174/display/`.

### First-time login

On first boot, the page redirects to `/login` with the original URL preserved as `?redirect=...`. Enter an email + password; credentials are stored in `localStorage` under `aq.display.credentials` and a JWT is obtained from `POST /login`. Subsequent boots use these credentials for silent auto-login.

If the token expires (default 1h, server-controlled via `expiredDate`), the app silently re-authenticates. If re-authentication fails (network, 401, etc.), the app redirects back to `/login`.
```

- [ ] **Step 4: Run typecheck**

Run from repo root: `pnpm --filter display-web typecheck`
Expected: PASS. No `VITE_BILREG_TOKEN` references remain in TypeScript code.

- [ ] **Step 5: Commit**

```bash
git add apps/display-web/.env.example apps/display-web/env.d.ts apps/display-web/README.md
git commit -m "chore(display-web): remove VITE_BILREG_TOKEN, document auto-login"
```

---

### Task 10: Manual smoke verification

**Files:** none (verification only).

This task is not a test the framework runs; it is a sanity pass the implementer performs before declaring the work done. Use the dev server.

- [ ] **Step 1: Start the dev server**

Run from repo root: `pnpm dev:display`
Expected: Vite serves `apps/display-web` at `http://localhost:5174/display/`.

- [ ] **Step 2: Verify no token in env**

Check `apps/display-web/.env.local`. It should have only `VITE_BILREG_API_BASE=...`, no `VITE_BILREG_TOKEN`.

- [ ] **Step 3: Open `/display/lobby-poli-1` and verify redirect to login**

Visit `http://localhost:5174/display/lobby-poli-1`.
Expected: redirects to `http://localhost:5174/display/login?redirect=/display/lobby-poli-1` (note: `BASE_URL` is `/display/` so the path becomes `/display/login`). Form with email + password fields visible.

- [ ] **Step 4: Submit valid credentials and verify display loads**

Input a valid email + password (use a test account configured in the Bilreg API). Submit.
Expected: redirects to `/display/lobby-poli-1`, normal display renders (header "Antrian Admisi", Screen `lobby-poli-1`).

- [ ] **Step 5: Verify localStorage state**

Open DevTools → Application → Local Storage. Expected: `aq.display.credentials` key with `{"email":"...","pass":"..."}`. NO `aq.display.authToken` key (token is in-memory only).

- [ ] **Step 6: Refresh page and verify silent auto-login**

Press F5 (or refresh button).
Expected: brief "Memverifikasi login…" flash, then normal display. NO login form.

- [ ] **Step 7: Clear storage and verify login form returns**

DevTools → Application → Local Storage → right-click `aq.display.credentials` → Delete. Refresh.
Expected: redirects to `/login`, form visible again.

- [ ] **Step 8: Test cross-tab sync**

Open a second tab at the same URL. Login in the new tab. Switch back to first tab.
Expected: first tab reflects authenticated state via `storage` event (no flicker to login).

- [ ] **Step 9: Test session-expired banner**

Manually edit `aq.display.credentials` in DevTools to invalid credentials (or wait for natural token expiry). Trigger an API call (refresh display, navigate to another screen).
Expected: phase becomes `error`, `getToken()` returns `null`, `awaitAuthenticated()` rejects. If `DisplayPage` boot triggers it, error message "Sesi berakhir. Silakan login ulang." shows. If reached via URL `/login?session=expired`, the "Sesi Anda telah berakhir" banner shows.

- [ ] **Step 10: Stop the dev server**

Press `Ctrl+C` in the terminal running the dev server.

- [ ] **Step 11: Commit any doc follow-ups (if needed)**

If any doc reference to `VITE_BILREG_TOKEN` was discovered in unrelated files, update in this commit. Pre-check: only the three files modified in Task 9 reference it.

---

### Task 11: Final verification (full test + typecheck + build)

**Files:** none.

- [ ] **Step 1: Run all package tests**

Run from repo root: `pnpm --filter @aq/auth test`
Expected: PASS. All ~18 unit tests pass.

- [ ] **Step 2: Run all app tests**

Run from repo root: `pnpm --filter display-web test`
Expected: PASS. All tests pass (existing 22 + 6 LoginView + 1 infrastructure = ~29).

- [ ] **Step 3: Run typecheck for the changed package and app**

Run from repo root: `pnpm --filter @aq/auth typecheck && pnpm --filter display-web typecheck`
Expected: PASS.

- [ ] **Step 4: Run the full monorepo build**

Run from repo root: `pnpm build`
Expected: PASS. `turbo` fans out to all packages; the kiosk app, config-web, and other packages should be unaffected.

- [ ] **Step 5: Commit nothing (or a chore commit if the build surfaced a fix)**

If everything passes, do not create a new commit. If a build fix was needed, commit it now with message `chore: build fix from auto-login rollout`.

---

## Self-Review

1. **Spec coverage:**
   - First-time inline form login → Task 5 (LoginView).
   - Credentials in `localStorage` at `aq.display.credentials` → Task 1 (CRED_KEY constant).
   - Token in-memory only, not persisted → Task 1 (`doLogin` writes only credentials) + Task 2 test "does NOT persist token to storage".
   - `AutoLoginPhase` discriminated union with `idle`/`logging-in`/`authenticated`/`error` → Task 1.
   - `getToken()` returns null for non-authenticated, triggers re-login if expired → Task 1 + Task 2 tests.
   - `awaitAuthenticated()` waits for in-flight, rejects `MissingAuthTokenError` on fail → Task 1 + Task 2 tests.
   - `login(email, pass)` user-facing method, single in-flight shared → Task 1 + Task 2 test.
   - `logout()` clears storage and phase → Task 1 + Task 2 test.
   - Cross-tab `storage` event → Task 1 `handleStorageEvent` + Task 2 test.
   - Storage fallback to in-memory when `localStorage` unavailable → Task 1 `safeLocalStorage()` + `memoryStorage()`.
   - Default lifetime 1h, skew 5 min → Task 1 constructor defaults.
   - HTTP 401 → credentials cleared; 5xx → credentials kept → Task 1 `doLogin(clearOnAuthFail)` + Task 2 tests.
   - `appId: 'BilregDisplay'` adapter → Task 4.
   - `infrastructure.ts` returns `AutoLoginAuthTokenProvider` (not `EnvAuthTokenProvider`) → Task 4.
   - LoginView inline form with email + password + submit → Task 5.
   - LoginView `?session=expired` banner → Task 5.
   - LoginView `?redirect=...` query honored on success → Task 5.
   - Router `/login` route + guard → Task 6.
   - Guard allows `logging-in` through → Task 6 (no redirect for `logging-in`).
   - Guard redirects `idle`/`error` to `/login?redirect=...` → Task 6.
   - `RootView` shows "Memverifikasi login…" during `logging-in` → Task 7.
   - `DisplayPage` uses `awaitAuthenticated()` instead of sync `getToken()` → Task 8.
   - DisplayPage error message "Sesi berakhir. Silakan login ulang." → Task 8.
   - `VITE_BILREG_TOKEN` removed from `.env.example`, `env.d.ts`, `README.md` → Task 9.
   - Token storage decision (in-memory only) → Task 1 + Task 2 test (no `aq.display.authToken`).
   - All `pnpm test` and `pnpm typecheck` pass → Task 11.

2. **Placeholder scan:** No TBD/TODO/"implement later". Every step has the code or command it requires. Storage key constants and types are spelled out explicitly. Test code is complete in every step.

3. **Type consistency:** `AutoLoginPhase` is the same shape in Tasks 1, 2, 5 (all use the same discriminated union). `LoginImpl` type is identical in Tasks 1, 2, 4 (same signature). `AutoLoginAuthTokenProvider` class name and method signatures (`getToken`, `awaitAuthenticated`, `login`, `logout`, `destroy`) are consistent across Tasks 1, 2, 4, 5, 8. The `getAuthTokenProvider()` return type narrows from `IAuthTokenProvider` to `AutoLoginAuthTokenProvider` only in Task 4 (and consumers in Tasks 5, 7, 8 use the narrowed type implicitly). Storage key `aq.display.credentials` is constant `CRED_KEY` in Task 1 and matches the test assertions in Task 2.
