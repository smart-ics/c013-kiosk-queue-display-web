import { ref, type Ref } from 'vue'
import type { AdmissionQueueIntakeResponse, ReturnCreateWalkIn } from '@aq/shared-types'
import { createPrintProxyClient, type PrintProxyClient } from '../lib/printProxy'
import { renderQueueTicketPng } from '../lib/queueTicket'
import { renderRegistrationReceiptPng } from '../lib/registrationReceipt'
import { brandingService } from '../lib/branding'
import { generateQrDataUrl } from '../lib/qrCode'

export type RegistrationPrintResult = { printed: boolean; error?: string }

export type RegistrationPrintContext = {
  result: ReturnCreateWalkIn
  pasienName: string
  serviceName?: string
  dokterName?: string
  pasienId?: string
  tglLahir?: string
  umur?: string
  tipeJaminanName?: string
  noSep?: string
}

export type UseKioskSelfPrintOptions = {
  stationId: Ref<string>
  printerProxyPort?: Ref<number | undefined>
  createClient?: (port?: number) => PrintProxyClient
  renderRegistration?: typeof renderRegistrationReceiptPng
  renderTicket?: typeof renderQueueTicketPng
}

async function tryGenerateQrDataUrl(text: string): Promise<string> {
  try {
    return await generateQrDataUrl(text)
  } catch {
    return ''
  }
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
    if (printPending.value) {
      printError.value = 'Cetak sedang berlangsung.'
      return { printed: false, error: 'Cetak sedang berlangsung.' }
    }
    printPending.value = true
    printError.value = null
    try {
      const client = createClient(options.printerProxyPort?.value)
      const now = new Date()
      const branding = brandingService.getBranding()
      const blob = await renderRegistration({
        noAntrian: ctx.result.noAntrian,
        regId: ctx.result.regId,
        pasienName: ctx.pasienName,
        pasienId: ctx.pasienId,
        tglLahir: ctx.tglLahir,
        umur: ctx.umur,
        tipeJaminanName: ctx.tipeJaminanName,
        noSep: ctx.noSep,
        serviceName: ctx.serviceName,
        dokterName: ctx.dokterName,
        qrCodeReg: await tryGenerateQrDataUrl(ctx.result.regId),
        rsName: branding.name,
        rsAddress: branding.address,
        rsPhone: branding.phone,
        regDate: now.toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }),
        jamReg: now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        printedAt: now.toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }),
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

  async function printQueueTicket(
    ticket: AdmissionQueueIntakeResponse,
    servicePointName?: string,
  ): Promise<RegistrationPrintResult> {
    if (!ticket.queueLabel) {
      printError.value = 'Tidak ada nomor antrian untuk dicetak.'
      printSucceeded.value = false
      return { printed: false, error: printError.value }
    }
    if (printPending.value) {
      printError.value = 'Cetak sedang berlangsung.'
      return { printed: false, error: 'Cetak sedang berlangsung.' }
    }
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
