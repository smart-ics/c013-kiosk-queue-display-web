import { ApiClientError } from '@aq/api-client'

export type BiometricVerdict =
  | { outcome: 'READY' }
  | { outcome: 'SUCCESS' }
  | { outcome: 'FAILED' | 'CANCELLED' | 'TIMEOUT' }

export type BiometricClientOptions = {
  port?: number
  timeoutMs?: number
  fetchImpl?: typeof fetch
}

const DEFAULT_PORT = 5050
const DEFAULT_TIMEOUT_MS = 30_000

export function resolveBiometricBaseUrl(port?: number): string {
  const resolved = port && port > 0 ? port : DEFAULT_PORT
  return `http://localhost:${resolved}/biometrik`
}

const VERDICT_OUTCOMES = ['READY', 'SUCCESS', 'FAILED', 'CANCELLED', 'TIMEOUT'] as const

export function createBiometricClient(options: BiometricClientOptions = {}) {
  const baseUrl = resolveBiometricBaseUrl(options.port)
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const fetchImpl = options.fetchImpl ?? fetch.bind(globalThis)

  async function verify(): Promise<BiometricVerdict> {
    let response: Response
    try {
      response = await fetchImpl(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
        signal: AbortSignal.timeout(timeoutMs),
      })
    } catch (error) {
      throw new ApiClientError(
        error instanceof Error ? error.message : 'Biometric request failed',
        0,
      )
    }
    const body = (await response.json().catch(() => null)) as { outcome?: string } | null
    if (
      response.ok &&
      body &&
      VERDICT_OUTCOMES.includes(body.outcome as (typeof VERDICT_OUTCOMES)[number])
    ) {
      return { outcome: body.outcome } as BiometricVerdict
    }
    throw new ApiClientError(
      body?.outcome ?? `Biometric request failed with status ${response.status}`,
      response.status,
    )
  }

  return { baseUrl, verify }
}

export type BiometricClient = ReturnType<typeof createBiometricClient>
