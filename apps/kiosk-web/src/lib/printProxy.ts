export type PrintProxyResult = {
  success: boolean
  jobId?: string
  error?: string
  isNetworkError: boolean
}

export type PrintProxyClientOptions = {
  port?: number
  timeoutMs?: number
  fetchImpl?: typeof fetch
}

const DEFAULT_PORT = 5050
const DEFAULT_TIMEOUT_MS = 30_000

export function resolvePrintProxyBaseUrl(port?: number): string {
  const resolved = port && port > 0 ? port : DEFAULT_PORT
  return `http://localhost:${resolved}/print`
}

export function createPrintProxyClient(options: PrintProxyClientOptions = {}) {
  const baseUrl = resolvePrintProxyBaseUrl(options.port)
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const fetchImpl = options.fetchImpl ?? fetch.bind(globalThis)

  async function checkHealth(): Promise<string | null> {
    // Skipped: PrintService currently doesn't have a /health endpoint.
    return null
  }

  async function printPng(blob: Blob, doctype = 'antrian', printCopies = 1): Promise<PrintProxyResult> {
    const qs = new URLSearchParams({
      type: 'image',
      doctype,
      printCopies: String(printCopies),
    })
    const url = `${baseUrl}/?${qs.toString()}`

    try {
      const response = await fetchImpl(url, {
        method: 'POST',
        headers: { 'Content-Type': 'image/png' },
        body: blob,
        signal: AbortSignal.timeout(timeoutMs),
      })

      const body = (await response.json().catch(() => null)) as {
        jobId?: string
        error?: string
      } | null

      if (response.ok) {
        return { success: true, jobId: body?.jobId, isNetworkError: false }
      }

      return {
        success: false,
        error: body?.error || `HTTP ${response.status}`,
        isNetworkError: false,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection failed',
        isNetworkError: true,
      }
    }
  }

  return {
    baseUrl,
    checkHealth,
    printPng,
  }
}

export type PrintProxyClient = ReturnType<typeof createPrintProxyClient>
