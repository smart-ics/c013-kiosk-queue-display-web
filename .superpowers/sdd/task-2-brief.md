### Task 2: Add comprehensive unit tests for `AutoLoginAuthTokenProvider`

**Files:**
- Modify: `packages/auth/src/__tests__/autoLoginAuthTokenProvider.spec.ts`

**Interfaces:**
- Consumes: class from Task 1 (`AutoLoginAuthTokenProvider`, `LoginImpl`, `AutoLoginAuthTokenProviderOptions`).
- Produces: tests covering login/logout/getToken/awaitAuthenticated/expiry/cross-tab.

- [ ] **Step 1: Add tests for `login()`, `getToken()`, expiry, logout, error, concurrent, and cross-tab**

Append to the existing `describe('AutoLoginAuthTokenProvider', ...)` block in the test file. Insert the new `describe` blocks after the existing `describe('constructor', ...)` block:

```ts
  describe('login()', () => {
    it('transitions idle → logging-in → authenticated on success', async () => {
      const storage = createMemoryStorage()
      const provider = create({ storage })
      const phases: string[] = []

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
      await vi.waitFor(() => {
        expect(provider.phase.value.kind).toBe('logging-in')
      })
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
      await vi.waitFor(() => {
        expect(stale.phase.value).toMatchObject({ kind: 'authenticated' })
      })
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
Expected: PASS (pre-existing `@aq/shared-types` error is pre-existing, not from this change).

- [ ] **Step 4: Commit**

```bash
git add packages/auth/src/__tests__/autoLoginAuthTokenProvider.spec.ts
git commit -m "test(auth): cover AutoLoginAuthTokenProvider"
```
