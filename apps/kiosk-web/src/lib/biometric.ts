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
  return `http://localhost:${resolved}/biometric`
}

export function createBiometricClient(options: BiometricClientOptions = {}) {
  const baseUrl = resolveBiometricBaseUrl(options.port)
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const fetchImpl = options.fetchImpl ?? fetch.bind(globalThis)

  async function verify(noka: string): Promise<BiometricVerdict> {
    let response: Response
    try {
      const url = new URL(baseUrl)
      url.searchParams.set('noka', noka)

      response = await fetchImpl(url.toString(), {
        method: 'GET',
        headers: { Accept: 'text/plain, application/json' },
        signal: AbortSignal.timeout(timeoutMs),
      })
    } catch (error) {
      throw new ApiClientError(
        error instanceof Error ? error.message : 'Biometric request failed',
        0,
      )
    }

    const text = (await response.text().catch(() => '')).trim()
    if (response.ok) {
      if (text === 'OK') {
        return { outcome: 'SUCCESS' }
      }
      if (text === 'FAILED') {
        return { outcome: 'FAILED' }
      }
    }

    throw new ApiClientError(
      text || `Biometric request failed with status ${response.status}`,
      response.status,
    )
  }

  return { baseUrl, verify }
}

export type BiometricClient = ReturnType<typeof createBiometricClient>
