import { onBeforeUnmount, watch, type Ref } from 'vue'
import { createQueueConnection, type QueueConnection } from '@aq/signalr-client'
import { shouldRefreshForHint } from '../lib/snapshot'
import { getAdmissionQueueHubUrl } from '../infrastructure'

export function useDisplaySignalR(options: {
  enabled: Ref<boolean>
  configuredLoketIds: Ref<string[]>
  onRefresh: () => void
}) {
  let connection: QueueConnection | null = null
  const connectionState = { value: 'disconnected' as string }

  async function disconnect() {
    if (!connection) return
    const current = connection
    connection = null
    await current.stop().catch(() => undefined)
  }

  async function connect() {
    await disconnect()
    connection = createQueueConnection(getAdmissionQueueHubUrl(), {
      onRefreshHint: (hint) => {
        if (!shouldRefreshForHint(hint.loketKey, options.configuredLoketIds.value)) return
        options.onRefresh()
      },
      onReconnected: () => {
        options.onRefresh()
      },
      onConnectionState: (state) => {
        connectionState.value = state
      },
    })
    try {
      await connection.start()
    } catch {
      connectionState.value = 'disconnected'
    }
  }

  watch(
    () => options.enabled.value,
    (enabled, _prev, onCleanup) => {
      if (!enabled) {
        void disconnect()
        return
      }
      void connect()
      onCleanup(() => {
        void disconnect()
      })
    },
    { immediate: true },
  )

  onBeforeUnmount(() => {
    void disconnect()
  })

  return { connectionState }
}
