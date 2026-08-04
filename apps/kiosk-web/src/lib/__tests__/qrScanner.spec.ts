import { describe, expect, it } from 'vitest'
import { scanQrFromCamera } from '../qrScanner'

describe('scanQrFromCamera', () => {
  it('returns a clear error when BarcodeDetector is unsupported', async () => {
    const result = await scanQrFromCamera()
    expect('error' in result).toBe(true)
  })
})
