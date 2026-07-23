export type QueueTicketData = {
  queueLabel: string
  servicePointName?: string
  stationId?: string
  printedAt?: Date
}

/** ~80mm thermal width at 203dpi-ish density for proxy PNG. */
const TICKET_WIDTH = 576
const TICKET_HEIGHT = 420

export async function renderQueueTicketPng(data: QueueTicketData): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = TICKET_WIDTH
  canvas.height = TICKET_HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context unavailable')

  const printedAt = data.printedAt ?? new Date()
  const timeLabel = printedAt.toLocaleString('id-ID', {
    dateStyle: 'short',
    timeStyle: 'medium',
  })

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, TICKET_WIDTH, TICKET_HEIGHT)

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

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Canvas toBlob failed'))
    }, 'image/png')
  })
}
