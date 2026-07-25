import { afterEach, describe, expect, it, vi } from 'vitest'
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
  expiredDate: string | undefined = new Date('2026-07-25T11:00:00.000Z').toISOString(),
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
      await vi.waitFor(() => {
        expect(provider.phase.value).toMatchObject({ kind: 'authenticated' })
      })
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
