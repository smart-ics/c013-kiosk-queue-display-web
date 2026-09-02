import { captureToBlob, warmupFonts, PRINT_CAPTURE_OPTIONS } from './htmlToImage'

export type RegistrationReceiptData = {
  noAntrian: number
  regId: string
  pasienName: string
  pasienId?: string
  tglLahir?: string
  umur?: string
  regDate?: string
  jamReg?: string
  tipeJaminanName?: string
  noSep?: string
  serviceName?: string
  dokterName?: string
  qrCodeReg?: string
  rsName?: string
  rsAddress?: string
  rsPhone?: string
  printedAt?: string
}

const RECEIPT_TEMPLATE_URL = `${import.meta.env.BASE_URL}templates/antrian_registrasi.html`
const PAPER_WIDTH_MM = 80

let templateCache: string | null = null

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&':
        return '&amp;'
      case '<':
        return '&lt;'
      case '>':
        return '&gt;'
      case '"':
        return '&quot;'
      default:
        return '&#39;'
    }
  })
}

function buildUmurLine(data: RegistrationReceiptData): string {
  if (!data.tglLahir) return ''
  const label = data.umur ? `${data.umur} (${data.tglLahir})` : data.tglLahir
  return `<div class="patient-meta">${escapeHtml(label)}</div>`
}

function buildSepLine(data: RegistrationReceiptData): string {
  if (!data.noSep) return ''
  return `<br /><span>SEP : ${escapeHtml(data.noSep)}</span>`
}

export function renderReceiptTemplate(
  content: string,
  data: RegistrationReceiptData,
): string {
  const lines: Record<string, string> = {
    umurLine: buildUmurLine(data),
    sepLine: buildSepLine(data),
  }
  const vars: Record<string, string> = {
    rsName: data.rsName ?? '',
    rsAddress: data.rsAddress ?? '',
    rsPhone: data.rsPhone ?? '',
    pasienName: data.pasienName ?? '',
    pasienId: data.pasienId ?? '',
    regId: data.regId ?? '',
    regDate: data.regDate ?? '',
    jamReg: data.jamReg ?? '',
    tipeJaminanName: data.tipeJaminanName ?? '',
    noAntrian: String(data.noAntrian),
    layananName: data.serviceName ?? '',
    dokterName: data.dokterName ?? '',
    qrCodeReg: data.qrCodeReg ?? '',
    printedAt: data.printedAt ?? '',
  }

  let result = content
  for (const [key, value] of Object.entries(lines)) {
    result = result.replace(new RegExp(`{{\\s*${key}\\s*}}`, 'g'), value)
  }
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`{{\\s*${key}\\s*}}`, 'g'), escapeHtml(value))
  }
  return result
}

async function loadReceiptTemplate(): Promise<string> {
  if (templateCache) return templateCache
  const response = await fetch(RECEIPT_TEMPLATE_URL, { cache: 'no-store' })
  if (!response.ok) throw new Error(`Template not found: ${RECEIPT_TEMPLATE_URL}`)
  templateCache = await response.text()
  return templateCache
}

function injectPaperStyles(content: string): string {
  const styleTag = `<style id="paper-size-vars">\n:root { --pw: ${PAPER_WIDTH_MM}mm; }\n</style>`
  const headCloseIndex = content.indexOf('</head>')
  if (headCloseIndex !== -1) {
    return `${content.slice(0, headCloseIndex)}${styleTag}${content.slice(headCloseIndex)}`
  }
  return `${styleTag}\n${content}`
}

export async function renderRegistrationReceiptPng(
  data: RegistrationReceiptData,
): Promise<Blob> {
  const content = injectPaperStyles(renderReceiptTemplate(await loadReceiptTemplate(), data))

  const iframe = document.createElement('iframe')
  iframe.style.cssText = `position:absolute;left:-9999px;top:-9999px;width:${PAPER_WIDTH_MM}mm;height:auto;border:none;`
  document.body.appendChild(iframe)

  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document
  if (!iframeDoc) {
    document.body.removeChild(iframe)
    throw new Error('Failed to access iframe document')
  }

  try {
    iframeDoc.open()
    iframeDoc.write(content)
    iframeDoc.close()

    const iframeBody = await new Promise<HTMLElement>((resolve, reject) => {
      const timeoutId = setTimeout(() => reject(new Error('Template load timeout')), 5000)
      iframe.addEventListener(
        'load',
        () => {
          clearTimeout(timeoutId)
          resolve(iframe.contentWindow!.document.body)
        },
        { once: true },
      )
      if (iframe.contentDocument?.readyState === 'complete') {
        clearTimeout(timeoutId)
        resolve(iframe.contentWindow!.document.body)
      }
    })

    await warmupFonts(iframeBody)
    return captureToBlob(iframeBody, PRINT_CAPTURE_OPTIONS)
  } finally {
    if (document.body.contains(iframe)) {
      document.body.removeChild(iframe)
    }
  }
}
