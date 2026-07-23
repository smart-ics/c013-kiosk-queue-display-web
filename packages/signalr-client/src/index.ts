import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel,
} from '@microsoft/signalr'

export type RefreshHint = {
  loketKey: string | null
}

export type QueueConnectionState =
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'

export type QueueConnectionHandlers = {
  accessTokenFactory: () => string | Promise<string>
  onRefreshHint: (hint: RefreshHint) => void
  /** Invoked after automatic reconnect — caller must snapshot-first. */
  onReconnected?: () => void
  onConnectionState?: (state: QueueConnectionState) => void
}

export type QueueConnection = {
  start: () => Promise<void>
  stop: () => Promise<void>
}

export type CreateQueueConnectionOptions = QueueConnectionHandlers & {
  /** Injectable for unit tests. */
  createHubConnection?: (hubUrl: string, handlers: QueueConnectionHandlers) => HubConnection
  reconnectDelaysMs?: number[]
}

const DEFAULT_RECONNECT_DELAYS_MS = [0, 2000, 5000, 10000, 30000]

function parseRefreshHint(payload: unknown): RefreshHint {
  if (!payload || typeof payload !== 'object') {
    return { loketKey: null }
  }
  const loketKey = (payload as { loketKey?: unknown }).loketKey
  if (loketKey === null || loketKey === undefined || loketKey === '') {
    return { loketKey: null }
  }
  return { loketKey: String(loketKey) }
}

function defaultCreateHubConnection(
  hubUrl: string,
  handlers: QueueConnectionHandlers,
  reconnectDelaysMs: number[],
): HubConnection {
  return new HubConnectionBuilder()
    .withUrl(hubUrl, {
      accessTokenFactory: () => handlers.accessTokenFactory(),
    })
    .withAutomaticReconnect(reconnectDelaysMs)
    .configureLogging(LogLevel.Warning)
    .build()
}

/**
 * Hint-only SignalR wrapper for Bilreg `/hubs/admission-queue`.
 * Never treats hub payloads as display authority — callers must refetch snapshot.
 */
export function createQueueConnection(
  hubUrl: string,
  options: CreateQueueConnectionOptions,
): QueueConnection {
  const reconnectDelaysMs = options.reconnectDelaysMs ?? DEFAULT_RECONNECT_DELAYS_MS
  const handlers: QueueConnectionHandlers = {
    accessTokenFactory: options.accessTokenFactory,
    onRefreshHint: options.onRefreshHint,
    onReconnected: options.onReconnected,
    onConnectionState: options.onConnectionState,
  }

  const connection =
    options.createHubConnection?.(hubUrl, handlers) ??
    defaultCreateHubConnection(hubUrl, handlers, reconnectDelaysMs)

  const emitState = (state: QueueConnectionState) => {
    handlers.onConnectionState?.(state)
  }

  connection.on('RefreshHint', (payload: unknown) => {
    handlers.onRefreshHint(parseRefreshHint(payload))
  })

  connection.onreconnecting(() => {
    emitState('reconnecting')
  })

  connection.onreconnected(() => {
    emitState('connected')
    handlers.onReconnected?.()
  })

  connection.onclose(() => {
    emitState('disconnected')
  })

  return {
    async start() {
      if (connection.state === HubConnectionState.Connected) return
      emitState('connecting')
      await connection.start()
      emitState('connected')
    },
    async stop() {
      if (connection.state === HubConnectionState.Disconnected) return
      await connection.stop()
      emitState('disconnected')
    },
  }
}
