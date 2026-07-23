import { ref, type Ref } from 'vue'
import type { AdmissionQueueIntakeResponse, AdmissionServicePoint } from '@aq/shared-types'
import { createPrintProxyClient, type PrintProxyClient } from '../lib/printProxy'
import { renderQueueTicketPng } from '../lib/queueTicket'

export type UseKioskPrintOptions = {
  stationId: Ref<string>
  result: Ref<AdmissionQueueIntakeResponse | null>
  offerings: Ref<AdmissionServicePoint[]>
  printerProxyPort?: Ref<number | undefined>
  createClient?: (port?: number) => PrintProxyClient
  renderTicket?: typeof renderQueueTicketPng
}

export function useKioskPrint(options: UseKioskPrintOptions) {
  const printPending = ref(false)
  const printError = ref<string | null>(null)
  const printSucceeded = ref(false)
  const lastPrintedLabel = ref<string | null>(null)

  const createClient =
    options.createClient ?? ((port?: number) => createPrintProxyClient({ port }))
  const renderTicket = options.renderTicket ?? renderQueueTicketPng

  function resolveServicePointName(servicePointId?: string): string | undefined {
    if (!servicePointId) return undefined
    return options.offerings.value.find((sp) => sp.servicePointId === servicePointId)?.displayName
  }

  async function printCommittedLabel(servicePointId?: string): Promise<boolean> {
    const intake = options.result.value
    if (!intake?.queueLabel) {
      printError.value = 'Tidak ada Queue Label untuk dicetak.'
      return false
    }
    if (printPending.value) return false

    printPending.value = true
    printError.value = null
    try {
      const client = createClient(options.printerProxyPort?.value)
      const healthError = await client.checkHealth()
      if (healthError) {
        printError.value = healthError
        printSucceeded.value = false
        return false
      }

      const blob = await renderTicket({
        queueLabel: intake.queueLabel,
        servicePointName: resolveServicePointName(servicePointId),
        stationId: options.stationId.value,
      })

      const proxyResult = await client.printPng(blob)
      if (!proxyResult.success) {
        printError.value = proxyResult.error ?? 'Cetak gagal'
        printSucceeded.value = false
        return false
      }

      lastPrintedLabel.value = intake.queueLabel
      printSucceeded.value = true
      return true
    } catch (error) {
      printError.value = error instanceof Error ? error.message : 'Cetak gagal'
      printSucceeded.value = false
      return false
    } finally {
      printPending.value = false
    }
  }

  function resetPrintState() {
    printPending.value = false
    printError.value = null
    printSucceeded.value = false
    lastPrintedLabel.value = null
  }

  return {
    printPending,
    printError,
    printSucceeded,
    lastPrintedLabel,
    printCommittedLabel,
    resetPrintState,
  }
}
