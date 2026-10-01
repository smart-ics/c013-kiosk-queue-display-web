import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  isValidUploadSepNo,
  reportInvalidUploadIdentity,
  UPLOAD_IDENTITY_INVALID_LOG_PREFIX,
} from '../uploadIdentity'

describe('isValidUploadSepNo', () => {
  it('accepts a real upload number', () => {
    expect(isValidUploadSepNo('0112R')).toBe(true)
  })

  it('accepts a real number surrounded by whitespace', () => {
    expect(isValidUploadSepNo(' 0112R ')).toBe(true)
  })

  it('rejects the placeholder', () => {
    expect(isValidUploadSepNo('-')).toBe(false)
  })

  it('rejects a padded placeholder', () => {
    expect(isValidUploadSepNo('  -  ')).toBe(false)
  })

  it('rejects blank values', () => {
    expect(isValidUploadSepNo('')).toBe(false)
    expect(isValidUploadSepNo('   ')).toBe(false)
  })

  it('rejects missing and non-string values', () => {
    expect(isValidUploadSepNo(undefined)).toBe(false)
    expect(isValidUploadSepNo(null)).toBe(false)
    expect(isValidUploadSepNo(12345)).toBe(false)
    expect(isValidUploadSepNo({ sepNo: '0112R' })).toBe(false)
  })
})

describe('reportInvalidUploadIdentity', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('logs the named guard condition with the correlation id only', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    reportInvalidUploadIdentity('R1')

    expect(warn).toHaveBeenCalledTimes(1)
    const line = String(warn.mock.calls[0][0])
    expect(line.startsWith(UPLOAD_IDENTITY_INVALID_LOG_PREFIX)).toBe(true)
    expect(line).toContain('regId=R1')
    expect(line).not.toContain('Pendaftaran')
  })
})
