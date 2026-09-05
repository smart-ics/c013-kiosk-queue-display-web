import { describe, expect, it } from 'vitest'
import { renderLabelTemplate, type PatientLabelData } from '../patientLabel'

const TEMPLATE = `<div class="label">
  <div class="info-name">{{  pasienName  }}</div>
  <div class="info-row">
    <div class="qr-wrap">
      <img src="{{ qrCodeLabel }}" alt="QR" />
    </div>
    <div class="info-data">
      <div class="info-mr">{{ regId }}</div>
      <div class="info-mr">{{ pasienId }}</div>
      <div class="info-dob">{{ umur }} ({{ tglLahirDmy }})</div>
    </div>
  </div>
</div>`

function baseData(): PatientLabelData {
  return {
    pasienName: 'SUGIARTO, TN',
    regId: 'RG01069593',
    pasienId: '00-12-34-56',
    umur: '45 Thn',
    tglLahirDmy: '15-08-1981',
    qrCodeLabel: 'data:image/png;base64,TESTQR',
  }
}

describe('renderLabelTemplate', () => {
  it('substitutes data tokens into the template', () => {
    const html = renderLabelTemplate(TEMPLATE, baseData())
    expect(html).toContain('SUGIARTO, TN')
    expect(html).toContain('RG01069593')
    expect(html).toContain('00-12-34-56')
    expect(html).toContain('45 Thn')
    expect(html).toContain('15-08-1981')
    expect(html).toContain('data:image/png;base64,TESTQR')
  })

  it('escapes HTML special characters in text values but preserves qrCodeLabel data url', () => {
    const html = renderLabelTemplate(TEMPLATE, {
      ...baseData(),
      pasienName: '<script>alert("XSS")</script>',
    })
    expect(html).toContain('&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;')
    expect(html).not.toContain('<script>')
    expect(html).toContain('data:image/png;base64,TESTQR')
  })

  it('handles empty or missing optional fields gracefully', () => {
    const html = renderLabelTemplate(TEMPLATE, {
      pasienName: 'BUDI',
      regId: 'RG123',
    })
    expect(html).toContain('BUDI')
    expect(html).toContain('RG123')
    expect(html).toContain('<div class="info-mr"></div>')
  })
})
