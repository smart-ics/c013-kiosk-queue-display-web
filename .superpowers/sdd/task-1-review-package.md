packages/auth/package.json                         |   3 +
 .../__tests__/autoLoginAuthTokenProvider.spec.ts   |  93 +++++++++
 packages/auth/src/autoLoginAuthTokenProvider.ts    | 229 +++++++++++++++++++++
 3 files changed, 325 insertions(+)

diff --git a/packages/auth/package.json b/packages/auth/package.json
index b2e1ad3..e97453b 100644
--- a/packages/auth/package.json
+++ b/packages/auth/package.json
@@ -8,16 +8,19 @@
       "types": "./src/index.ts",
       "import": "./src/index.ts"
     }
   },
   "scripts": {
     "build": "tsc -p tsconfig.json --noEmit",
     "typecheck": "tsc -p tsconfig.json --noEmit",
     "test": "vitest run",
     "lint": "echo \"no lint yet\""
   },
+  "dependencies": {
+    "vue": "^3.5.0"
+  },
   "devDependencies": {
     "jsdom": "^26.1.0",
     "typescript": "~5.9.0",
     "vitest": "^3.2.4"
   }
 }
diff --git a/packages/auth/src/__tests__/autoLoginAuthTokenProvider.spec.ts b/packages/auth/src/__tests__/autoLoginAuthTokenProvider.spec.ts
new file mode 100644
index 0000000..8036f7d
--- /dev/null
+++ b/packages/auth/src/__tests__/autoLoginAuthTokenProvider.spec.ts
@@ -0,0 +1,93 @@
+import { afterEach, describe, expect, it, vi } from 'vitest'
+import {
+  AutoLoginAuthTokenProvider,
+  type LoginImpl,
+  type AutoLoginAuthTokenProviderOptions,
+} from '../autoLoginAuthTokenProvider'
+
+function createMemoryStorage(): Storage {
+  const map = new Map<string, string>()
+  return {
+    get length() { return map.size },
+    clear() { map.clear() },
+    getItem(key) { return map.get(key) ?? null },
+    key(i) { return Array.from(map.keys())[i] ?? null },
+    removeItem(key) { map.delete(key) },
+    setItem(key, value) { map.set(key, value) },
+  }
+}
+
+function createOkLogin(
+  token = 'jwt.token.value',
+  expiredDate: string | undefined = new Date('2026-07-25T11:00:00.000Z').toISOString(),
+): LoginImpl {
+  return vi.fn(async (_apiBase, _creds) => ({
+    pegId: 'PEG1',
+    userName: 'Display User',
+    userLogin: 'display',
+    email: 'display@example.com',
+    expiredDate,
+    tokenAuth: token,
+    listRole: [],
+  }))
+}
+
+function flushMicrotasks(): Promise<void> {
+  return new Promise(resolve => setTimeout(resolve, 0))
+}
+
+function createOptions(
+  overrides: Partial<AutoLoginAuthTokenProviderOptions> = {},
+): AutoLoginAuthTokenProviderOptions {
+  return {
+    apiBase: 'http://localhost:5000/api',
+    loginImpl: createOkLogin(),
+    storage: createMemoryStorage(),
+    clock: () => new Date('2026-07-25T10:00:00.000Z'),
+    ...overrides,
+  }
+}
+
+describe('AutoLoginAuthTokenProvider', () => {
+  let providers: AutoLoginAuthTokenProvider[] = []
+
+  afterEach(() => {
+    for (const p of providers) p.destroy()
+    providers = []
+  })
+
+  function create(options: Partial<AutoLoginAuthTokenProviderOptions> = {}) {
+    const p = new AutoLoginAuthTokenProvider(createOptions(options))
+    providers.push(p)
+    return p
+  }
+
+  describe('constructor', () => {
+    it('starts in idle phase when no credentials are stored', () => {
+      const provider = create()
+      expect(provider.phase.value).toEqual({ kind: 'idle' })
+      expect(provider.getToken()).toBeNull()
+    })
+
+    it('attempts silent login when credentials are stored', async () => {
+      const storage = createMemoryStorage()
+      storage.setItem(
+        'aq.display.credentials',
+        JSON.stringify({ email: 'a@b.c', pass: 'pw' }),
+      )
+      const provider = create({ storage, loginImpl: createOkLogin('jwt.from.silent') })
+      await vi.waitFor(() => {
+        expect(provider.phase.value).toMatchObject({ kind: 'authenticated' })
+      })
+      expect(provider.getToken()).toBe('jwt.from.silent')
+    })
+
+    it('treats corrupted credential JSON as idle without throwing', () => {
+      const storage = createMemoryStorage()
+      storage.setItem('aq.display.credentials', 'not json')
+      const provider = create({ storage })
+      expect(provider.phase.value).toEqual({ kind: 'idle' })
+      expect(storage.getItem('aq.display.credentials')).toBeNull()
+    })
+  })
+})
diff --git a/packages/auth/src/autoLoginAuthTokenProvider.ts b/packages/auth/src/autoLoginAuthTokenProvider.ts
new file mode 100644
index 0000000..20f169c
--- /dev/null
+++ b/packages/auth/src/autoLoginAuthTokenProvider.ts
@@ -0,0 +1,229 @@
+import { ref, type Ref } from 'vue'
+import type { IAuthTokenProvider } from './index'
+import type { LoginResponse } from '@aq/shared-types'
+
+export type AutoLoginPhase =
+  | { kind: 'idle' }
+  | { kind: 'logging-in' }
+  | { kind: 'authenticated'; token: string; expiredAt: string }
+  | { kind: 'error'; message: string }
+
+export type LoginImpl = (
+  apiBase: string,
+  credentials: { email: string; pass: string },
+) => Promise<LoginResponse>
+
+export interface AutoLoginAuthTokenProviderOptions {
+  apiBase: string
+  loginImpl: LoginImpl
+  storage?: Storage
+  clock?: () => Date
+  defaultLifetimeMs?: number
+  expirySkewMs?: number
+}
+
+const CRED_KEY = 'aq.display.credentials'
+
+type StoredCredentials = { email: string; pass: string }
+
+export class AutoLoginAuthTokenProvider implements IAuthTokenProvider {
+  readonly phase: Ref<AutoLoginPhase>
+  private readonly apiBase: string
+  private readonly loginImpl: LoginImpl
+  private readonly storage: Storage
+  private readonly clock: () => Date
+  private readonly defaultLifetimeMs: number
+  private readonly expirySkewMs: number
+  private inFlight: Promise<void> | null = null
+  private readonly handleStorageEvent = (event: StorageEvent) => {
+    if (event.key !== null && event.key !== CRED_KEY) return
+    if (!this.readCredentials()) {
+      this.phase.value = { kind: 'idle' }
+    } else if (this.phase.value.kind === 'idle') {
+      const credentials = this.readCredentials()!
+      void this.silentLogin(credentials.email, credentials.pass)
+    }
+  }
+
+  constructor(options: AutoLoginAuthTokenProviderOptions) {
+    this.apiBase = options.apiBase
+    this.loginImpl = options.loginImpl
+    this.storage = options.storage ?? safeLocalStorage()
+    this.clock = options.clock ?? (() => new Date())
+    this.defaultLifetimeMs = options.defaultLifetimeMs ?? 60 * 60_000
+    this.expirySkewMs = options.expirySkewMs ?? 5 * 60_000
+    this.phase = ref<AutoLoginPhase>({ kind: 'idle' })
+
+    const credentials = this.readCredentials()
+    if (credentials) {
+      void this.silentLogin(credentials.email, credentials.pass)
+    }
+
+    if (typeof window !== 'undefined') {
+      window.addEventListener('storage', this.handleStorageEvent)
+    }
+  }
+
+  getToken(): string | null {
+    const current = this.phase.value
+    if (current.kind !== 'authenticated') return null
+    if (this.isExpired(current.expiredAt)) {
+      const credentials = this.readCredentials()
+      if (credentials) {
+        void this.silentLogin(credentials.email, credentials.pass)
+      } else {
+        this.phase.value = { kind: 'idle' }
+      }
+      return null
+    }
+    return current.token
+  }
+
+  async awaitAuthenticated(): Promise<void> {
+    const current = this.phase.value
+    if (current.kind === 'authenticated' && !this.isExpired(current.expiredAt)) {
+      return
+    }
+    if (this.inFlight) {
+      await this.inFlight
+      const after = this.phase.value
+      if (after.kind === 'authenticated') return
+      const { MissingAuthTokenError } = await import('./index')
+      throw new MissingAuthTokenError(
+        after.kind === 'error' ? after.message : undefined,
+      )
+    }
+    const { MissingAuthTokenError } = await import('./index')
+    throw new MissingAuthTokenError(
+      current.kind === 'error' ? current.message : undefined,
+    )
+  }
+
+  async login(email: string, pass: string): Promise<void> {
+    if (this.inFlight) return this.inFlight
+    this.phase.value = { kind: 'logging-in' }
+    this.inFlight = this.doLogin(email, pass, /* clearOnAuthFail */ true)
+    try {
+      await this.inFlight
+    } finally {
+      this.inFlight = null
+    }
+  }
+
+  logout(): void {
+    try { this.storage.removeItem(CRED_KEY) } catch {}
+    this.phase.value = { kind: 'idle' }
+  }
+
+  destroy(): void {
+    if (typeof window !== 'undefined') {
+      window.removeEventListener('storage', this.handleStorageEvent)
+    }
+  }
+
+  private async silentLogin(email: string, pass: string): Promise<void> {
+    if (this.inFlight) return this.inFlight
+    this.phase.value = { kind: 'logging-in' }
+    this.inFlight = this.doLogin(email, pass, /* clearOnAuthFail */ false)
+    try {
+      await this.inFlight
+    } finally {
+      this.inFlight = null
+    }
+  }
+
+  private async doLogin(
+    email: string,
+    pass: string,
+    clearOnAuthFail: boolean,
+  ): Promise<void> {
+    try {
+      const response = await this.loginImpl(this.apiBase, { email, pass })
+      const expiredAt = this.computeExpiredAt(response.expiredDate)
+      this.writeCredentials({ email, pass })
+      this.phase.value = {
+        kind: 'authenticated',
+        token: response.tokenAuth,
+        expiredAt,
+      }
+    } catch (error) {
+      const message = this.toMessage(error)
+      if (clearOnAuthFail) {
+        try { this.storage.removeItem(CRED_KEY) } catch {}
+      }
+      this.phase.value = { kind: 'error', message }
+    }
+  }
+
+  private isExpired(expiredAt: string): boolean {
+    const exp = Date.parse(expiredAt)
+    if (Number.isNaN(exp)) return true
+    return this.clock().getTime() + this.expirySkewMs >= exp
+  }
+
+  private computeExpiredAt(serverExpiredDate: string | undefined): string {
+    if (serverExpiredDate) {
+      const parsed = Date.parse(serverExpiredDate)
+      if (!Number.isNaN(parsed)) return new Date(parsed).toISOString()
+    }
+    return new Date(this.clock().getTime() + this.defaultLifetimeMs).toISOString()
+  }
+
+  private toMessage(error: unknown): string {
+    if (error && typeof error === 'object' && 'statusCode' in error) {
+      const status = (error as { statusCode: number }).statusCode
+      if (status === 401) return 'Email atau password salah.'
+      if (status === 403) return 'Akun tidak punya akses.'
+      if (status >= 500) return 'Server sedang gangguan. Coba lagi.'
+      if (status === 0) return 'Tidak dapat menghubungi server.'
+    }
+    if (error instanceof Error) return error.message
+    return 'Login gagal.'
+  }
+
+  private readCredentials(): StoredCredentials | null {
+    try {
+      const raw = this.storage.getItem(CRED_KEY)
+      if (!raw) return null
+      const parsed = JSON.parse(raw) as StoredCredentials
+      if (typeof parsed.email === 'string' && typeof parsed.pass === 'string') {
+        return parsed
+      }
+      this.storage.removeItem(CRED_KEY)
+      return null
+    } catch {
+      try { this.storage.removeItem(CRED_KEY) } catch {}
+      return null
+    }
+  }
+
+  private writeCredentials(credentials: StoredCredentials): void {
+    try {
+      this.storage.setItem(CRED_KEY, JSON.stringify(credentials))
+    } catch {}
+  }
+}
+
+function safeLocalStorage(): Storage {
+  try {
+    if (typeof window !== 'undefined' && window.localStorage) {
+      const probe = '__aq_probe__'
+      window.localStorage.setItem(probe, probe)
+      window.localStorage.removeItem(probe)
+      return window.localStorage
+    }
+  } catch {}
+  return memoryStorage()
+}
+
+function memoryStorage(): Storage {
+  const map = new Map<string, string>()
+  return {
+    get length() { return map.size },
+    clear() { map.clear() },
+    getItem(key) { return map.get(key) ?? null },
+    key(i) { return Array.from(map.keys())[i] ?? null },
+    removeItem(key) { map.delete(key) },
+    setItem(key, value) { map.set(key, value) },
+  }
+}

