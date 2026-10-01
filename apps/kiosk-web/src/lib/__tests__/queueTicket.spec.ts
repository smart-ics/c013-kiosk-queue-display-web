import { describe, expect, it } from 'vitest'
import {
  ADMISI_FALLBACK_NOTICE_TEXT,
  buildAdmisiFallbackNotice,
  formatRegistrasiFallbackHeader,
} from '../queueTicket'

describe('queueTicket fallback print output', () => {
  it('formats the existing-registration header with exactly the required prefix', () => {
    expect(formatRegistrasiFallbackHeader('RG01069593')).toBe(
      'Berhasil Registrasi regid : RG01069593',
    )
  })

  it('builds the admisi fallback notice with an admisi instruction', () => {
    expect(buildAdmisiFallbackNotice('RG01069593')).toEqual({
      regId: 'RG01069593',
      instruction: 'Silakan menuju Loket Admisi untuk penyelesaian berkas.',
    })
  })

  it('exposes the admisi instruction text as a stable constant', () => {
    expect(ADMISI_FALLBACK_NOTICE_TEXT).toBe(
      'Silakan menuju Loket Admisi untuk penyelesaian berkas.',
    )
  })
})