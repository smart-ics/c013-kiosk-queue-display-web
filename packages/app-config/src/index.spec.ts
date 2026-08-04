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
})
