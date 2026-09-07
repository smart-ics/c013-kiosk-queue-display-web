import { describe, expect, it } from 'vitest'
import { appConfigSchema } from './index'

describe('appConfigSchema', () => {
  it('accepts bilregApiBase without jetliApiBase', () => {
    const result = appConfigSchema.safeParse({ bilregApiBase: 'http://localhost:5000/api' })
    expect(result.success).toBe(true)
  })

  it('accepts jetliApiBase when provided', () => {
    const parsed = appConfigSchema.parse({
      bilregApiBase: 'http://localhost:5000/api',
      jetliApiBase: 'http://localhost:6000/api',
    })
    expect(parsed.jetliApiBase).toBe('http://localhost:6000/api')
  })

  it('accepts mediaInfoDir when provided', () => {
    const parsed = appConfigSchema.parse({
      bilregApiBase: 'http://localhost:5000/api',
      mediaInfoDir: 'media',
    })
    expect(parsed.mediaInfoDir).toBe('media')
  })

  it('leaves mediaInfoDir undefined when omitted', () => {
    const parsed = appConfigSchema.parse({ bilregApiBase: 'http://localhost:5000/api' })
    expect(parsed.mediaInfoDir).toBeUndefined()
  })

  it('accepts enablePatientLabelPrint boolean property', () => {
    const parsed = appConfigSchema.parse({
      bilregApiBase: 'http://localhost:5000/api',
      enablePatientLabelPrint: true,
    })
    expect(parsed.enablePatientLabelPrint).toBe(true)
  })

  it('accepts fallbackServicePoints.bookingFailure', () => {
    const parsed = appConfigSchema.parse({
      bilregApiBase: 'http://localhost:5000/api',
      fallbackServicePoints: { bookingFailure: 'SP-ADMISI' },
    })

    expect(parsed.fallbackServicePoints?.bookingFailure).toBe('SP-ADMISI')
  })

  it('normalizes an empty bookingFailure assignment to undefined', () => {
    const parsed = appConfigSchema.parse({
      bilregApiBase: 'http://localhost:5000/api',
      fallbackServicePoints: { bookingFailure: '' },
    })

    expect(parsed.fallbackServicePoints?.bookingFailure).toBeUndefined()
  })

  it('normalizes an empty fallbackServicePoints container to undefined bookingFailure', () => {
    const parsed = appConfigSchema.parse({
      bilregApiBase: 'http://localhost:5000/api',
      fallbackServicePoints: {},
    })

    expect(parsed.fallbackServicePoints?.bookingFailure).toBeUndefined()
  })

  it('normalizes whitespace-only bookingFailure to undefined', () => {
    const parsed = appConfigSchema.parse({
      bilregApiBase: 'http://localhost:5000/api',
      fallbackServicePoints: { bookingFailure: '   ' },
    })

    expect(parsed.fallbackServicePoints?.bookingFailure).toBeUndefined()
  })

  it('keeps fallbackServicePoints optional', () => {
    const parsed = appConfigSchema.parse({ bilregApiBase: 'http://localhost:5000/api' })

    expect(parsed.fallbackServicePoints).toBeUndefined()
  })
})
