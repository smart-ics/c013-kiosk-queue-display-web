import { captureToBlob, warmupFonts, PRINT_CAPTURE_OPTIONS } from './htmlToImage'

export type PatientLabelData = {
  pasienName: string
  regId: string
  pasienId?: string
  umur?: string
  tglLahirDmy?: string
  qrCodeLabel?: string
}

const LABEL_TEMPLATE_URL = `${import.meta.env.BASE_URL}templates/label_pasien.html`
const PAPER_WIDTH_MM = 55
const PAPER_HEIGHT_MM = 20

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

export function renderLabelTemplate(
  content: string,
  data: PatientLabelData,
): string {
  const vars: Record<string, string> = {
    pasienName: data.pasienName ?? '',
    regId: data.regId ?? '',
    pasienId: data.pasienId ?? '',
    umur: data.umur ?? '',
    tglLahirDmy: data.tglLahirDmy ?? '',
    qrCodeLabel: data.qrCodeLabel ?? '',
  }

  let result = content
  for (const [key, value] of Object.entries(vars)) {
    if (key === 'qrCodeLabel') {
      result = result.replace(new RegExp(`{{\\s*${key}\\s*}}`, 'g'), value)
    } else {
      result = result.replace(new RegExp(`{{\\s*${key}\\s*}}`, 'g'), escapeHtml(value))
    }
  }
  return result
}

async function loadLabelTemplate(): Promise<string> {
  if (templateCache) return templateCache
  const response = await fetch(LABEL_TEMPLATE_URL, { cache: 'no-store' })
  if (!response.ok) throw new Error(`Template not found: ${LABEL_TEMPLATE_URL}`)
  templateCache = await response.text()
  return templateCache
}

function injectPaperStyles(content: string): string {
  const styleTag = `<style id="paper-size-vars">\n:root { --pw: ${PAPER_WIDTH_MM}mm; --ph: ${PAPER_HEIGHT_MM}mm; }\n</style>`
  const headCloseIndex = content.indexOf('</head>')
  if (headCloseIndex !== -1) {
    return `${content.slice(0, headCloseIndex)}${styleTag}${content.slice(headCloseIndex)}`
  }
  return `${styleTag}\n${content}`
}

function injectPrintFont(content: string): string {
  const styleTag = `<style id="print-font">\nbody { font-family: Tahoma, Arial, sans-serif; }\n</style>`
  const headCloseIndex = content.indexOf('</head>')
  if (headCloseIndex !== -1) {
    return `${content.slice(0, headCloseIndex)}${styleTag}${content.slice(headCloseIndex)}`
  }
  return `${styleTag}\n${content}`
}

export async function renderPatientLabelPng(
  data: PatientLabelData,
): Promise<Blob> {
  let content = renderLabelTemplate(await loadLabelTemplate(), data)
  content = injectPaperStyles(content)
  content = injectPrintFont(content)

  const iframe = document.createElement('iframe')
  iframe.style.cssText = `position:absolute;left:-9999px;top:-9999px;width:${PAPER_WIDTH_MM}mm;height:${PAPER_HEIGHT_MM}mm;border:none;`
  document.body.appendChild(iframe)

  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document
  if (!iframeDoc) {
    if (document.body.contains(iframe)) document.body.removeChild(iframe)
    throw new Error('Failed to access iframe document')
  }

  try {
    iframeDoc.open()
    iframeDoc.write(content)
    iframeDoc.close()

    const iframeBody = await new Promise<HTMLElement>((resolve, reject) => {
      const timeoutId = setTimeout(() => reject(new Error('Template load timeout')), 5000)
      const onComplete = () => {
        clearTimeout(timeoutId)
        resolve(iframe.contentWindow!.document.body)
      }

      if (iframe.contentDocument?.readyState === 'complete') {
        onComplete()
      } else {
        iframe.addEventListener('load', onComplete, { once: true })
        iframe.addEventListener('error', () => {
          clearTimeout(timeoutId)
          reject(new Error('Template load error'))
        }, { once: true })
      }
    })

    // 1. Wait for images (QR code) to complete loading inside iframe
    const images = Array.from(iframeBody.querySelectorAll('img'))
    await Promise.all(
      images.map(
        (img) =>
          new Promise<void>((resolve) => {
            if (img.complete && img.naturalWidth > 0) {
              resolve()
            } else {
              img.onload = () => resolve()
              img.onerror = () => resolve()
            }
          }),
      ),
    )

    // 2. Compute exact full document height / dimension if needed
    const docEl = iframeDoc.documentElement
    const contentHeight = Math.max(
      iframeBody.scrollHeight,
      iframeBody.offsetHeight,
      docEl ? docEl.scrollHeight : 0,
      docEl ? docEl.offsetHeight : 0,
    )
    if (contentHeight > 0) {
      iframe.style.height = `${contentHeight}px`
      if (docEl) docEl.style.height = `${contentHeight}px`
      iframeBody.style.height = `${contentHeight}px`
    }

    await warmupFonts(iframeBody)
    return await captureToBlob(iframeBody, PRINT_CAPTURE_OPTIONS)
  } finally {
    if (document.body.contains(iframe)) {
      document.body.removeChild(iframe)
    }
  }
}
