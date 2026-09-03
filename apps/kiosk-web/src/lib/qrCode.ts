import QRCode from 'qrcode'

export type QrCodeOptions = {
  margin?: number
  width?: number
}

export async function generateQrDataUrl(
  text: string,
  options: QrCodeOptions = {},
): Promise<string> {
  const { margin = 3, width = 200 } = options
  return QRCode.toDataURL(text, { margin, width, errorCorrectionLevel: 'H' })
}
