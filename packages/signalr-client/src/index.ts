export type RefreshHint = {
  loketKey: string | null
}

export type QueueConnectionHandlers = {
  onRefreshHint: (hint: RefreshHint) => void
}

export type QueueConnection = {
  start: () => Promise<void>
  stop: () => Promise<void>
}

/**
 * Stub for C3.1 — reconnect + snapshot-first RefreshHint wiring.
 * Do not use for production display until implemented.
 */
export function createQueueConnection(
  _hubUrl: string,
  _handlers: QueueConnectionHandlers,
): QueueConnection {
  return {
    async start() {
      throw new Error('@aq/signalr-client createQueueConnection is not implemented (C3.1)')
    },
    async stop() {
      /* no-op stub */
    },
  }
}
