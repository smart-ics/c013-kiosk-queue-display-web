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
