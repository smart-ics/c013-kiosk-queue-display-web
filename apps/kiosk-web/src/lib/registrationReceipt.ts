export type RegistrationReceiptData = {
  noAntrian: number
  regId: string
  pasienName: string
  serviceName?: string
  dokterName?: string
  stationId?: string
  printedAt?: Date
}

/** ~80mm thermal width, taller than the queue ticket to fit the summary. */
const RECEIPT_WIDTH = 576
const RECEIPT_HEIGHT = 560

export async function renderRegistrationReceiptPng(data: RegistrationReceiptData): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = RECEIPT_WIDTH
  canvas.height = RECEIPT_HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context unavailable')

  const printedAt = data.printedAt ?? new Date()
  const timeLabel = printedAt.toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'medium' })

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, RECEIPT_WIDTH, RECEIPT_HEIGHT)
  ctx.fillStyle = '#000000'
  ctx.textAlign = 'center'

  ctx.font = '600 28px sans-serif'
  ctx.fillText('Bukti Registrasi', RECEIPT_WIDTH / 2, 56)

  ctx.font = '800 96px sans-serif'
  ctx.fillText(`Antrian ${data.noAntrian}`, RECEIPT_WIDTH / 2, 190)

  ctx.font = '600 30px sans-serif'
  ctx.fillText(data.pasienName, RECEIPT_WIDTH / 2, 250)
  ctx.font = '500 24px sans-serif'
  ctx.fillText(`Reg ID ${data.regId}`, RECEIPT_WIDTH / 2, 300)
  if (data.serviceName) ctx.fillText(data.serviceName, RECEIPT_WIDTH / 2, 340)
  if (data.dokterName) ctx.fillText(data.dokterName, RECEIPT_WIDTH / 2, 380)
  ctx.fillText(timeLabel, RECEIPT_WIDTH / 2, 440)
  if (data.stationId) ctx.fillText(`Station ${data.stationId}`, RECEIPT_WIDTH / 2, 480)

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Canvas toBlob failed'))
    }, 'image/png')
  })
}
