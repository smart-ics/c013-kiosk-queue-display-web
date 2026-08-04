import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderRegistrationReceiptPng } from '../registrationReceipt'

describe('renderRegistrationReceiptPng', () => {
  const ctx = {
    fillStyle: '',
    textAlign: '',
    font: '',
    fillRect: vi.fn(),
    fillText: vi.fn(),
  }

  beforeEach(() => {
    ctx.fillRect.mockClear()
    ctx.fillText.mockClear()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      ctx as unknown as CanvasRenderingContext2D,
    )
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
      this: HTMLCanvasElement,
      callback: BlobCallback,
    ) {
      callback(new Blob(['png'], { type: 'image/png' }))
    })
  })

  it('renders a PNG blob with receipt fields', async () => {
    const blob = await renderRegistrationReceiptPng({
      noAntrian: 7,
      regId: 'R1',
      pasienName: 'Andi',
      serviceName: 'Poli Jantung',
      stationId: 'K01',
    })
    expect(blob.type).toBe('image/png')
    expect(ctx.fillText).toHaveBeenCalled()
  })
})
