export type QueueTicketNotice = {
  regId: string
  instruction: string
}

export const ADMISI_FALLBACK_NOTICE_TEXT =
  'Silakan menuju Loket Admisi untuk penyelesaian berkas.'

export function formatRegistrasiFallbackHeader(regId: string): string {
  return `Berhasil Registrasi regid : ${regId}`
}

export function buildAdmisiFallbackNotice(regId: string): QueueTicketNotice {
  return { regId, instruction: ADMISI_FALLBACK_NOTICE_TEXT }
}

export type QueueTicketData = {
  queueLabel: string
  servicePointName?: string
  stationId?: string
  printedAt?: Date
  notice?: QueueTicketNotice
}

/** ~80mm thermal width at 203dpi-ish density for proxy PNG. */
const TICKET_WIDTH = 576
const TICKET_HEIGHT = 420
const NOTICE_EXTRA_HEIGHT = 150

export async function renderQueueTicketPng(data: QueueTicketData): Promise<Blob> {
  const canvas = document.createElement('canvas')
  const hasNotice = Boolean(data.notice)
  canvas.width = TICKET_WIDTH
  canvas.height = TICKET_HEIGHT + (hasNotice ? NOTICE_EXTRA_HEIGHT : 0)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context unavailable')

  const printedAt = data.printedAt ?? new Date()
  const timeLabel = printedAt.toLocaleString('id-ID', {
    dateStyle: 'short',
    timeStyle: 'medium',
  })

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, TICKET_WIDTH, canvas.height)

  ctx.fillStyle = '#000000'
  ctx.textAlign = 'center'

  ctx.font = '600 28px sans-serif'
  ctx.fillText('Nomor Antrian', TICKET_WIDTH / 2, 56)

  ctx.font = '800 120px sans-serif'
  ctx.fillText(data.queueLabel, TICKET_WIDTH / 2, 200)

  if (data.servicePointName) {
    ctx.font = '600 32px sans-serif'
    ctx.fillText(data.servicePointName, TICKET_WIDTH / 2, 270)
  }

  ctx.font = '500 24px sans-serif'
  ctx.fillText(timeLabel, TICKET_WIDTH / 2, 330)

  if (data.stationId) {
    ctx.font = '500 22px sans-serif'
    ctx.fillText(`Station ${data.stationId}`, TICKET_WIDTH / 2, 370)
  }

  if (data.notice) {
    ctx.font = '700 28px sans-serif'
    ctx.fillText(formatRegistrasiFallbackHeader(data.notice.regId), TICKET_WIDTH / 2, 425)
    ctx.font = '600 24px sans-serif'
    ctx.fillText(data.notice.instruction, TICKET_WIDTH / 2, 470)
  }

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Canvas toBlob failed'))
    }, 'image/png')
  })
}