--- Changes ---

packages/auth/package.json
  @@ -8,16 +8,19 @@
  +  "dependencies": {
  +    "vue": "^3.5.0"
  +  },
     "devDependencies": {
       "jsdom": "^26.1.0",
       "typescript": "~5.9.0",
       "vitest": "^3.2.4"
     }
   }
  +3 -0

packages/auth/src/__tests__/autoLoginAuthTokenProvider.spec.ts
  @@ -0,0 +1,93 @@
  +import { afterEach, describe, expect, it, vi } from 'vitest'
  +import {
  +  AutoLoginAuthTokenProvider,
  +  type LoginImpl,
  +  type AutoLoginAuthTokenProviderOptions,
  +} from '../autoLoginAuthTokenProvider'
  +
  +function createMemoryStorage(): Storage {
  +  const map = new Map<string, string>()
  +  return {
  +    get length() { return map.size },
  +    clear() { map.clear() },
  +    getItem(key) { return map.get(key) ?? null },
  +    key(i) { return Array.from(map.keys())[i] ?? null },
  +    removeItem(key) { map.delete(key) },
  +    setItem(key, value) { map.set(key, value) },
  +  }
  +}
  +
  +function createOkLogin(
  +  token = 'jwt.token.value',
  +  expiredDate: string | undefined = new Date('2026-07-25T11:00:00.000Z').toISOString(),
  +): LoginImpl {
  +  return vi.fn(async (_apiBase, _creds) => ({
  +    pegId: 'PEG1',
  +    userName: 'Display User',
  +    userLogin: 'display',
  +    email: 'display@example.com',
  +    expiredDate,
  +    tokenAuth: token,
  +    listRole: [],
  +  }))
  +}
  +
  +function flushMicrotasks(): Promise<void> {
  +  return new Promise(resolve => setTimeout(resolve, 0))
  +}
  +
  +function createOptions(
  +  overrides: Partial<AutoLoginAuthTokenProviderOptions> = {},
  +): AutoLoginAuthTokenProviderOptions {
  +  return {
  +    apiBase: 'http://localhost:5000/api',
  +    loginImpl: createOkLogin(),
  +    storage: createMemoryStorage(),
  +    clock: () => new Date('2026-07-25T10:00:00.000Z'),
  +    ...overrides,
  +  }
  +}
  +
  +describe('AutoLoginAuthTokenProvider', () => {
  +  let providers: AutoLoginAuthTokenProvider[] = []
  +
  +  afterEach(() => {
  +    for (const p of providers) p.destroy()
  +    providers = []
  +  })
  +
  +  function create(options: Partial<AutoLoginAuthTokenProviderOptions> = {}) {
  +    const p = new AutoLoginAuthTokenProvider(createOptions(options))
  +    providers.push(p)
  +    return p
  +  }
  +
  +  describe('constructor', () => {
  +    it('starts in idle phase when no credentials are stored', () => {
  +      const provider = create()
  +      expect(provider.phase.value).toEqual({ kind: 'idle' })
  +      expect(provider.getToken()).toBeNull()
  +    })
  +
  +    it('attempts silent login when credentials are stored', async () => {
  +      const storage = createMemoryStorage()
  +      storage.setItem(
  +        'aq.display.credentials',
  +        JSON.stringify({ email: 'a@b.c', pass: 'pw' }),
  +      )
  +      const provider = create({ storage, loginImpl: createOkLogin('jwt.from.silent') })
  +      await vi.waitFor(() => {
  +        expect(provider.phase.value).toMatchObject({ kind: 'authenticated' })
  +      })
  +      expect(provider.getToken()).toBe('jwt.from.silent')
  +    })
  +
  +    it('treats corrupted credential JSON as idle without throwing', () => {
  +      const storage = createMemoryStorage()
  +      storage.setItem('aq.display.credentials', 'not json')
  +      const provider = create({ storage })
  +      expect(provider.phase.value).toEqual({ kind: 'idle' })
  +      expect(storage.getItem('aq.display.credentials')).toBeNull()
  +    })
  +  })
  +})
  +93 -0

