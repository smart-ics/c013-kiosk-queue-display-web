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

/**
 * Interactive session token holder for config-web.
 * Tokens stay in memory only — never written to localStorage.
 */
export class SessionAuthTokenProvider implements IAuthTokenProvider {
  private token: string | null = null

  getToken(): string | null {
    return this.token
  }

  setToken(token: string | null | undefined): void {
    const value = token?.trim()
    this.token = value ? value : null
  }

  clear(): void {
    this.token = null
  }

  requireToken(): string {
    const token = this.getToken()
    if (!token) throw new MissingAuthTokenError('Session authentication token is missing')
    return token
  }
}

export function createSessionAuthTokenProvider(): SessionAuthTokenProvider {
  return new SessionAuthTokenProvider()
}
