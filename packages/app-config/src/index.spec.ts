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
})