packages/auth/src/autoLoginAuthTokenProvider.ts
  @@ -0,0 +1,229 @@
  +import { ref, type Ref } from 'vue'
  +import type { IAuthTokenProvider } from './index'
  +import type { LoginResponse } from '@aq/shared-types'
  +
  +export type AutoLoginPhase =
  +  | { kind: 'idle' }
  +  | { kind: 'logging-in' }
  +  | { kind: 'authenticated'; token: string; expiredAt: string }
  +  | { kind: 'error'; message: string }
  +
  +export type LoginImpl = (
  +  apiBase: string,
  +  credentials: { email: string; pass: string },
  +) => Promise<LoginResponse>
  +
  +export interface AutoLoginAuthTokenProviderOptions {
  +  apiBase: string
  +  loginImpl: LoginImpl
  +  storage?: Storage
  +  clock?: () => Date
  +  defaultLifetimeMs?: number
  +  expirySkewMs?: number
  +}
  +
  +const CRED_KEY = 'aq.display.credentials'
  +
  +type StoredCredentials = { email: string; pass: string }
  +
  +export class AutoLoginAuthTokenProvider implements IAuthTokenProvider {
  +  readonly phase: Ref<AutoLoginPhase>
  +  private readonly apiBase: string
  +  private readonly loginImpl: LoginImpl
  +  private readonly storage: Storage
  +  private readonly clock: () => Date
  +  private readonly defaultLifetimeMs: number
  +  private readonly expirySkewMs: number
  +  private inFlight: Promise<void> | null = null
  +  private readonly handleStorageEvent = (event: StorageEvent) => {
  +    if (event.key !== null && event.key !== CRED_KEY) return
  +    if (!this.readCredentials()) {
  +      this.phase.value = { kind: 'idle' }
  +    } else if (this.phase.value.kind === 'idle') {
  +      const credentials = this.readCredentials()!
  +      void this.silentLogin(credentials.email, credentials.pass)
  +    }
  +  }
  +
  +  constructor(options: AutoLoginAuthTokenProviderOptions) {
  +    this.apiBase = options.apiBase
  +    this.loginImpl = options.loginImpl
  +    this.storage = options.storage ?? safeLocalStorage()
  +    this.clock = options.clock ?? (() => new Date())
  +    this.defaultLifetimeMs = options.defaultLifetimeMs ?? 60 * 60_000
  +    this.expirySkewMs = options.expirySkewMs ?? 5 * 60_000
  +    this.phase = ref<AutoLoginPhase>({ kind: 'idle' })
  +
  +    const credentials = this.readCredentials()
  +    if (credentials) {
  +      void this.silentLogin(credentials.email, credentials.pass)
  +    }
  +
  +    if (typeof window !== 'undefined') {
  +      window.addEventListener('storage', this.handleStorageEvent)
  +    }
  +  }
  +
  +  getToken(): string | null {
  +    const current = this.phase.value
  +    if (current.kind !== 'authenticated') return null
  +    if (this.isExpired(current.expiredAt)) {
  +      const credentials = this.readCredentials()
  +      if (credentials) {
  +        void this.silentLogin(credentials.email, credentials.pass)
  +      } else {
  +        this.phase.value = { kind: 'idle' }
  +      }
  +      return null
  +    }
  +    return current.token
  +  }
  +
  +  async awaitAuthenticated(): Promise<void> {
  +    const current = this.phase.value
  +    if (current.kind === 'authenticated' && !this.isExpired(current.expiredAt)) {
  +      return
  +    }
  +    if (this.inFlight) {
  +      await this.inFlight
  +      const after = this.phase.value
  +      if (after.kind === 'authenticated') return
  +      const { MissingAuthTokenError } = await import('./index')
  +      throw new MissingAuthTokenError(
  +        after.kind === 'error' ? after.message : undefined,
  +      )
  +    }
  +    const { MissingAuthTokenError } = await import('./index')
  +    throw new MissingAuthTokenError(
  +      current.kind === 'error' ? current.message : undefined,
  +    )
  +  }
  ... (129 lines truncated)
  +229 -0
[full diff: rtk git diff --no-compact]
