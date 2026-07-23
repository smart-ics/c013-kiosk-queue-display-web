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
