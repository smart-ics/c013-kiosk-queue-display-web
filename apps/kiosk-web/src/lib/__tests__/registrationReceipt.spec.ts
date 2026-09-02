import { describe, expect, it } from 'vitest'
import { renderReceiptTemplate, type RegistrationReceiptData } from '../registrationReceipt'

const TEMPLATE = `<div class="header"><h1>{{ rsName }}</h1><p>{{ rsAddress }} {{ rsPhone }}</p></div>
<div class="patient">
  <div class="patient-name">{{ pasienName }}</div>
  {{ umurLine }}
  <div class="patient-meta">
    <span>{{ pasienId }}</span>
    <strong>{{ regId }}</strong> ({{ regDate }} {{ jamReg }})
    <strong>{{ tipeJaminanName }}</strong>
    {{ sepLine }}
  </div>
</div>
<div class="queue-number">{{ noAntrian }}</div>
<div class="service-name">{{ layananName }}</div>
<div class="service-doctor">{{ dokterName }}</div>
<img src="{{ qrCodeReg }}" />
<div>{{ printedAt }}</div>`

function baseData(): RegistrationReceiptData {
  return {
    noAntrian: 7,
    regId: 'R1',
    pasienName: 'Andi',
    rsName: 'RS Mekarsari',
    rsAddress: 'Jl. Patriot',
    rsPhone: '(0274) 550060',
    pasienId: 'MR-001',
    regDate: '02 September 2026',
    jamReg: '10:00',
    tipeJaminanName: 'Umum',
    serviceName: 'Poli Jantung',
    dokterName: 'Dr. Budi',
    qrCodeReg: 'data:image/png;base64,ABC',
    printedAt: '02/09/2026 10:00',
  }
}

describe('renderReceiptTemplate', () => {
  it('substitutes data tokens into the template', () => {
    const html = renderReceiptTemplate(TEMPLATE, baseData())
    expect(html).toContain('RS Mekarsari')
    expect(html).toContain('Jl. Patriot (0274) 550060')
    expect(html).toContain('MR-001')
    expect(html).toContain('R1')
    expect(html).toContain('7')
    expect(html).toContain('Poli Jantung')
    expect(html).toContain('Dr. Budi')
    expect(html).toContain('data:image/png;base64,ABC')
    expect(html).toContain('02/09/2026 10:00')
  })

  it('escapes HTML special characters in data values', () => {
    const html = renderReceiptTemplate(TEMPLATE, { ...baseData(), pasienName: '<script>alert(1)</script>' })
    expect(html).toContain('&lt;script&gt;')
    expect(html).not.toContain('<script>')
  })

  it('omits the SEP line when noSep is absent', () => {
    const html = renderReceiptTemplate(TEMPLATE, baseData())
    expect(html).not.toContain('SEP :')
  })

  it('renders the SEP line when noSep is present', () => {
    const html = renderReceiptTemplate(TEMPLATE, { ...baseData(), noSep: 'SEP-1234' })
    expect(html).toContain('SEP : SEP-1234')
  })

  it('omits the umur line when tglLahir is absent', () => {
    const html = renderReceiptTemplate(TEMPLATE, baseData())
    expect(html).not.toMatch(/class="patient-meta">\d+ \(\d/)
  })

  it('renders the umur line when tglLahir and umur are present', () => {
    const html = renderReceiptTemplate(TEMPLATE, { ...baseData(), tglLahir: '01 Januari 1980', umur: '46' })
    expect(html).toContain('46 (01 Januari 1980)')
  })
})
