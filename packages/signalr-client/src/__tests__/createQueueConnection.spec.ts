import { describe, expect, it, vi } from 'vitest'
import { createQueueConnection, type QueueConnectionHandlers } from '../index'

type FakeHub = {
  state: string
  on: ReturnType<typeof vi.fn>
  onreconnecting: ReturnType<typeof vi.fn>
  onreconnected: ReturnType<typeof vi.fn>
  onclose: ReturnType<typeof vi.fn>
  start: ReturnType<typeof vi.fn>
  stop: ReturnType<typeof vi.fn>
  handlers: Record<string, (payload?: unknown) => void>
  reconnectCb?: () => void
}

function createFakeHub(): FakeHub {
  const handlers: Record<string, (payload?: unknown) => void> = {}
  const hub: FakeHub = {
    state: 'Disconnected',
    handlers,
    on: vi.fn((event: string, cb: (payload?: unknown) => void) => {
      handlers[event] = cb
    }),
    onreconnecting: vi.fn((cb: () => void) => {
      handlers.__reconnecting = cb
    }),
    onreconnected: vi.fn((cb: () => void) => {
      hub.reconnectCb = cb
      handlers.__reconnected = cb
    }),
    onclose: vi.fn((cb: () => void) => {
      handlers.__close = cb
    }),
    start: vi.fn(async () => {
      hub.state = 'Connected'
    }),
    stop: vi.fn(async () => {
      hub.state = 'Disconnected'
    }),
  }
  return hub
}

describe('createQueueConnection', () => {
  it('forwards RefreshHint payloads', async () => {
    const fake = createFakeHub()
    const onRefreshHint = vi.fn()
    const connection = createQueueConnection('http://localhost/hubs/admission-queue', {
      accessTokenFactory: () => 'token',
      onRefreshHint,
      createHubConnection: () => fake as never,
    })

    await connection.start()
    fake.handlers.RefreshHint?.({ loketKey: 'L1' })
    expect(onRefreshHint).toHaveBeenCalledWith({ loketKey: 'L1' })

    fake.handlers.RefreshHint?.({ loketKey: null })
    expect(onRefreshHint).toHaveBeenCalledWith({ loketKey: null })
  })

  it('invokes onReconnected for snapshot-first recovery', async () => {
    const fake = createFakeHub()
    const onReconnected = vi.fn()
    const connection = createQueueConnection('http://localhost/hubs/admission-queue', {
      accessTokenFactory: () => 'token',
      onRefreshHint: () => undefined,
      onReconnected,
      createHubConnection: () => fake as never,
    })

    await connection.start()
    fake.reconnectCb?.()
    expect(onReconnected).toHaveBeenCalledTimes(1)
  })

  it('passes accessTokenFactory through handlers to builder factory', async () => {
    const fake = createFakeHub()
    const accessTokenFactory = vi.fn(async () => 'jwt')
    let received: QueueConnectionHandlers | undefined

    createQueueConnection('http://localhost/hubs/admission-queue', {
      accessTokenFactory,
      onRefreshHint: () => undefined,
      createHubConnection: (_url, handlers) => {
        received = handlers
        return fake as never
      },
    })

    expect(received).toBeDefined()
    await expect(received!.accessTokenFactory()).resolves.toBe('jwt')
  })
})
