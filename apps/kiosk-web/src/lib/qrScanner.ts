export type QrScanResult = { detected: string } | { error: string }

type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => {
  detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]>
}

const MAX_ATTEMPTS = 50
const ATTEMPT_DELAY_MS = 200

export async function scanQrFromCamera(): Promise<QrScanResult> {
  const DetectorCtor = (
    window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }
  ).BarcodeDetector
  if (!DetectorCtor) {
    return { error: 'Pemindai QR tidak didukung oleh browser ini.' }
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    return { error: 'Kamera tidak tersedia pada perangkat ini.' }
  }
  try {
    const detector = new DetectorCtor({ formats: ['qr_code'] })
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' },
    })
    const video = document.createElement('video')
    video.srcObject = stream
    video.setAttribute('muted', 'true')
    video.setAttribute('playsinline', 'true')
    await video.play()
    try {
      for (let i = 0; i < MAX_ATTEMPTS; i++) {
        const codes = await detector.detect(video)
        if (codes.length > 0) {
          return { detected: codes[0].rawValue }
        }
        await new Promise((resolve) => setTimeout(resolve, ATTEMPT_DELAY_MS))
      }
      return { error: 'Tidak ada QR terdeteksi. Silakan coba lagi.' }
    } finally {
      stream.getTracks().forEach((track) => track.stop())
      video.srcObject = null
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Pemindaian QR gagal.' }
  }
}
