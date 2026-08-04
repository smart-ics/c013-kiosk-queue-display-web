import { ref, type Ref } from 'vue'
import type { AdmissionQueueIntakeResponse, ReturnCreateWalkIn } from '@aq/shared-types'
import { createPrintProxyClient, type PrintProxyClient } from '../lib/printProxy'
import { renderQueueTicketPng } from '../lib/queueTicket'
import { renderRegistrationReceiptPng } from '../lib/registrationReceipt'

export type RegistrationPrintResult = { printed: boolean; error?: string }

export type RegistrationPrintContext = {
  result: ReturnCreateWalkIn
  pasienName: string
  serviceName?: string
  dokterName?: string
}

export type UseKioskSelfPrintOptions = {
  stationId: Ref<string>
  printerProxyPort?: Ref<number | undefined>
  createClient?: (port?: number) => PrintProxyClient
  renderRegistration?: typeof renderRegistrationReceiptPng
  renderTicket?: typeof renderQueueTicketPng
}

export function useKioskSelfPrint(options: UseKioskSelfPrintOptions) {
  const printPending = ref(false)
  const printError = ref<string | null>(null)
  const printSucceeded = ref(false)

  const createClient =
    options.createClient ?? ((port?: number) => createPrintProxyClient({ port }))
  const renderRegistration = options.renderRegistration ?? renderRegistrationReceiptPng
  const renderTicket = options.renderTicket ?? renderQueueTicketPng

  async function printRegistration(
    ctx: RegistrationPrintContext,
  ): Promise<RegistrationPrintResult> {
    if (printPending.value) return { printed: false, error: 'Cetak sedang berlangsung.' }
    printPending.value = true
    printError.value = null
    try {
      const client = createClient(options.printerProxyPort?.value)
      const blob = await renderRegistration({
        noAntrian: ctx.result.noAntrian,
        regId: ctx.result.regId,
        pasienName: ctx.pasienName,
        serviceName: ctx.serviceName,
        dokterName: ctx.dokterName,
        stationId: options.stationId.value,
      })
      const proxyResult = await client.printPng(blob, 'registrasi')
      if (!proxyResult.success) {
        printError.value = proxyResult.error ?? 'Cetak gagal'
        printSucceeded.value = false
        return { printed: false, error: printError.value }
      }
      printSucceeded.value = true
      return { printed: true }
    } catch (error) {
      printError.value = error instanceof Error ? error.message : 'Cetak gagal'
      printSucceeded.value = false
      return { printed: false, error: printError.value }
    } finally {
      printPending.value = false
    }
  }

  async function printQueueTicket(
    ticket: AdmissionQueueIntakeResponse,
    servicePointName?: string,
  ): Promise<RegistrationPrintResult> {
    if (!ticket.queueLabel) {
      printError.value = 'Tidak ada nomor antrian untuk dicetak.'
      printSucceeded.value = false
      return { printed: false, error: printError.value }
    }
    if (printPending.value) return { printed: false, error: 'Cetak sedang berlangsung.' }
    printPending.value = true
    printError.value = null
    try {
      const client = createClient(options.printerProxyPort?.value)
      const blob = await renderTicket({
        queueLabel: ticket.queueLabel,
        servicePointName,
        stationId: options.stationId.value,
      })
      const proxyResult = await client.printPng(blob, 'antrian')
      if (!proxyResult.success) {
        printError.value = proxyResult.error ?? 'Cetak gagal'
        printSucceeded.value = false
        return { printed: false, error: printError.value }
      }
      printSucceeded.value = true
      return { printed: true }
    } catch (error) {
      printError.value = error instanceof Error ? error.message : 'Cetak gagal'
      printSucceeded.value = false
      return { printed: false, error: printError.value }
    } finally {
      printPending.value = false
    }
  }

  function resetPrintState() {
    printPending.value = false
    printError.value = null
    printSucceeded.value = false
  }

  return {
    printPending,
    printError,
    printSucceeded,
    printRegistration,
    printQueueTicket,
    resetPrintState,
  }
}
